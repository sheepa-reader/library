/**
 * SHEEPA LIBRARY - MAIN APPLICATION ENGINE
 * Minimalist, Fast, GitHub-Pages Native SPA
 */

(function () {
  'use strict';

  // --- STATE ---
  let booksData = [];
  let currentBook = null;
  let currentChapter = null;
  let activeFilter = 'all';
  let searchQuery = '';

  // Reader Settings State
  const readerSettings = {
    fontFamily: localStorage.getItem('sheepa_reader_font') || 'serif',
    fontSize: parseInt(localStorage.getItem('sheepa_reader_size') || '18', 10),
    maxWidth: localStorage.getItem('sheepa_reader_width') || '720px'
  };

  // --- THEME ENGINE ---
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  
  function initTheme() {
    const savedTheme = localStorage.getItem('sheepa_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    setTheme(initialTheme);

    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(nextTheme);
      });
    }

    // Listen for system theme changes if user hasn't explicitly set a preference
    if (!savedTheme && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem('sheepa_theme')) {
          setTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sheepa_theme', theme);
    updateThemeIcon(theme);
  }

  function updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;
    if (theme === 'dark') {
      // Moon / Sun icon
      btn.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
      btn.setAttribute('title', 'Chuyển sang giao diện sáng (Light)');
    } else {
      btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
      btn.setAttribute('title', 'Chuyển sang giao diện tối (Dark)');
    }
  }

  // --- SIMPLE LIGHTWEIGHT MARKDOWN PARSER ---
  function parseMarkdown(mdText) {
    if (!mdText) return '';

    // 1. Tự động sửa lỗi ngắt rơi số chương (e.g. "CHƯƠNG\n2" hoặc "## CHƯƠNG\n2" -> "CHƯƠNG 2")
    let cleanText = mdText
      .replace(/^(?:#*\s*)(CHƯƠNG|HỒI|CHAPTER)\s*[\r\n]+\s*(\d+)/gim, '## $1 $2')
      .replace(/<h[1-6][^>]*>\s*(CHƯƠNG|HỒI|CHAPTER)\s*<br\s*\/?>\s*(?:<span[^>]*>)?\s*(\d+)\s*(?:<\/span>)?\s*<\/h[1-6]>/gi, '<h2>$1 $2</h2>');

    // 2. Tự động loại bỏ tiêu đề chương bị lặp lại 2 lần liên tiếp (e.g. "# CHƯƠNG 2" rồi lại "## CHƯƠNG 2")
    cleanText = cleanText.replace(/(#\s*(?:CHƯƠNG|HỒI|CHAPTER)\s+\d+[^\n]*\n+(?:\*[^\n]+\*\n+)?)\s*(?:##\s*(?:CHƯƠNG|HỒI|CHAPTER)\s+\d+\s*\n+)/gi, '$1\n');

    // 3. Tự động xóa bỏ hoàn toàn dòng chữ thừa "Nội Dung Tác Phẩm"
    cleanText = cleanText.replace(/^[\s\*_]*(?:Nội\s+Dung\s+Tác\s+Phẩm|N\?i\s+Dung\s+T[aá]c\s+Ph[aẩ]m)[\s\*_]*$/gim, '');

    let html = cleanText
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Blockquotes
      .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
      // Bold & Italic
      .replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      // Unordered lists
      .replace(/^\s*\-\s+(.*$)/gim, '<li>$1</li>')
      // Ordered lists
      .replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>')
      // Horizontal rules
      .replace(/^\s*(\-\-\-|\*\*\*)\s*$/gim, '<hr/>');

    // Paragraph wrapping for loose lines
    const lines = html.split(/\n\s*\n/);
    return lines.map(line => {
      line = line.trim();
      if (!line) return '';
      // Loại bỏ nếu là đoạn thừa "Nội Dung Tác Phẩm"
      if (/^(?:<em>|\*|_)?\s*(?:Nội\s+Dung\s+Tác\s+Phẩm|N\?i\s+Dung\s+T[aá]c\s+Ph[aẩ]m)\s*(?:<\/em>|\*|_)?$/i.test(line)) {
        return '';
      }
      if (/^<(h1|h2|h3|blockquote|ul|ol|li|hr)/i.test(line)) {
        return line;
      }
      return `<p>${line.replace(/\n/g, '<br/>')}</p>`;
    }).filter(Boolean).join('\n');
  }

  // --- DATA LOADER (VỚI CƠ CHẾ TỰ CHỮA LỖI CÚ PHÁP AUTO-RECOVERY) ---
  async function loadBooks() {
    try {
      const res = await fetch('data/books.json');
      if (!res.ok) throw new Error('Cannot load books');
      const text = await res.text();
      try {
        booksData = JSON.parse(text);
      } catch (parseErr) {
        console.warn('Phát hiện lỗi cú pháp nhẹ trong books.json, đang tự động khắc phục...', parseErr);
        // Tự động sửa lỗi phổ biến: thừa dấu ngoặc vuông ở cuối, thiếu dấu phẩy giữa các sách
        const fixedText = text
          .replace(/\]\s*\]\s*\}\s*\]\s*$/, ']\n  }\n]')
          .replace(/\]\s*\]\s*$/g, ']')
          .replace(/\}\s*\{/g, '},\n{');
        booksData = JSON.parse(fixedText);
        console.log('Tự động phục hồi thành công! Đã nạp', booksData.length, 'cuốn sách.');
      }
    } catch (e) {
      console.warn('Lỗi tải books.json:', e);
      booksData = [];
    }
  }

  // --- ROUTER & VIEW RENDERING ---
  const app = document.getElementById('app');

  async function handleRoute() {
    const hash = window.location.hash || '#/';
    window.scrollTo(0, 0);

    if (hash === '#/' || hash === '' || hash.startsWith('#/?')) {
      renderLibraryView();
    } else if (hash.startsWith('#/book/')) {
      const bookId = hash.replace('#/book/', '').split('?')[0];
      renderBookDetailView(bookId);
    } else if (hash.startsWith('#/read/')) {
      const parts = hash.replace('#/read/', '').split('/');
      const bookId = parts[0];
      const chapterId = parts[1];
      await renderReaderView(bookId, chapterId);
    } else {
      renderLibraryView();
    }
  }

  // --- VIEW 1: LIBRARY CATALOG ---
  function renderLibraryView() {
    // Show main header
    document.querySelector('.site-header').style.display = 'block';

    const categories = ['all', 'Văn học cổ điển', 'Tiểu thuyết triết lý', 'Triết lý sống'];
    
    // Filter books
    const filteredBooks = booksData.filter(b => {
      const matchFilter = activeFilter === 'all' || 
        b.category === activeFilter || 
        (activeFilter === 'completed' && b.status === 'completed') ||
        (activeFilter === 'ongoing' && b.status === 'ongoing');

      const matchSearch = !searchQuery || 
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.originalTitle.toLowerCase().includes(searchQuery.toLowerCase());

      return matchFilter && matchSearch;
    });

    app.innerHTML = `
      <div class="page-container">
        <!-- Hero Minimalist -->
        <div class="library-hero">
          <img src="public/icons/glyph_01_sheep_reading.png" alt="Sheepa Reading" class="hero-badge-img" onerror="this.style.display='none'">
          <h1>Tủ Sách Tự Dịch Sheepa</h1>
          <p>Không gian lưu trữ và chia sẻ những tác phẩm văn học, triết lý kinh điển do Sheepa chuyển ngữ với tình yêu con chữ.</p>
        </div>

        <!-- Search & Filter Controls -->
        <div class="search-filter-section">
          <div class="search-box-wrapper">
            <img src="public/icons/glyph_11_sheep_magnifier.png" class="search-icon-img" alt="search" onerror="this.style.display='none'">
            <input type="text" id="library-search" class="search-input" placeholder="Tìm theo tên sách, tác giả, tựa gốc..." value="${escapeHtml(searchQuery)}">
          </div>

          <div class="filter-tags">
            <button class="filter-btn ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">Tất cả sách</button>
            <button class="filter-btn ${activeFilter === 'Văn học cổ điển' ? 'active' : ''}" data-filter="Văn học cổ điển">Văn học cổ điển</button>
            <button class="filter-btn ${activeFilter === 'Tiểu thuyết triết lý' ? 'active' : ''}" data-filter="Tiểu thuyết triết lý">Tiểu thuyết triết lý</button>
            <button class="filter-btn ${activeFilter === 'Triết lý sống' ? 'active' : ''}" data-filter="Triết lý sống">Triết lý sống</button>
            <button class="filter-btn ${activeFilter === 'ongoing' ? 'active' : ''}" data-filter="ongoing">Đang dịch</button>
            <button class="filter-btn ${activeFilter === 'completed' ? 'active' : ''}" data-filter="completed">Hoàn thành</button>
          </div>
        </div>

        <!-- Books Grid -->
        <div class="books-grid">
          ${filteredBooks.length > 0 ? filteredBooks.map(book => `
            <div class="book-card" onclick="window.location.hash = '#/book/${book.id}'" style="cursor: pointer;">
              <div class="card-top">
                ${book.cover ? `
                  <img src="${book.cover}" class="book-cover-real" alt="${escapeHtml(book.title)}" onerror="this.onerror=null; this.src='public/icons/01_sheep_reading.png';">
                ` : `
                  <div class="card-icon-frame">
                    <img src="${book.icon || 'public/icons/04_book_stack_horizontal.png'}" alt="${escapeHtml(book.title)}">
                  </div>
                `}
                <div class="card-meta">
                  <h3 class="card-title">${escapeHtml(book.title)}</h3>
                  <div class="card-author">${escapeHtml(book.author)}</div>
                </div>
              </div>

              <!-- Badges Row Underneath (Full Width, Horizontal) -->
              <div class="card-badges-row">
                <span class="badge-tag">${escapeHtml(book.category)}</span>
                ${book.series ? `<span class="badge-tag badge-series">${escapeHtml(book.series)}${book.volume ? ' • ' + escapeHtml(book.volume) : ''}</span>` : ''}
                <span class="badge-status ${book.status}">${book.statusText || 'Đang cập nhật'}</span>
              </div>

              <p class="card-desc">${escapeHtml(book.description)}</p>

              <div class="card-footer">
                <span class="chapter-count">
                  <img src="public/icons/glyph_05_book_open.png" alt="chapters">
                  ${book.chapters.length} chương
                </span>
                <div class="card-actions" onclick="event.stopPropagation();">
                  <a href="#/read/${book.id}/${book.chapters[0]?.id || 'chuong-1'}" class="btn-sm btn-primary">Đọc ngay</a>
                  <a href="#/book/${book.id}" class="btn-sm btn-outline">Chi tiết</a>
                </div>
              </div>
            </div>
          `).join('') : `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-tertiary);">
              <img src="public/icons/15_document_magnifier.png" style="width: 54px; margin-bottom: 1rem; opacity: 0.5;">
              <p>Không tìm thấy cuốn sách nào phù hợp với từ khóa "${escapeHtml(searchQuery)}".</p>
            </div>
          `}
        </div>
      </div>
    `;

    // Event listeners
    const searchInput = document.getElementById('library-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderLibraryView();
        // Keep focus
        const nextInput = document.getElementById('library-search');
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
        }
      });
    }

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter;
        renderLibraryView();
      });
    });
  }

  // --- VIEW 2: BOOK DETAIL ---
  function renderBookDetailView(bookId) {
    document.querySelector('.site-header').style.display = 'block';

    const book = booksData.find(b => b.id === bookId);
    if (!book) {
      app.innerHTML = `
        <div class="page-container" style="text-align: center; padding: 5rem 1rem;">
          <h2>Không tìm thấy cuốn sách này</h2>
          <p style="color: var(--text-secondary); margin: 1rem 0 2rem;">Sách bạn đang tìm có thể chưa được xuất bản hoặc đường dẫn không đúng.</p>
          <a href="#/" class="btn-lg btn-primary">← Về thư viện sách</a>
        </div>
      `;
      return;
    }

    currentBook = book;
    const firstChapterId = book.chapters[0]?.id || 'chuong-1';

    app.innerHTML = `
      <div class="page-container">
        <!-- Back Navigation -->
        <div class="back-nav-bar">
          <a href="#/" class="back-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Quay lại Thư viện
          </a>
        </div>

        <!-- Header Card -->
        <div class="book-detail-header">
          <div class="detail-cover-box">
            ${book.cover ? `
              <img src="${book.cover}" class="detail-cover-real" alt="${escapeHtml(book.title)}" onerror="this.onerror=null; this.src='public/icons/01_sheep_reading.png';">
            ` : `
              <img src="${book.icon || 'public/icons/01_sheep_reading.png'}" alt="${escapeHtml(book.title)}">
              <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-tertiary);">${book.year || ''}</span>
            `}
          </div>
          <div class="detail-info">
            ${book.series ? `
              <div class="detail-series-banner">
                📖 Bộ sách: <strong>${escapeHtml(book.series)}</strong> ${book.volume ? '— ' + escapeHtml(book.volume) : ''}
              </div>
            ` : ''}
            <div class="detail-badges">
              <span class="badge-tag">${escapeHtml(book.category)}</span>
              <span class="badge-status ${book.status}">${book.statusText || 'Đang dịch'}</span>
            </div>
            <h1 class="detail-title">${escapeHtml(book.title)}</h1>
            <div class="detail-original-title">${escapeHtml(book.originalTitle)}</div>

            <div class="detail-specs-grid">
              <div class="spec-item">
                <strong>Tác giả gốc</strong>
                <span>${escapeHtml(book.author)}</span>
              </div>
              <div class="spec-item">
                <strong>Người dịch</strong>
                <span>${escapeHtml(book.translator)}</span>
              </div>
              <div class="spec-item">
                <strong>Quy mô</strong>
                <span>${book.chapters.length} chương</span>
              </div>
            </div>

            <div class="detail-actions">
              <a href="#/read/${book.id}/${firstChapterId}" class="btn-lg btn-primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Bắt đầu đọc (Chương 1)
              </a>
              <button class="btn-lg btn-outline" id="btn-open-download-modal">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Tải sách về
              </button>
            </div>
          </div>
        </div>

        <!-- Description Section -->
        <div class="detail-blurb-box">
          <h2 class="section-heading">
            <img src="public/icons/09_quill_inkwell.png" alt="Intro">
            Giới thiệu & Lời tựa
          </h2>
          <p>${escapeHtml(book.description)}</p>
        </div>

        <!-- Chapters Table of Contents -->
        <div class="detail-toc-box">
          <h2 class="section-heading">
            <img src="public/icons/glyph_10_bookshelf.png" alt="TOC">
            Mục lục các chương (${book.chapters.length})
          </h2>
          <div class="toc-list">
            ${renderHierarchicalToc(book)}
          </div>
        </div>
      </div>
    `;

    // Modal Download Event
    const downloadBtn = document.getElementById('btn-open-download-modal');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => openDownloadModal(book));
    }
  }

  // --- VIEW 3: ZEN READER ---
  async function renderReaderView(bookId, chapterId) {
    // Hide standard site header to create ultra-clean reading immersion
    document.querySelector('.site-header').style.display = 'none';

    const book = booksData.find(b => b.id === bookId);
    if (!book) {
      window.location.hash = '#/';
      return;
    }

    currentBook = book;
    const chapterIndex = book.chapters.findIndex(c => c.id === chapterId);
    const chapter = chapterIndex !== -1 ? book.chapters[chapterIndex] : book.chapters[0];
    currentChapter = chapter;

    const prevChapter = chapterIndex > 0 ? book.chapters[chapterIndex - 1] : null;
    const nextChapter = chapterIndex < book.chapters.length - 1 ? book.chapters[chapterIndex + 1] : null;

    // Load Chapter Markdown Content
    let contentHtml = '<p>Đang tải nội dung chương...</p>';
    try {
      const res = await fetch(chapter.path);
      if (res.ok) {
        const mdText = await res.text();
        contentHtml = parseMarkdown(mdText);
      } else {
        contentHtml = `<p>Không thể tải nội dung file ${chapter.path}. Vui lòng thử lại sau.</p>`;
      }
    } catch (e) {
      contentHtml = `<p>Nội dung chương đang được chuẩn bị.</p>`;
    }

    app.innerHTML = `
      <div class="reader-view">
        <!-- Scroll Progress Bar -->
        <div class="reader-progress-bar-container">
          <div class="reader-progress-bar" id="reader-progress"></div>
        </div>

        <!-- Sticky Reader Nav -->
        <div class="reader-nav">
          <div class="reader-nav-inner">
            <a href="#/book/${book.id}" class="icon-btn" title="Quay lại mục lục sách">
              <svg viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            </a>

            <div class="reader-title-info">
              <span class="reader-book-name">${escapeHtml(book.title)}</span>
              <span class="reader-chapter-name">${escapeHtml(chapter.title)}</span>
            </div>

            <div class="reader-tools">
              <button class="icon-btn" id="reader-toc-toggle-btn" title="Mục lục chương">
                <svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
              </button>
              <button class="icon-btn" id="reader-settings-btn" title="Tùy chỉnh cỡ chữ / font">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              </button>
              <button class="icon-btn" id="reader-theme-btn" title="Đổi màu nền ngày/đêm">
                <svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Reading Article -->
        <main class="reader-article-container" style="max-width: ${readerSettings.maxWidth};">
          <article class="reader-content" id="reader-body" style="font-family: var(--font-${readerSettings.fontFamily}); font-size: ${readerSettings.fontSize}px;">
            ${contentHtml}
          </article>

          <!-- Footer Navigation (Prev / Next Chapter) -->
          <div class="reader-footer-nav">
            ${prevChapter ? `
              <a href="#/read/${book.id}/${prevChapter.id}" class="reader-nav-btn">
                ← Chương trước
              </a>
            ` : `
              <button class="reader-nav-btn" disabled>← Chương trước</button>
            `}

            <a href="#/book/${book.id}" class="reader-nav-btn btn-outline" style="font-size: 0.85rem;">
              Mục lục sách
            </a>

            ${nextChapter ? `
              <a href="#/read/${book.id}/${nextChapter.id}" class="reader-nav-btn btn-primary">
                Chương sau →
              </a>
            ` : `
              <button class="reader-nav-btn" disabled>Hết chương</button>
            `}
          </div>
        </main>

        <!-- Quick Settings Drawer -->
        <div class="settings-drawer" id="reader-settings-drawer">
          <div class="setting-row">
            <span>Font chữ:</span>
            <div class="btn-group">
              <button class="btn-group-item ${readerSettings.fontFamily === 'serif' ? 'active' : ''}" id="font-serif-btn">Serif</button>
              <button class="btn-group-item ${readerSettings.fontFamily === 'sans' ? 'active' : ''}" id="font-sans-btn">Sans</button>
            </div>
          </div>
          <div class="setting-row">
            <span>Cỡ chữ:</span>
            <div class="btn-group">
              <button class="btn-group-item" id="font-decrease-btn">A -</button>
              <span style="padding: 0.35rem 0.6rem; font-size: 0.82rem; font-weight: 600;" id="font-size-label">${readerSettings.fontSize}px</span>
              <button class="btn-group-item" id="font-increase-btn">A +</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Reading Scroll Progress
    const progressBar = document.getElementById('reader-progress');
    const updateProgress = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollHeight > 0 ? (window.scrollY / scrollHeight) * 100 : 0;
      if (progressBar) progressBar.style.width = `${progress}%`;
    };
    window.addEventListener('scroll', updateProgress);

    // Reading Drawer Settings Events
    const settingsBtn = document.getElementById('reader-settings-btn');
    const settingsDrawer = document.getElementById('reader-settings-drawer');
    if (settingsBtn && settingsDrawer) {
      settingsBtn.addEventListener('click', () => {
        settingsDrawer.classList.toggle('active');
      });
    }

    const readerBody = document.getElementById('reader-body');
    const fontSerifBtn = document.getElementById('font-serif-btn');
    const fontSansBtn = document.getElementById('font-sans-btn');
    const fontIncBtn = document.getElementById('font-increase-btn');
    const fontDecBtn = document.getElementById('font-decrease-btn');
    const fontSizeLabel = document.getElementById('font-size-label');

    if (fontSerifBtn && fontSansBtn) {
      fontSerifBtn.addEventListener('click', () => {
        readerSettings.fontFamily = 'serif';
        localStorage.setItem('sheepa_reader_font', 'serif');
        readerBody.style.fontFamily = 'var(--font-serif)';
        fontSerifBtn.classList.add('active');
        fontSansBtn.classList.remove('active');
      });

      fontSansBtn.addEventListener('click', () => {
        readerSettings.fontFamily = 'sans';
        localStorage.setItem('sheepa_reader_font', 'sans');
        readerBody.style.fontFamily = 'var(--font-sans)';
        fontSansBtn.classList.add('active');
        fontSerifBtn.classList.remove('active');
      });
    }

    if (fontIncBtn && fontDecBtn) {
      fontIncBtn.addEventListener('click', () => {
        if (readerSettings.fontSize < 28) {
          readerSettings.fontSize += 1;
          localStorage.setItem('sheepa_reader_size', readerSettings.fontSize);
          readerBody.style.fontSize = `${readerSettings.fontSize}px`;
          fontSizeLabel.textContent = `${readerSettings.fontSize}px`;
        }
      });
      fontDecBtn.addEventListener('click', () => {
        if (readerSettings.fontSize > 14) {
          readerSettings.fontSize -= 1;
          localStorage.setItem('sheepa_reader_size', readerSettings.fontSize);
          readerBody.style.fontSize = `${readerSettings.fontSize}px`;
          fontSizeLabel.textContent = `${readerSettings.fontSize}px`;
        }
      });
    }

    // Reader theme button
    const readerThemeBtn = document.getElementById('reader-theme-btn');
    if (readerThemeBtn) {
      readerThemeBtn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        setTheme(cur === 'dark' ? 'light' : 'dark');
      });
    }

    // Reader TOC Drawer
    const tocBtn = document.getElementById('reader-toc-toggle-btn');
    if (tocBtn) {
      tocBtn.addEventListener('click', () => openTocDrawer(book, chapter.id));
    }

    // Keyboard Arrow Navigation (Left = Prev, Right = Next)
    const handleKeyNav = (e) => {
      if (e.key === 'ArrowLeft' && prevChapter) {
        window.location.hash = `#/read/${book.id}/${prevChapter.id}`;
      } else if (e.key === 'ArrowRight' && nextChapter) {
        window.location.hash = `#/read/${book.id}/${nextChapter.id}`;
      }
    };
    window.addEventListener('keydown', handleKeyNav, { once: true });
  }

  // --- HIERARCHICAL TOC RENDERER (H1 Parts -> H2 Chapters) ---
  function renderHierarchicalToc(book, currentChapId = null, isDrawer = false) {
    const hasParts = book.chapters.some(c => c.part && c.part !== 'Nội Dung Tác Phẩm' && !c.part.toLowerCase().includes('nội dung'));
    if (!hasParts) {
      return book.chapters.map((chap, idx) => `
        <a href="#/read/${book.id}/${chap.id}" class="toc-item-link" style="${currentChapId === chap.id ? 'background: var(--bg-hover); font-weight: 700;' : ''}" ${isDrawer ? 'onclick="document.getElementById(\'toc-modal\').classList.remove(\'active\');"' : ''}>
          <div>
            <span class="toc-index">${String(idx + 1).padStart(2, '0')}</span>
            <span>${escapeHtml(chap.title)}</span>
          </div>
          <span class="toc-arrow">→</span>
        </a>
      `).join('');
    }

    let currentPart = null;
    let html = '';
    book.chapters.forEach((chap, idx) => {
      const rawPart = chap.part || '';
      const isFakePart = !rawPart || rawPart === 'Nội Dung Tác Phẩm' || rawPart.toLowerCase().includes('nội dung');
      if (!isFakePart && rawPart !== currentPart) {
        currentPart = rawPart;
        html += `<div class="toc-group-header">📂 ${escapeHtml(rawPart)}</div>`;
      }
      const isActive = currentChapId === chap.id ? 'background: var(--bg-hover); font-weight: 700;' : '';
      html += `
        <a href="#/read/${book.id}/${chap.id}" class="toc-item-link ${!isFakePart ? 'toc-sub-item' : ''}" style="${isActive}" ${isDrawer ? 'onclick="document.getElementById(\'toc-modal\').classList.remove(\'active\');"' : ''}>
          <div>
            <span class="toc-index">${String(idx + 1).padStart(2, '0')}</span>
            <span>${escapeHtml(chap.title)}</span>
          </div>
          <span class="toc-arrow">→</span>
        </a>
      `;
    });
    return html;
  }

  // --- DOWNLOAD MODAL (EPUB & PDF ONLY) ---
  function openDownloadModal(book) {
    let modal = document.getElementById('download-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'download-modal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    const hasEpub = Boolean(book.downloads?.epub);
    const hasPdf = Boolean(book.downloads?.pdf);

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Tải sách "${escapeHtml(book.title)}"</h3>
          <button class="icon-btn" id="btn-close-modal" style="width: 32px; height: 32px;">✕</button>
        </div>
        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
          Chọn định dạng sách điện tử hoặc tài liệu đọc offline:
        </p>

        <!-- EPUB Option -->
        ${hasEpub ? `
          <a href="${book.downloads.epub}" download="${book.id}.epub" class="download-option-btn">
            <div>
              <div style="font-weight: 700;">Sách Điện Tử (.EPUB)</div>
              <div style="font-size: 0.78rem; color: var(--text-tertiary);">Định dạng chuẩn cho Kindle, Apple Books, Kobo, Boox</div>
            </div>
            <span class="download-badge">TẢI VỀ</span>
          </a>
        ` : `
          <div class="download-option-btn" style="opacity: 0.55; cursor: not-allowed;">
            <div>
              <div style="font-weight: 700;">Sách Điện Tử (.EPUB)</div>
              <div style="font-size: 0.78rem; color: var(--text-tertiary);">Đang được biên tập và xuất bản</div>
            </div>
            <span class="badge-tag">SẮP CÓ</span>
          </div>
        `}

        <!-- PDF Option -->
        ${hasPdf ? `
          <a href="${book.downloads.pdf}" download="${book.id}.pdf" class="download-option-btn">
            <div>
              <div style="font-weight: 700;">Tài Liệu Đọc In (.PDF)</div>
              <div style="font-size: 0.78rem; color: var(--text-tertiary);">Bố cục trang in chuẩn cho máy tính và máy tính bảng</div>
            </div>
            <span class="download-badge">TẢI VỀ</span>
          </a>
        ` : `
          <div class="download-option-btn" style="opacity: 0.55; cursor: not-allowed;">
            <div>
              <div style="font-weight: 700;">Tài Liệu Đọc In (.PDF)</div>
              <div style="font-size: 0.78rem; color: var(--text-tertiary);">Đang hoàn thiện định dạng trang in</div>
            </div>
            <span class="badge-tag">SẮP CÓ</span>
          </div>
        `}
      </div>
    `;

    modal.classList.add('active');

    // Close events
    const closeBtn = document.getElementById('btn-close-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    }
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }

  // --- TOC DRAWER FOR READER ---
  function openTocDrawer(book, currentChapId) {
    let modal = document.getElementById('toc-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'toc-modal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-content" style="max-height: 80vh; display: flex; flex-direction: column;">
        <div class="modal-header">
          <h3>Mục lục các chương (${book.chapters.length})</h3>
          <button class="icon-btn" id="btn-close-toc" style="width: 32px; height: 32px;">✕</button>
        </div>
        <div class="toc-list" style="overflow-y: auto; flex: 1;">
          ${renderHierarchicalToc(book, currentChapId, true)}
        </div>
      </div>
    `;

    modal.classList.add('active');
    const closeBtn = document.getElementById('btn-close-toc');
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }

  // --- UTILS ---
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // --- BOOTSTRAP ---
  async function init() {
    initTheme();
    await loadBooks();
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
