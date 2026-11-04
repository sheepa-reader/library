/**
 * SHEEPA PUBLISHER STUDIO - CORE APPLICATION LOGIC
 * API Key Vault, AI Chapter Analysis, Regex Fallback, ZIP Packager
 */

(function () {
  'use strict';

  // --- STATE ---
  let keys = JSON.parse(localStorage.getItem('sheepa_vault_keys') || '[]');
  let activeKeyId = localStorage.getItem('sheepa_active_key_id') || (keys[0]?.id || '');
  let currentLibraryBooks = [];
  let parsedBook = null; // { id, title, originalTitle, author, translator, category, status, description, coverDataUrl, coverUrl, chapters: [...] }

  // --- DOM ELEMENTS ---
  const tabBtns = document.querySelectorAll('.nav-tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const keyTableBody = document.getElementById('key-table-body');
  const currentKeySelect = document.getElementById('active-key-select');
  const txtDropzone = document.getElementById('txt-dropzone');
  const txtFileInput = document.getElementById('txt-file-input');
  const coverFileInput = document.getElementById('cover-file-input');
  const coverPreview = document.getElementById('cover-preview-img');
  const consoleLog = document.getElementById('studio-log');

  // --- UTILS ---
  function log(msg, type = 'info') {
    if (!consoleLog) return;
    const time = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌ ' : type === 'success' ? '✅ ' : 'ℹ️ ';
    consoleLog.innerHTML += `[${time}] ${prefix}${msg}\n`;
    consoleLog.scrollTop = consoleLog.scrollHeight;
  }

  function slugify(text) {
    return text.toString().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }

  // --- TAB NAVIGATION ---
  function initTabs() {
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${target}`).classList.add('active');
      });
    });
  }

  // --- THEME ENGINE ---
  function initTheme() {
    const saved = localStorage.getItem('sheepa_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    const themeBtn = document.getElementById('studio-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('sheepa_theme', next);
      });
    }
  }

  // --- KEY VAULT MANAGEMENT ---
  function saveKeys() {
    localStorage.setItem('sheepa_vault_keys', JSON.stringify(keys));
    localStorage.setItem('sheepa_active_key_id', activeKeyId);
    renderKeyTable();
    updateKeySelect();
  }

  function renderKeyTable() {
    if (!keyTableBody) return;
    if (keys.length === 0) {
      keyTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--studio-muted); padding: 2rem;">Chưa có API Key nào được lưu. Hãy thêm key mới bên dưới!</td></tr>`;
      return;
    }

    keyTableBody.innerHTML = keys.map(k => `
      <tr>
        <td><strong>${escapeHtml(k.name)}</strong> ${k.id === activeKeyId ? '<span class="badge-model badge-active">Đang dùng</span>' : ''}</td>
        <td><span class="badge-model">${escapeHtml(k.model.toUpperCase())}</span></td>
        <td><code>••••••••${k.key.slice(-4)}</code></td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="window.Studio.setActiveKey('${k.id}')">Kích hoạt</button>
          <button class="btn btn-sm btn-outline" onclick="window.Studio.testKey('${k.id}')">Ping thử</button>
          <button class="btn btn-sm btn-outline" onclick="window.Studio.listKeyModels('${k.id}')" title="Xem danh sách model được cấp phép">🔍 Model</button>
          <button class="btn btn-sm btn-danger" onclick="window.Studio.deleteKey('${k.id}')">Xóa</button>
        </td>
      </tr>
    `).join('');
  }

  function updateKeySelect() {
    if (!currentKeySelect) return;
    currentKeySelect.innerHTML = keys.map(k => `
      <option value="${k.id}" ${k.id === activeKeyId ? 'selected' : ''}>${escapeHtml(k.name)} (${k.model})</option>
    `).join('');
    if (keys.length === 0) {
      currentKeySelect.innerHTML = `<option value="">(Chưa có key - Dùng Regex Offline)</option>`;
    }
  }

  // --- GEMINI DIRECT API CALL ---
  async function executeGeminiGenerate(apiKey, chosenModel, prompt) {
    // Thử mô hình đã chọn và các biến thể chính thức (Flash / Pro)
    let candidates = [chosenModel];
    if (chosenModel === 'gemini-3.8') candidates.push('gemini-3.8-flash', 'gemini-3.8-pro');
    if (chosenModel === 'gemini-3.7') candidates.push('gemini-3.7-flash', 'gemini-3.7-pro');
    if (chosenModel === 'gemini-3.6') candidates.push('gemini-3.6-flash', 'gemini-3.6-pro');
    if (chosenModel === 'gemini-3.5') candidates.push('gemini-3.5-flash', 'gemini-3.5-pro');

    let lastError = null;
    for (const model of candidates) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();

        if (res.ok && data.candidates && data.candidates[0]) {
          const responseText = data.candidates[0].content.parts[0].text;
          return { text: responseText, activeEngine: model };
        } else if (data.error && data.error.message && data.error.message.includes('not found')) {
          lastError = new Error(data.error.message);
          continue;
        } else {
          throw new Error(data.error?.message || 'Lỗi xử lý nội dung từ Gemini');
        }
      } catch (err) {
        lastError = err;
        if (!err.message.includes('not found')) throw err;
      }
    }

    throw lastError || new Error(`Không tìm thấy mô hình ${chosenModel} trên máy chủ Google.`);
  }

  window.Studio = {
    setActiveKey: function (id) {
      activeKeyId = id;
      saveKeys();
      log(`Đã chọn API Key hoạt động: ${keys.find(k => k.id === id)?.name}`, 'success');
    },
    deleteKey: function (id) {
      if (!confirm('Bạn có chắc chắn muốn xóa key này khỏi kho?')) return;
      keys = keys.filter(k => k.id !== id);
      if (activeKeyId === id) activeKeyId = keys[0]?.id || '';
      saveKeys();
      log('Đã xóa key thành công.');
    },
    testKey: async function (id) {
      const k = keys.find(item => item.id === id);
      if (!k) return;
      log(`Đang kiểm tra kết nối Google Gemini tới ${k.name} (${k.model.toUpperCase()})...`);
      try {
        const result = await executeGeminiGenerate(k.key, k.model, "Trả lời ngắn gọn chữ 'OK' để kiểm tra kết nối.");
        log(`Key Gemini "${k.name}" (${k.model.toUpperCase()}) kết nối THÀNH CÔNG! Động cơ: ${result.activeEngine}. Phản hồi: ${result.text.trim()}`, 'success');
      } catch (err) {
        log(`Lỗi kết nối Gemini: ${err.message}`, 'error');
      }
    },
    listKeyModels: async function (id) {
      const k = keys.find(item => item.id === id);
      if (!k) return;
      log(`Đang truy vấn danh sách Model từ máy chủ Google AI Studio cho key "${k.name}"...`);
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${k.key}`);
        const data = await res.json();
        if (data.models) {
          const names = data.models
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace('models/', ''));
          log(`Các model AI Studio được cấp phép cho key của bạn (${names.length}):\n${names.slice(0, 8).join(', ')}...`, 'success');
        } else {
          throw new Error(data.error?.message || 'Không thể lấy danh sách model');
        }
      } catch (e) {
        log(`Lỗi kiểm tra danh sách: ${e.message}`, 'error');
      }
    }
  };

  // --- FETCH MODELS DIRECTLY FROM KEY ---
  const btnFetchModels = document.getElementById('btn-fetch-models-live');
  if (btnFetchModels) {
    btnFetchModels.addEventListener('click', async () => {
      const keyVal = document.getElementById('key-val').value.trim() || keys.find(k => k.id === activeKeyId)?.key;
      if (!keyVal) {
        alert('Vui lòng dán mã API Key vào ô bên dưới trước khi bấm tải danh sách!');
        return;
      }
      log('Đang kết nối Google AI Studio để lấy danh sách mô hình thực tế...');
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${keyVal}`);
        const data = await res.json();
        if (data.models) {
          const validModels = data.models
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace('models/', ''));
          
          const modelSelect = document.getElementById('key-model');
          if (modelSelect) {
            modelSelect.innerHTML = validModels.map(m => `<option value="${m}">${m}</option>`).join('');
          }
          log(`Đã tải thành công ${validModels.length} mô hình khả dụng vào danh sách lựa chọn!`, 'success');
        } else {
          throw new Error(data.error?.message || 'Không tìm thấy model');
        }
      } catch (e) {
        log(`Lỗi tải model: ${e.message}`, 'error');
      }
    });
  }

  // --- ADD KEY FORM ---
  const addKeyForm = document.getElementById('add-key-form');
  if (addKeyForm) {
    addKeyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('key-name').value.trim();
      const model = document.getElementById('key-model').value.trim();
      const keyVal = document.getElementById('key-val').value.trim();

      if (!name || !keyVal) {
        alert('Vui lòng nhập tên và mã API Key Google Gemini!');
        return;
      }

      const newKey = {
        id: 'key_' + Date.now(),
        name,
        provider: 'gemini',
        model,
        key: keyVal
      };

      keys.push(newKey);
      if (!activeKeyId) activeKeyId = newKey.id;
      saveKeys();
      addKeyForm.reset();
      log(`Đã lưu API Key Gemini mới: "${name}" (${model})`, 'success');
    });
  }

  // --- REPOSITORY BOOKS SYNC (IMPORT BOOKS.JSON) ---
  async function loadLibraryBooks() {
    try {
      // Try local path first
      let res = await fetch('data/books.json');
      if (!res.ok) {
        // Fallback to live GitHub
        res = await fetch('https://raw.githubusercontent.com/sheepa-reader/library/main/data/books.json');
      }
      if (res.ok) {
        currentLibraryBooks = await res.json();
        renderProjectsList();
        log(`Đã nạp danh sách thư viện (${currentLibraryBooks.length} cuốn sách).`, 'success');
      }
    } catch (e) {
      log('Chưa nạp được danh mục tự động. Bạn có thể tải file books.json thủ công.', 'error');
    }
  }

  function renderProjectsList() {
    const container = document.getElementById('projects-container');
    if (!container) return;
    if (currentLibraryBooks.length === 0) {
      container.innerHTML = '<p style="color: var(--studio-muted);">Chưa có dự án nào trong thư viện.</p>';
      return;
    }

    container.innerHTML = currentLibraryBooks.map(b => `
      <div style="display: flex; gap: 1rem; align-items: center; padding: 1rem; border: 1px solid var(--studio-border); border-radius: 8px; margin-bottom: 0.75rem; background: var(--studio-card);">
        <img src="${b.cover || 'public/icons/04_book_stack_horizontal.png'}" style="width: 45px; height: 60px; object-fit: cover; border-radius: 4px;">
        <div style="flex: 1;">
          <div style="font-weight: 700; font-size: 1rem;">${escapeHtml(b.title)}</div>
          <div style="font-size: 0.8rem; color: var(--studio-muted);">${escapeHtml(b.author)} • ${b.chapters?.length || 0} chương • ${b.statusText || b.status}</div>
        </div>
        <button class="btn btn-sm btn-outline" onclick="window.Studio.loadBookIntoEditor('${b.id}')">Chỉnh sửa</button>
      </div>
    `).join('');
  }

  window.Studio.loadBookIntoEditor = function (bookId) {
    const b = currentLibraryBooks.find(item => item.id === bookId);
    if (!b) return;
    parsedBook = JSON.parse(JSON.stringify(b));
    populateEditor(parsedBook);
    // Switch to step 2 tab
    document.querySelector('[data-tab="convert"]').click();
    log(`Đã nạp cuốn "${b.title}" vào bảng chỉnh sửa.`, 'info');
  };

  // --- TXT & COVER FILE HANDLING ---
  let rawBookText = '';
  let selectedCoverBlob = null;

  if (txtDropzone && txtFileInput) {
    txtDropzone.addEventListener('click', () => txtFileInput.click());
    txtDropzone.addEventListener('dragover', (e) => { e.preventDefault(); txtDropzone.classList.add('dragover'); });
    txtDropzone.addEventListener('dragleave', () => txtDropzone.classList.remove('dragover'));
    txtDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      txtDropzone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) handleTxtFile(e.dataTransfer.files[0]);
    });
    txtFileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) handleTxtFile(e.target.files[0]);
    });
  }

  function handleTxtFile(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      rawBookText = e.target.result;
      document.getElementById('txt-filename-display').textContent = `📄 Đã nạp: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      log(`Đã nạp file văn bản: ${file.name} (${rawBookText.length} ký tự).`, 'success');
      // Auto-suggest title from filename
      const suggestedTitle = file.name.replace(/\.txt$/i, '').replace(/[_-]/g, ' ');
      document.getElementById('meta-title').value = suggestedTitle;
    };
    reader.readAsText(file, 'utf-8');
  }

  // Cover image input
  if (coverFileInput) {
    coverFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        selectedCoverBlob = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
          coverPreview.src = ev.target.result;
          coverPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
        log(`Đã chọn ảnh bìa: ${file.name}`, 'info');
      }
    });
  }

  // Cover URL input
  const coverUrlInput = document.getElementById('cover-url-input');
  if (coverUrlInput) {
    coverUrlInput.addEventListener('input', (e) => {
      const url = e.target.value.trim();
      if (url) {
        coverPreview.src = url;
        coverPreview.style.display = 'block';
      }
    });
  }

  // --- SMART CONVERTER: AI & REGEX ENGINE ---
  const btnProcessAI = document.getElementById('btn-process-ai');
  const btnProcessRegex = document.getElementById('btn-process-regex');

  if (btnProcessRegex) {
    btnProcessRegex.addEventListener('click', () => {
      if (!rawBookText) {
        alert('Vui lòng nạp file sách .txt trước!');
        return;
      }
      processBookWithRegex(rawBookText);
    });
  }

  if (btnProcessAI) {
    btnProcessAI.addEventListener('click', () => {
      if (!rawBookText) {
        alert('Vui lòng nạp file sách .txt trước!');
        return;
      }
      const activeKey = keys.find(k => k.id === activeKeyId);
      if (!activeKey) {
        alert('Chưa có API Key nào được kích hoạt. Hãy thêm key trong tab "Quản Lý Key" hoặc dùng nút "Phân Tách Nhanh Bằng Regex"!');
        return;
      }
      processBookWithAI(rawBookText, activeKey);
    });
  }

  // Regex Engine (Hỗ trợ cấu trúc phân cấp H1 Phần Lớn -> H2 Chương Con)
  function processBookWithRegex(text) {
    log('Đang phân tích cấu trúc văn bản bằng Regex Engine thông minh...');

    // 1. Cắt bỏ mục lục phụ ở cuối file nếu có (tránh nhầm mục lục cuối file thành nội dung)
    let cleanText = text;
    const tocEndIndex = cleanText.search(/\n\s*(?:Table\s+of\s+Contents|Mục\s+Lục)\s*\n/i);
    if (tocEndIndex !== -1 && tocEndIndex > cleanText.length * 0.7) {
      cleanText = cleanText.slice(0, tocEndIndex);
      log('Đã tự động loại bỏ phần Mục lục phụ ở cuối văn bản để tập trung bóc tách thân bài.', 'info');
    }

    const lines = cleanText.split(/\r?\n/);
    let chapters = [];
    let currentPart = '';
    let currentChapterTitle = '';
    let currentChapterLines = [];
    let chapCount = 0;
    let bookIntroLines = [];

    // Tìm các điểm ngắt chương:
    // Kiểu 1: "Chương 1...", "Hồi 1...", "Chapter 1..."
    // Kiểu 2: "Phần I...", "Phần Một..." (H1 Phần Lớn)
    // Kiểu 3: Dòng chỉ chứa 1 con số nguyên độc lập "1", "2", "3"...
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Kiểm tra H1 (Phần lớn)
      const partMatch = trimmed.match(/^PHẦN\s+([0-9IVXLCDMivxlcdm]+|\w+)[\s\:\.\-–—]*(.*)$/i);
      if (partMatch && trimmed.length < 120) {
        currentPart = trimmed;
        continue;
      }

      // Kiểm tra H2 (Chương)
      let isChapter = false;
      let detectedTitle = '';

      const explicitChapMatch = trimmed.match(/^(?:#*\s*)(?:Chương|Hồi|Chapter)\s+([0-9IVXLCDMivxlcdm]+)[\s\:\.\-–—]*(.*)$/i);
      if (explicitChapMatch && trimmed.length < 120) {
        isChapter = true;
        detectedTitle = trimmed.replace(/^#+\s*/, '');
      } else if (chapCount >= 0 && /^[0-9]{1,3}$/.test(trimmed)) {
        const num = parseInt(trimmed, 10);
        const prevEmpty = (i === 0 || lines[i - 1].trim() === '');
        const nextEmpty = (i === lines.length - 1 || lines[i + 1].trim() === '');
        if (prevEmpty && (num === chapCount + 1 || (chapCount === 0 && num <= 2))) {
          isChapter = true;
          detectedTitle = `Chương ${num}`;
        }
      }

      if (isChapter) {
        if (chapCount > 0) {
          chapters.push({
            id: `chuong-${chapCount}`,
            title: currentChapterTitle,
            part: currentPart || 'Nội Dung Tác Phẩm',
            content: `# ${currentChapterTitle}\n\n${currentPart ? `*${currentPart}*\n\n` : ''}${currentChapterLines.join('\n').trim()}`
          });
        }
        chapCount++;
        currentChapterTitle = detectedTitle;
        currentChapterLines = [];
      } else {
        if (chapCount === 0) {
          bookIntroLines.push(line);
        } else {
          currentChapterLines.push(line);
        }
      }
    }

    if (chapCount > 0 && currentChapterLines.length > 0) {
      chapters.push({
        id: `chuong-${chapCount}`,
        title: currentChapterTitle,
        part: currentPart || 'Nội Dung Tác Phẩm',
        content: `# ${currentChapterTitle}\n\n${currentPart ? `*${currentPart}*\n\n` : ''}${currentChapterLines.join('\n').trim()}`
      });
    }

    if (chapters.length === 0) {
      chapters.push({
        id: 'chuong-1',
        title: 'Chương 1: Toàn bộ tác phẩm',
        part: 'Toàn Bộ Tác Phẩm',
        content: cleanText.trim()
      });
      log('Không nhận diện được số chương riêng lẻ. Đã nạp thành 1 chương duy nhất.', 'info');
    } else {
      log(`Bóc tách THÀNH CÔNG ${chapters.length} chương đầy đủ nội dung (kèm phân cấp H1 Phần)!`, 'success');
    }

    const titleInput = document.getElementById('meta-title').value.trim();
    parsedBook = {
      id: slugify(titleInput || 'sach-dich'),
      title: titleInput || 'Tác Phẩm Dịch Mới',
      originalTitle: document.getElementById('meta-original-title').value.trim() || '',
      series: document.getElementById('meta-series')?.value.trim() || '',
      volume: document.getElementById('meta-volume')?.value.trim() || '',
      author: document.getElementById('meta-author').value.trim() || 'Chưa rõ tác giả',
      translator: document.getElementById('meta-translator').value.trim() || 'Sheepa Translator',
      category: document.getElementById('meta-category').value || 'Văn học cổ điển',
      status: document.getElementById('meta-status').value || 'ongoing',
      statusText: document.getElementById('meta-status').value === 'completed' ? 'Hoàn thành' : 'Đang dịch',
      description: bookIntroLines.join('\n').trim().slice(0, 450) || 'Bản dịch được phát hành bởi Sheepa Translator.',
      chapters: chapters
    };

    populateEditor(parsedBook);
  }

  // AI Engine
  async function processBookWithAI(text, keyObj) {
    log(`Đang gửi yêu cầu phân tích sách tới AI (${keyObj.name} - ${keyObj.model})...`);
    
    const sampleText = text.slice(0, 4500);

    const prompt = `Bạn là biên tập viên xuất bản sách chuyên nghiệp. Hãy đọc đoạn trích đầu của tác phẩm sau và trích xuất thông tin dưới dạng JSON chuẩn xác (chỉ trả về JSON thuần, không bọc markdown hay text khác):
{
  "title": "Tên sách tiếng Việt gợi ý",
  "originalTitle": "Tên tác phẩm gốc nếu biết",
  "series": "Tên bộ sách / Series nếu tác phẩm thuộc một series (hoặc để trống)",
  "volume": "Tập mấy trong Series nếu có (ví dụ: Tập 1, Quyển 2... hoặc để trống)",
  "author": "Tên tác giả",
  "category": "Một trong các thể loại: Văn học cổ điển, Tiểu thuyết triết lý, Triết lý sống, Khoa học & Đời sống, Trinh thám & Bí ẩn",
  "description": "Tóm tắt ngắn gọn và lôi cuốn về tác phẩm trong khoảng 2-3 câu."
}

Đoạn văn bản trích dẫn:
${sampleText}`;

    try {
      const result = await executeGeminiGenerate(keyObj.key, keyObj.model, prompt);
      const aiResultText = result.text;

      // Parse AI JSON
      const cleanJson = aiResultText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const meta = JSON.parse(cleanJson);
      log(`AI đã nhận diện thành công: "${meta.title}" ${meta.series ? `[Bộ: ${meta.series} - ${meta.volume || ''}]` : ''} của ${meta.author}!`, 'success');

      if (meta.title) document.getElementById('meta-title').value = meta.title;
      if (meta.originalTitle) document.getElementById('meta-original-title').value = meta.originalTitle;
      if (meta.series && document.getElementById('meta-series')) document.getElementById('meta-series').value = meta.series;
      if (meta.volume && document.getElementById('meta-volume')) document.getElementById('meta-volume').value = meta.volume;
      if (meta.author) document.getElementById('meta-author').value = meta.author;
      if (meta.category) document.getElementById('meta-category').value = meta.category;
      if (meta.description) document.getElementById('meta-description').value = meta.description;

      // After AI extracts metadata, use high-speed regex to divide the complete text chapters
      processBookWithRegex(text);
      if (meta.description) parsedBook.description = meta.description;
      if (meta.title) parsedBook.title = meta.title;
      if (meta.author) parsedBook.author = meta.author;
      if (meta.series) parsedBook.series = meta.series;
      if (meta.volume) parsedBook.volume = meta.volume;
      parsedBook.id = slugify(parsedBook.title);
      populateEditor(parsedBook);

    } catch (err) {
      log(`Lỗi AI: ${err.message}. Đang tự động chuyển sang phân tách Regex...`, 'error');
      processBookWithRegex(text);
    }
  }

  // Populate Editor
  function populateEditor(book) {
    document.getElementById('meta-title').value = book.title || '';
    document.getElementById('meta-original-title').value = book.originalTitle || '';
    if (document.getElementById('meta-series')) document.getElementById('meta-series').value = book.series || '';
    if (document.getElementById('meta-volume')) document.getElementById('meta-volume').value = book.volume || '';
    document.getElementById('meta-author').value = book.author || '';
    document.getElementById('meta-translator').value = book.translator || 'Sheepa Translator';
    document.getElementById('meta-category').value = book.category || 'Văn học cổ điển';
    document.getElementById('meta-status').value = book.status || 'ongoing';
    document.getElementById('meta-description').value = book.description || '';

    const listEl = document.getElementById('editor-chapters-list');
    if (!listEl) return;

    listEl.innerHTML = book.chapters.map((chap, idx) => `
      <div class="chapter-accordion">
        <div class="chapter-accordion-header" onclick="this.parentElement.classList.toggle('open')">
          <span>${String(idx + 1).padStart(2, '0')}. ${escapeHtml(chap.title)} ${chap.part ? `<small style="color: var(--studio-muted); margin-left: 0.5rem;">[${escapeHtml(chap.part)}]</small>` : ''}</span>
          <span style="font-size: 0.8rem; color: var(--studio-muted);">▼ Xem & Sửa</span>
        </div>
        <div class="chapter-accordion-body">
          <div class="form-group">
            <label>Tiêu đề chương (H2):</label>
            <input type="text" class="chapter-title-input" data-index="${idx}" value="${escapeHtml(chap.title)}">
          </div>
          <div class="form-group">
            <label>Thuộc phần lớn (H1):</label>
            <input type="text" class="chapter-part-input" data-index="${idx}" value="${escapeHtml(chap.part || '')}" placeholder="Ví dụ: Phần I: Xác Chết Trên Cây">
          </div>
          <div class="form-group">
            <label>Nội dung Markdown chương:</label>
            <textarea class="chapter-content-input" data-index="${idx}" rows="8">${escapeHtml(chap.content || '')}</textarea>
          </div>
        </div>
      </div>
    `).join('');

    // Attach sync inputs
    document.querySelectorAll('.chapter-title-input').forEach(input => {
      input.addEventListener('input', (e) => {
        parsedBook.chapters[e.target.dataset.index].title = e.target.value;
      });
    });
    document.querySelectorAll('.chapter-part-input').forEach(input => {
      input.addEventListener('input', (e) => {
        parsedBook.chapters[e.target.dataset.index].part = e.target.value;
      });
    });
    document.querySelectorAll('.chapter-content-input').forEach(input => {
      input.addEventListener('input', (e) => {
        parsedBook.chapters[e.target.dataset.index].content = e.target.value;
      });
    });
  }

  // --- EXPORT & ZIP PACKAGER ---
  const btnExportZip = document.getElementById('btn-export-zip');
  const btnExportJsonOnly = document.getElementById('btn-export-json-only');

  if (btnExportZip) {
    btnExportZip.addEventListener('click', async () => {
      if (!parsedBook || !parsedBook.chapters || parsedBook.chapters.length === 0) {
        alert('Chưa có dữ liệu sách để xuất! Vui lòng nạp file và phân tích trước.');
        return;
      }

      // Update metadata from inputs
      parsedBook.title = document.getElementById('meta-title').value.trim() || 'Tác Phẩm';
      parsedBook.id = slugify(parsedBook.title);
      parsedBook.originalTitle = document.getElementById('meta-original-title').value.trim();
      parsedBook.series = document.getElementById('meta-series')?.value.trim() || '';
      parsedBook.volume = document.getElementById('meta-volume')?.value.trim() || '';
      parsedBook.author = document.getElementById('meta-author').value.trim();
      parsedBook.translator = document.getElementById('meta-translator').value.trim();
      parsedBook.category = document.getElementById('meta-category').value;
      parsedBook.status = document.getElementById('meta-status').value;
      parsedBook.statusText = parsedBook.status === 'completed' ? 'Hoàn thành' : 'Đang dịch';
      parsedBook.description = document.getElementById('meta-description').value.trim();
      parsedBook.cover = `content/books/${parsedBook.id}/cover.jpg`;

      // Check JSZip
      if (typeof JSZip === 'undefined') {
        alert('Đang tải thư viện đóng gói ZIP, vui lòng đợi 2 giây và bấm lại!');
        return;
      }

      log(`Đang đóng gói toàn bộ thư mục cho sách "${parsedBook.title}" (${parsedBook.chapters.length} chương)...`);
      const zip = new JSZip();

      // 1. Prepare chapter paths
      const chaptersMeta = parsedBook.chapters.map((chap, idx) => {
        const chapFile = `content/books/${parsedBook.id}/chuong-${idx + 1}.md`;
        zip.file(chapFile, chap.content || `# ${chap.title}\n\nĐang cập nhật.`);
        return {
          id: `chuong-${idx + 1}`,
          title: chap.title,
          part: chap.part || '',
          path: chapFile
        };
      });

      // 2. Add Cover image if selected
      if (selectedCoverBlob) {
        zip.file(`content/books/${parsedBook.id}/cover.jpg`, selectedCoverBlob);
      }

      // 3. Merge into books.json
      const bookToSave = {
        id: parsedBook.id,
        title: parsedBook.title,
        originalTitle: parsedBook.originalTitle,
        series: parsedBook.series,
        volume: parsedBook.volume,
        author: parsedBook.author,
        translator: parsedBook.translator,
        year: new Date().getFullYear().toString(),
        category: parsedBook.category,
        status: parsedBook.status,
        statusText: parsedBook.statusText,
        cover: parsedBook.cover,
        icon: "public/icons/11_sheep_magnifier.png",
        description: parsedBook.description,
        downloads: {
          epub: `content/downloads/${parsedBook.id}.epub`,
          pdf: ""
        },
        chapters: chaptersMeta
      };

      // Check if book exists in currentLibraryBooks -> replace or append
      const existingIdx = currentLibraryBooks.findIndex(b => b.id === bookToSave.id);
      if (existingIdx !== -1) {
        currentLibraryBooks[existingIdx] = bookToSave;
      } else {
        currentLibraryBooks.push(bookToSave);
      }

      const updatedJsonText = JSON.stringify(currentLibraryBooks, null, 2);
      zip.file('data/books.json', updatedJsonText);

      // Generate ZIP and trigger download
      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = `sheepa-update-${parsedBook.id}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      log(`Xuất thành công file "${a.download}" (${parsedBook.chapters.length} chương)! Bạn chỉ cần giải nén đè vào thư mục dự án hoặc kéo thả vào GitHub.`, 'success');
    });
  }

  // --- BOOTSTRAP ---
  function init() {
    initTabs();
    initTheme();
    renderKeyTable();
    updateKeySelect();
    loadLibraryBooks();
    log('Sheepa Publisher Studio đã sẵn sàng hoạt động!', 'info');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
