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
  let activeTagFilter = 'all';
  let activeStatusFilter = 'all';
  let currentSort = 'date-desc'; // 'date-desc' | 'date-asc' | 'title-asc' | 'author-asc'
  let currentPage = 1;
  const BOOKS_PER_PAGE = 9;
  let randomizedTags = [];
  let viewMode = localStorage.getItem('sheepa_view_mode') || 'grid'; // 'grid' | 'list'
  let searchQuery = '';

  function formatDisplayDate(dateStr) {
    if (!dateStr) return '05/11/2026';
    const parts = String(dateStr).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }

  // Quotes Repository State
  let quotesData = [
    { quote: "Những điều cốt yếu thì vô hình đối với mắt trần. Chỉ có trái tim mới thấy rõ.", author: "Antoine de Saint-Exupéry", work: "Hoàng Tử Bé" },
    { quote: "Một người đọc sách sống cả ngàn cuộc đời trước khi chết. Người không bao giờ đọc chỉ sống một cuộc đời.", author: "George R.R. Martin" },
    { quote: "Sách là phép màu di động độc nhất vô nhị.", author: "Stephen King" },
    { quote: "Không có người bạn nào trung thành và kiên nhẫn như một cuốn sách.", author: "Ernest Hemingway" },
    { quote: "Đọc sách là trò chuyện với những bộ óc kiệt xuất nhất của các thế kỷ đã qua.", author: "René Descartes" },
    { quote: "Thiên đường, tôi luôn thầm tưởng tượng, chắc chắn sẽ là một thư viện vô tận.", author: "Jorge Luis Borges" },
    { quote: "Chúng ta đọc để biết rằng tâm hồn mình không hề cô độc giữa thế gian.", author: "C.S. Lewis" },
    { quote: "Căn phòng không có sách giống như một thân thể thiếu vắng linh hồn.", author: "Cicero" },
    { quote: "Dịch thuật là chiếc cầu nối bằng ánh sáng, mang con chữ vượt qua khoảng cách của ngôn từ và thời gian.", author: "Sheepa Library" },
    { quote: "Nếu bạn chỉ đọc những cuốn sách mọi người đang đọc, bạn chỉ có thể nghĩ những gì mọi người đang nghĩ.", author: "Haruki Murakami" },
    { quote: "Thế giới là một cuốn sách mở, và người không đi chỉ đọc được đúng một trang.", author: "Thánh Augustin" },
    { quote: "Một cuốn sách hay trên kệ là người bạn hiền lặng lẽ chờ ta mở lòng.", author: "Tục ngữ Hy Lạp" },
    { quote: "Chữ nghĩa là con thuyền không đáy chở ước mơ con người qua những đại dương của thời gian.", author: "Francis Bacon" },
    { quote: "Mỗi trang sách mở ra là một bầu trời mới thức giấc trong tâm tưởng.", author: "Victor Hugo" },
    { quote: "Đọc một cuốn sách hay giống như tìm được một bến đỗ bình yên giữa dòng đời cuộn chảy.", author: "Lâm Ngữ Đường" },
    { quote: "Khi một cuốn sách khép lại, câu chuyện thực ra chỉ mới bắt đầu sống trong lòng người đọc.", author: "Neil Gaiman" },
    { quote: "Không có chiếc tàu nào đưa ta đi xa như một trang sách, cũng không có chiến mã nào phi nhanh bằng những vần thơ.", author: "Emily Dickinson" }
  ];
  let currentQuoteIndex = -1;

  // Reader Settings State
  let savedWidth = localStorage.getItem('sheepa_reader_width') || '740';
  if (typeof savedWidth === 'string') savedWidth = savedWidth.replace('px', '');
  const readerSettings = {
    fontFamily: localStorage.getItem('sheepa_reader_font') || 'serif',
    fontSize: parseInt(localStorage.getItem('sheepa_reader_size') || '18', 10),
    lineHeight: parseFloat(localStorage.getItem('sheepa_reader_line_height') || '1.8'),
    maxWidth: parseInt(savedWidth || '740', 10),
    dropCap: localStorage.getItem('sheepa_reader_dropcap') !== 'false'
  };

  // --- THEME ENGINE (3 CHẾ ĐỘ: SÁNG - GIẤY CŨ - TỐI) ---
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  
  function initTheme() {
    const savedTheme = localStorage.getItem('sheepa_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    setTheme(initialTheme);

    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        let nextTheme = 'sepia';
        if (currentTheme === 'light') nextTheme = 'sepia';
        else if (currentTheme === 'sepia') nextTheme = 'dark';
        else nextTheme = 'light';
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
    updateReaderDrawerTheme(theme);
  }

  function updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    const readerBtn = document.getElementById('reader-theme-btn');
    const icons = {
      light: {
        html: `<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
        title: 'Giao diện Sáng (Bấm để đổi sang Giấy Cũ)'
      },
      sepia: {
        html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`,
        title: 'Giao diện Giấy Cũ (Bấm để đổi sang Nền Tối)'
      },
      dark: {
        html: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
        title: 'Giao diện Nền Tối (Bấm để đổi sang Nền Sáng)'
      }
    };

    const cur = icons[theme] || icons.light;
    if (btn) {
      btn.innerHTML = cur.html;
      btn.setAttribute('title', cur.title);
    }
    if (readerBtn) {
      readerBtn.innerHTML = cur.html;
      readerBtn.setAttribute('title', cur.title);
    }
  }

  function updateReaderDrawerTheme(theme) {
    const lightBtn = document.getElementById('reader-theme-light-btn');
    const sepiaBtn = document.getElementById('reader-theme-sepia-btn');
    const darkBtn = document.getElementById('reader-theme-dark-btn');
    if (lightBtn && sepiaBtn && darkBtn) {
      lightBtn.classList.toggle('active', theme === 'light');
      sepiaBtn.classList.toggle('active', theme === 'sepia');
      darkBtn.classList.toggle('active', theme === 'dark');
    }
  }

  // --- HEADER CONTROLS (TAG FILTER, STATUS FILTER, VIEW MODE TOGGLE) ---
  function initHeaderControls() {
    const tagSelect = document.getElementById('header-tag-filter');
    const statusSelect = document.getElementById('header-status-filter');
    const viewToggleBtn = document.getElementById('header-view-toggle-btn');

    if (tagSelect) {
      tagSelect.addEventListener('change', (e) => {
        activeTagFilter = e.target.value;
        currentPage = 1;
        randomizeQuote();
        const currentHash = window.location.hash || '';
        if (currentHash.startsWith('#/book/') || currentHash.startsWith('#/read/')) {
          window.location.hash = '#/';
        } else {
          renderLibraryView();
        }
      });
    }

    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        activeStatusFilter = e.target.value;
        currentPage = 1;
        randomizeQuote();
        const currentHash = window.location.hash || '';
        if (currentHash.startsWith('#/book/') || currentHash.startsWith('#/read/')) {
          window.location.hash = '#/';
        } else {
          renderLibraryView();
        }
      });
    }

    if (viewToggleBtn) {
      updateViewToggleUI();
      viewToggleBtn.addEventListener('click', () => {
        viewMode = viewMode === 'grid' ? 'list' : 'grid';
        localStorage.setItem('sheepa_view_mode', viewMode);
        updateViewToggleUI();
        randomizeQuote();
        const currentHash = window.location.hash || '';
        if (currentHash === '' || currentHash === '#/' || currentHash.startsWith('#/?')) {
          renderLibraryView();
        }
      });
    }
  }

  function updateViewToggleUI() {
    const viewToggleBtn = document.getElementById('header-view-toggle-btn');
    const viewToggleIcon = document.getElementById('header-view-toggle-icon');
    if (!viewToggleBtn || !viewToggleIcon) return;

    if (viewMode === 'list') {
      viewToggleIcon.src = 'public/icons/glyph_10_bookshelf.png';
      viewToggleBtn.setAttribute('title', 'Chuyển sang chế độ Lưới (Grid view)');
      viewToggleBtn.setAttribute('aria-label', 'Chuyển sang chế độ Lưới');
    } else {
      viewToggleIcon.src = 'public/icons/glyph_12_sheep_book_lines.png';
      viewToggleBtn.setAttribute('title', 'Chuyển sang chế độ Danh sách (List view)');
      viewToggleBtn.setAttribute('aria-label', 'Chuyển sang chế độ Danh sách');
    }
  }

  function setTagFilter(tagName) {
    activeTagFilter = tagName;
    currentPage = 1;
    randomizeQuote();
    const headerTagSelect = document.getElementById('header-tag-filter');
    if (headerTagSelect) headerTagSelect.value = tagName;
    const currentHash = window.location.hash || '';
    if (currentHash.startsWith('#/book/') || currentHash.startsWith('#/read/')) {
      window.location.hash = '#/';
    } else {
      renderLibraryView();
    }
  }
  window.setTagFilter = setTagFilter;

  function resetAllFilters() {
    activeTagFilter = 'all';
    activeStatusFilter = 'all';
    searchQuery = '';
    currentSort = 'date-desc';
    currentPage = 1;
    randomizeQuote();
    const headerTagSelect = document.getElementById('header-tag-filter');
    if (headerTagSelect) headerTagSelect.value = 'all';
    const headerStatusSelect = document.getElementById('header-status-filter');
    if (headerStatusSelect) headerStatusSelect.value = 'all';
    const searchInput = document.getElementById('library-search');
    if (searchInput) searchInput.value = '';
    renderLibraryView();
  }
  window.resetAllFilters = resetAllFilters;

  // --- QUOTES & TAGLINES ENGINE (KHO LƯU TRỮ & RANDOM TAGLINE DƯỚI HERO) ---
  function formatQuoteHtml(item) {
    if (!item) return '';
    if (item.author === 'Sheepa Library' && item.work === 'Tủ Sách Tự Dịch') {
      return `<span class="tagline-quote tagline-intro">${escapeHtml(item.quote)}</span>`;
    }

    let meta = '';
    if (item.author && item.work) {
      meta = `${escapeHtml(item.author)} • ${escapeHtml(item.work)}`;
    } else if (item.author) {
      meta = escapeHtml(item.author);
    } else if (item.work) {
      meta = escapeHtml(item.work);
    }

    const quoteHtml = `<span class="tagline-quote">"${escapeHtml(item.quote)}"</span>`;
    const metaHtml = meta ? `<span class="tagline-author">${meta}</span>` : '';
    return `${quoteHtml}${metaHtml}`;
  }

  async function loadQuotes() {
    try {
      const res = await fetch('data/quotes.json');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          quotesData = data;
        }
      }
    } catch (e) {
      console.warn('Dùng danh sách trích dẫn mặc định:', e);
    }
  }

  function randomizeQuote() {
    if (quotesData.length === 0) return;

    let nextIndex;
    if (quotesData.length === 1) {
      nextIndex = 0;
    } else {
      do {
        nextIndex = Math.floor(Math.random() * quotesData.length);
      } while (nextIndex === currentQuoteIndex);
    }
    currentQuoteIndex = nextIndex;
    const item = quotesData[nextIndex];

    const taglineEl = document.getElementById('hero-dynamic-tagline');
    if (taglineEl) {
      taglineEl.classList.add('fade-out');
      setTimeout(() => {
        taglineEl.innerHTML = formatQuoteHtml(item);
        taglineEl.classList.remove('fade-out');
      }, 250);
    }
  }

  function initQuoteEvents() {
    const taglineEl = document.getElementById('hero-dynamic-tagline');
    const mascotBtn = document.getElementById('hero-mascot-btn');
    if (taglineEl) {
      taglineEl.addEventListener('click', randomizeQuote);
    }
    if (mascotBtn) {
      mascotBtn.addEventListener('click', randomizeQuote);
    }
  }

  // --- SIMPLE LIGHTWEIGHT MARKDOWN PARSER ---
  function parseMarkdown(mdText) {
    if (!mdText) return '';
    let text = mdText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 1. Tự động khắc phục lỗi ngắt rơi số chương (ví dụ 'CHƯƠNG\n2' -> 'CHƯƠNG 2')
    text = text.replace(/((?:^|\n)[#\*_]*[ \t]*(?:CHƯƠNG|HỒI|CHAPTER|Phần)[ \t]*)[ \t]*\n+[ \t]*(\d+)/gi, '$1 $2')
               .replace(/<h[1-6][^>]*>\s*(CHƯƠNG|HỒI|CHAPTER)\s*<br\s*\/?>\s*(?:<span[^>]*>)?\s*(\d+)\s*(?:<\/span>)?\s*<\/h[1-6]>/gi, '<h2>$1 $2</h2>');

    // 2. Tự động xóa hoàn toàn dòng chữ thừa 'Nội Dung Tác Phẩm' hoặc 'Nội Dung'
    text = text.replace(/^[ \t]*[\*_]*[ \t]*(?:Nội\s+Dung(?:\s+Tác\s+Phẩm)?|Tác\s+Phẩm)[ \t]*[\*_]*[ \t]*$/gim, '');

    // 3. Tách các dòng để loại bỏ tiêu đề chương bị lặp lại hoặc số chương mồ côi ở đầu nội dung
    const rawLines = text.split('\n');
    let firstHeadingTitle = '';
    const cleanedLines = [];
    let foundFirstHeading = false;

    for (let i = 0; i < rawLines.length; i++) {
      const rawLine = rawLines[i];
      const trimmed = rawLine.trim();

      if (!trimmed && cleanedLines.length === 0) continue;

      if (/^[\*_]*[ \t]*(?:Nội\s+Dung(?:\s+Tác\s+Phẩm)?|Tác\s+Phẩm)[ \t]*[\*_]*$/i.test(trimmed)) {
        continue;
      }

      if (!foundFirstHeading && trimmed.startsWith('# ')) {
        firstHeadingTitle = trimmed.replace(/^#+\s*/, '').trim().toLowerCase();
        cleanedLines.push(rawLine);
        foundFirstHeading = true;
        continue;
      }

      if (foundFirstHeading && cleanedLines.length < 6) {
        const lineWithoutMd = trimmed.replace(/^[#\*_\s]+|[#\*_\s]+$/g, '').trim().toLowerCase();
        // Bỏ qua nếu là tiêu đề bị lặp lại (e.g. '## CHƯƠNG 2' ngay dưới '# CHƯƠNG 2')
        if (lineWithoutMd && (lineWithoutMd === firstHeadingTitle || (firstHeadingTitle.startsWith('chương ') && lineWithoutMd === firstHeadingTitle))) {
          continue;
        }
        // Bỏ qua nếu là số thứ tự mồ côi (e.g. '2' đứng một mình ngay sau header)
        if (/^\d{1,3}$/.test(lineWithoutMd) && /chương\s*\d+/i.test(firstHeadingTitle)) {
          continue;
        }
      }

      cleanedLines.push(rawLine);
    }

    let cleanText = cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

    let html = cleanText
      // Centered shorthand: -> Text <-
      .replace(/^->\s*(.+?)\s*<-$/gim, '<p align="center">$1</p>')
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

    // Paragraph wrapping for loose lines with smart Drop Cap assignment
    const pLines = html.split(/\n\s*\n/);
    let hasAssignedDropCap = false;
    let foundFirstNarrative = false;

    return pLines.map(line => {
      line = line.trim();
      if (!line) return '';
      if (/^(?:<em>|\*|_)?\s*(?:Nội\s+Dung(?:\s+Tác\s+Phẩm)?|Tác\s+Phẩm)\s*(?:<\/em>|\*|_)?$/i.test(line)) {
        return '';
      }
      if (/^<(h[1-6]|blockquote|ul|ol|li|hr|div|center)/i.test(line)) {
        return line;
      }
      if (/^<p\b[^>]*\balign=/i.test(line)) {
        return line;
      }

      // Check for chapter subtitle / metadata BEFORE hitting the first narrative paragraph
      if (!foundFirstNarrative) {
        const plainText = line.replace(/<[^>]+>/g, '').trim();
        // Regex detecting timestamp / day of week / chapter metadata
        const isDateTimePattern = /^(?:(?:Thứ\s+(?:Hai|Ba|Tư|Năm|Sáu|Bảy)|Chủ\s*nhật|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Ngày|Tháng)\b[\w\s,.:\/-]*|\d{1,2}[:h]\d{2}(?:[:\s]\d{2})?(?:\s*(?:AM|PM|am|pm|phút|giờ))?|.*(?:giờ\s*\d+\s*phút).*)$/i.test(plainText);
        const isPartOrCourse = /^(?:Món\s+thứ|Phần\s+|Hồi\s+|Chương\s+|Quyển\s+|Tập\s+|Act\s+|Scene\s+)/i.test(plainText) && plainText.length < 120;
        const isItalicSubtitle = /^<em>[^<]+<\/em>$/i.test(line) && plainText.length < 150;

        if (isDateTimePattern || isPartOrCourse || isItalicSubtitle) {
          return `<p class="chapter-subtitle">${line}</p>`;
        }
      }

      // First narrative body paragraph gets drop cap
      foundFirstNarrative = true;

      if (!hasAssignedDropCap) {
        hasAssignedDropCap = true;
        return `<p class="has-dropcap">${line.replace(/\n/g, '<br/>')}</p>`;
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

  function trackPageView(path, title) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: path || window.location.hash || '#/',
        page_title: title || document.title,
        page_location: window.location.href
      });
    }
  }

  async function handleRoute() {
    const hash = window.location.hash || '#/';
    window.scrollTo(0, 0);
    randomizeQuote();

    if (hash === '#/' || hash === '' || hash.startsWith('#/?')) {
      if (hash.includes('?tag=')) {
        const tagParam = decodeURIComponent(hash.split('?tag=')[1] || '').split('&')[0];
        if (tagParam) activeTagFilter = tagParam;
      }
      document.title = 'Sheepa Library — Tủ Sách Tự Dịch';
      renderLibraryView();
      trackPageView(hash, document.title);
    } else if (hash.startsWith('#/book/')) {
      const bookId = hash.replace('#/book/', '').split('?')[0];
      renderBookDetailView(bookId);
      trackPageView(hash, document.title);
    } else if (hash.startsWith('#/read/')) {
      const parts = hash.replace('#/read/', '').split('/');
      const bookId = parts[0];
      const chapterId = parts[1];
      await renderReaderView(bookId, chapterId);
      trackPageView(hash, document.title);
    } else {
      document.title = 'Sheepa Library — Tủ Sách Tự Dịch';
      renderLibraryView();
      trackPageView(hash, document.title);
    }
  }

  function renderPagination(curPage, totalP) {
    if (totalP <= 1) return '';

    let pages = [];
    if (totalP <= 7) {
      for (let i = 1; i <= totalP; i++) pages.push(i);
    } else {
      if (curPage <= 4) {
        pages = [1, 2, 3, 4, 5, '...', totalP];
      } else if (curPage >= totalP - 3) {
        pages = [1, '...', totalP - 4, totalP - 3, totalP - 2, totalP - 1, totalP];
      } else {
        pages = [1, '...', curPage - 1, curPage, curPage + 1, '...', totalP];
      }
    }

    return `
      <div class="pagination-container">
        <button class="pagination-btn pagination-prev" ${curPage === 1 ? 'disabled' : ''} data-page="${curPage - 1}" title="Trang trước" aria-label="Trang trước">
          ‹
        </button>
        ${pages.map(p => {
          if (p === '...') {
            return `<span class="pagination-ellipsis">…</span>`;
          }
          return `
            <button class="pagination-btn ${p === curPage ? 'active' : ''}" data-page="${p}" aria-label="Trang ${p}">
              ${p}
            </button>
          `;
        }).join('')}
        <button class="pagination-btn pagination-next" ${curPage === totalP ? 'disabled' : ''} data-page="${curPage + 1}" title="Trang sau" aria-label="Trang sau">
          ›
        </button>
      </div>
    `;
  }

  // --- VIEW 1: LIBRARY CATALOG ---
  function renderLibraryView() {
    // Show main header
    document.querySelector('.site-header').style.display = 'block';

    // Tự động thu thập toàn bộ các tag thể loại từ tất cả các cuốn sách
    const allTags = Array.from(new Set(
      booksData.flatMap(b => Array.isArray(b.tags) && b.tags.length > 0 ? b.tags : (b.category ? b.category.split(/[•,&/]/).map(s => s.trim()) : []))
    )).filter(Boolean);

    // Đồng bộ dropdown thể loại trên header
    const headerTagSelect = document.getElementById('header-tag-filter');
    if (headerTagSelect) {
      const currentSelected = activeTagFilter;
      headerTagSelect.innerHTML = `
        <option value="all">Tất cả thể loại</option>
        ${allTags.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
      `;
      headerTagSelect.value = currentSelected;
    }

    // Đồng bộ dropdown trạng thái trên header
    const headerStatusSelect = document.getElementById('header-status-filter');
    if (headerStatusSelect) {
      headerStatusSelect.value = activeStatusFilter;
    }

    // Đồng bộ trạng thái nút chuyển Grid / List
    updateViewToggleUI();

    // Lọc sách client-side: Tags + Trạng thái + Tìm kiếm
    const filteredBooks = booksData.filter(b => {
      const bTags = Array.isArray(b.tags) && b.tags.length > 0 
        ? b.tags 
        : (b.category ? b.category.split(/[•,&/]/).map(s => s.trim()) : []);

      // 1. Lọc theo thể loại (tag)
      const matchTag = activeTagFilter === 'all' || 
        bTags.some(t => t.toLowerCase() === activeTagFilter.toLowerCase()) || 
        (b.category && b.category.toLowerCase().includes(activeTagFilter.toLowerCase()));

      // 2. Lọc theo trạng thái
      let matchStatus = true;
      if (activeStatusFilter === 'completed') {
        matchStatus = b.status === 'completed' || (b.statusText && b.statusText.toLowerCase().includes('hoàn thành'));
      } else if (activeStatusFilter === 'ongoing') {
        matchStatus = b.status === 'ongoing' || (b.statusText && b.statusText.toLowerCase().includes('đang'));
      } else if (activeStatusFilter === 'new') {
        matchStatus = b.status === 'new' || b.status === 'new_project' || b.status === 'planned' || (b.statusText && b.statusText.toLowerCase().includes('mới'));
      }

      // 3. Lọc theo từ khóa tìm kiếm
      const matchSearch = !searchQuery || 
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bTags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (b.originalTitle && b.originalTitle.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchTag && matchStatus && matchSearch;
    });

    // Sắp xếp sách theo tiêu chí đã chọn
    filteredBooks.sort((a, b) => {
      if (currentSort === 'date-desc') {
        const dateA = a.publishedAt || a.createdAt || '2020-01-01';
        const dateB = b.publishedAt || b.createdAt || '2020-01-01';
        return dateB.localeCompare(dateA);
      }
      if (currentSort === 'date-asc') {
        const dateA = a.publishedAt || a.createdAt || '2020-01-01';
        const dateB = b.publishedAt || b.createdAt || '2020-01-01';
        return dateA.localeCompare(dateB);
      }
      if (currentSort === 'title-asc') {
        return a.title.localeCompare(b.title, 'vi');
      }
      if (currentSort === 'author-asc') {
        return a.author.localeCompare(b.author, 'vi');
      }
      return 0;
    });

    // Phân trang 9 cuốn mỗi trang
    const totalPages = Math.ceil(filteredBooks.length / BOOKS_PER_PAGE) || 1;
    if (currentPage > totalPages) currentPage = 1;
    const pagedBooks = filteredBooks.slice((currentPage - 1) * BOOKS_PER_PAGE, currentPage * BOOKS_PER_PAGE);

    // Hàng tag dưới thanh tìm kiếm: chỉ bố trí 1 hàng duy nhất, random các tag
    if (randomizedTags.length === 0) {
      const shuffled = [...allTags].sort(() => 0.5 - Math.random());
      randomizedTags = shuffled.slice(0, 6);
    }
    let displayTags = [...randomizedTags];
    if (activeTagFilter !== 'all' && !displayTags.includes(activeTagFilter)) {
      displayTags.unshift(activeTagFilter);
    }

    const currentQuote = currentQuoteIndex >= 0 && quotesData[currentQuoteIndex]
      ? quotesData[currentQuoteIndex]
      : quotesData[0];
    const heroQuoteHtml = formatQuoteHtml(currentQuote);

    app.innerHTML = `
      <div class="page-container">
        <!-- Hero Minimalist with Dynamic Quote / Tagline -->
        <div class="library-hero">
          <img src="public/icons/glyph_01_sheep_reading.png" alt="Sheepa Reading" class="hero-badge-img" id="hero-mascot-btn" title="Bấm để đổi câu trích dẫn / tagline ngẫu nhiên" style="cursor: pointer;">
          <h1>Tủ Sách Tự Dịch Sheepa</h1>
          <div class="hero-tagline" id="hero-dynamic-tagline" title="Bấm để đổi câu ngẫu nhiên" style="cursor: pointer;">${heroQuoteHtml}</div>
        </div>

        <!-- Search & Filter Controls -->
        <div class="search-filter-section">
          <div class="search-box-wrapper">
            <img src="public/icons/glyph_11_sheep_magnifier.png" class="search-icon-img" alt="search" onerror="this.style.display='none'">
            <input type="text" id="library-search" class="search-input" placeholder="Tìm theo tên sách, tác giả, thể loại, tựa gốc..." value="${escapeHtml(searchQuery)}">
          </div>

          <!-- Single-row randomized tags -->
          <div class="filter-tags">
            <button class="filter-btn ${activeTagFilter === 'all' && activeStatusFilter === 'all' ? 'active' : ''}" data-filter-tag="all">Tất cả sách</button>
            ${displayTags.map(tag => `
              <button class="filter-btn ${activeTagFilter === tag ? 'active' : ''}" data-filter-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>
            `).join('')}
          </div>
        </div>

        <!-- Toolbar (Count & Sort) -->
        <div class="library-toolbar">
          <div class="toolbar-info">
            Hiển thị <strong>${filteredBooks.length > 0 ? (currentPage - 1) * BOOKS_PER_PAGE + 1 : 0} - ${Math.min(currentPage * BOOKS_PER_PAGE, filteredBooks.length)}</strong> trên tổng số <strong>${filteredBooks.length}</strong> cuốn
          </div>
          <div class="sort-select-wrapper">
            <span class="sort-label">Sắp xếp:</span>
            <select id="library-sort-select" class="sort-select" aria-label="Sắp xếp sách">
              <option value="date-desc" ${currentSort === 'date-desc' ? 'selected' : ''}>Ngày đăng tải (Mới nhất)</option>
              <option value="date-asc" ${currentSort === 'date-asc' ? 'selected' : ''}>Ngày đăng tải (Cũ nhất)</option>
              <option value="title-asc" ${currentSort === 'title-asc' ? 'selected' : ''}>Tên sách (A → Z)</option>
              <option value="author-asc" ${currentSort === 'author-asc' ? 'selected' : ''}>Tên tác giả (A → Z)</option>
            </select>
          </div>
        </div>

        <!-- Books Container (Grid or List View) -->
        <div class="books-grid ${viewMode === 'list' ? 'list-view' : ''}">
          ${pagedBooks.length > 0 ? pagedBooks.map(book => {
            const bTags = Array.isArray(book.tags) && book.tags.length > 0 ? book.tags : (book.category ? book.category.split(/[•,&/]/).map(s => s.trim()) : ['Văn học']);
            
            // Chế độ xem Danh sách (List View)
            if (viewMode === 'list') {
              return `
                <div class="book-card" onclick="window.location.hash = '#/book/${book.id}'" style="cursor: pointer;">
                  <div class="card-top">
                    ${book.cover ? `
                      <img src="${book.cover}" class="book-cover-real" alt="${escapeHtml(book.title)}" onerror="this.onerror=null; this.src='public/icons/01_sheep_reading.png';">
                    ` : `
                      <div class="card-icon-frame">
                        <img src="${book.icon || 'public/icons/04_book_stack_horizontal.png'}" alt="${escapeHtml(book.title)}">
                      </div>
                    `}
                  </div>

                  <div class="card-content-wrap">
                    <div class="card-meta">
                      <h3 class="card-title">${escapeHtml(book.title)}</h3>
                      <div class="card-author">${escapeHtml(book.author)}</div>
                    </div>

                    <div class="card-badges-row">
                      ${bTags.map(t => `
                        <span class="badge-tag" onclick="event.stopPropagation(); setTagFilter('${escapeHtml(t)}');" title="Lọc theo '${escapeHtml(t)}'">${escapeHtml(t)}</span>
                      `).join('')}
                      ${book.series ? `<span class="badge-tag badge-series">${escapeHtml(book.series)}${book.volume ? ' • ' + escapeHtml(book.volume) : ''}</span>` : ''}
                      <span class="badge-status ${book.status}">${book.statusText || 'Đang cập nhật'}</span>
                    </div>

                    <p class="card-desc">${escapeHtml(book.description)}</p>
                  </div>

                  <div class="card-footer" onclick="event.stopPropagation();">
                    <span class="chapter-count">
                      <img src="public/icons/glyph_05_book_open.png" alt="chapters">
                      ${book.chapters.length} chương
                    </span>
                    <div class="card-actions">
                      <a href="#/read/${book.id}/${book.chapters[0]?.id || 'chuong-1'}" class="btn-sm btn-primary">Đọc ngay</a>
                      <a href="#/book/${book.id}" class="btn-sm btn-outline">Chi tiết</a>
                    </div>
                  </div>
                </div>
              `;
            }

            // Chế độ xem Lưới (Grid View - Mặc định)
            return `
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

                <!-- Badges Row Underneath (Full Width, Horizontal Tags) -->
                <div class="card-badges-row">
                  ${bTags.map(t => `
                    <span class="badge-tag" onclick="event.stopPropagation(); setTagFilter('${escapeHtml(t)}');" title="Lọc các sách theo tag '${escapeHtml(t)}'">${escapeHtml(t)}</span>
                  `).join('')}
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
            `;
          }).join('') : `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-tertiary);">
              <img src="public/icons/15_document_magnifier.png" style="width: 54px; margin-bottom: 1rem; opacity: 0.5;">
              <p>Không tìm thấy cuốn sách nào phù hợp với bộ lọc hiện tại.</p>
              <button class="btn-sm btn-outline" style="margin-top: 1rem;" onclick="resetAllFilters()">Xóa bộ lọc & Xem tất cả</button>
            </div>
          `}
        </div>

        <!-- Pagination Controls (< 1 2 ... >) -->
        ${renderPagination(currentPage, totalPages)}
      </div>
    `;

    // Event listeners
    const searchInput = document.getElementById('library-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        currentPage = 1;
        renderLibraryView();
        // Keep focus
        const nextInput = document.getElementById('library-search');
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
        }
      });
    }

    // Sort listener in toolbar
    const librarySortSelect = document.getElementById('library-sort-select');
    if (librarySortSelect) {
      librarySortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        currentPage = 1;
        renderLibraryView();
      });
    }

    // Pagination Click Listeners
    document.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.page, 10);
        if (!isNaN(p) && p >= 1 && p <= totalPages && p !== currentPage) {
          currentPage = p;
          renderLibraryView();
          document.querySelector('.search-filter-section')?.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    document.querySelectorAll('[data-filter-tag]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTagFilter = btn.dataset.filterTag;
        const headerTagSelect = document.getElementById('header-tag-filter');
        if (headerTagSelect) headerTagSelect.value = activeTagFilter;
        if (activeTagFilter === 'all') {
          activeStatusFilter = 'all';
          const headerStatusSelect = document.getElementById('header-status-filter');
          if (headerStatusSelect) headerStatusSelect.value = 'all';
        }
        renderLibraryView();
      });
    });

    document.querySelectorAll('[data-filter-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeStatusFilter = btn.dataset.filterStatus;
        const headerStatusSelect = document.getElementById('header-status-filter');
        if (headerStatusSelect) headerStatusSelect.value = activeStatusFilter;
        renderLibraryView();
      });
    });

    // Click on Hero Tagline or Mascot to randomize quote
    const heroTagline = document.getElementById('hero-dynamic-tagline');
    const heroMascot = document.getElementById('hero-mascot-btn');
    if (heroTagline) heroTagline.addEventListener('click', randomizeQuote);
    if (heroMascot) heroMascot.addEventListener('click', randomizeQuote);
  }

  // --- VIEW 2: BOOK DETAIL ---
  function renderBookDetailView(bookId) {
    document.querySelector('.site-header').style.display = 'block';

    const book = booksData.find(b => b.id === bookId);
    if (!book) {
      document.title = 'Không tìm thấy sách — Sheepa Library';
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
    document.title = `${book.title} — Sheepa Library`;
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
              ${(Array.isArray(book.tags) && book.tags.length > 0 ? book.tags : (book.category ? book.category.split(/[•,&/]/).map(s => s.trim()) : ['Văn học'])).map(t => `
                <span class="badge-tag" style="cursor: pointer;" onclick="window.location.hash = '#/?tag=' + encodeURIComponent('${escapeHtml(t)}');" title="Xem các sách có tag '${escapeHtml(t)}'">${escapeHtml(t)}</span>
              `).join('')}
              <span class="badge-status ${book.status}">${book.statusText || 'Đang dịch'}</span>
            </div>
            <h1 class="detail-title">${escapeHtml(book.title)}</h1>
            <div class="detail-original-title">${escapeHtml(book.originalTitle)}</div>

            <div class="detail-specs-grid">
              <div class="spec-item">
                <strong>Tác giả</strong>
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
              <div class="spec-item">
                <strong>Ngày đăng tải</strong>
                <span>${formatDisplayDate(book.publishedAt || book.createdAt)}</span>
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
    document.title = `${chapter.title} — ${book.title} | Sheepa Reader`;
    trackPageView(window.location.hash, document.title);

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

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';

    app.innerHTML = `
      <div class="reader-view">
        <!-- Scroll Progress Bar -->
        <div class="reader-progress-bar-container">
          <div class="reader-progress-bar" id="reader-progress"></div>
        </div>

        <!-- Sticky Reader Nav -->
        <div class="reader-nav">
          <div class="reader-nav-inner">
            <div style="display: flex; align-items: center; gap: 0.35rem;">
              <a href="#/book/${book.id}" class="icon-btn" title="Quay lại mục lục sách">
                <svg viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              </a>
              ${prevChapter ? `
                <a href="#/read/${book.id}/${prevChapter.id}" class="icon-btn" title="Chương trước: ${escapeHtml(prevChapter.title)}">
                  <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </a>
              ` : `
                <button class="icon-btn" disabled style="opacity: 0.3; cursor: not-allowed;" title="Đã là chương đầu tiên">
                  <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
              `}
            </div>

            <div class="reader-title-info">
              <span class="reader-book-name">${escapeHtml(book.title)}</span>
              <span class="reader-chapter-name">${escapeHtml(chapter.title)}</span>
            </div>

            <div class="reader-tools">
              ${nextChapter ? `
                <a href="#/read/${book.id}/${nextChapter.id}" class="icon-btn" title="Chương sau: ${escapeHtml(nextChapter.title)}">
                  <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </a>
              ` : `
                <button class="icon-btn" disabled style="opacity: 0.3; cursor: not-allowed;" title="Đã là chương cuối cùng">
                  <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              `}
              <button class="icon-btn" id="reader-toc-toggle-btn" title="Mục lục chương">
                <svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
              </button>
              <button class="icon-btn" id="reader-settings-btn" title="Tùy chỉnh cỡ chữ / font / dãn dòng">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              </button>
              <button class="icon-btn" id="reader-theme-btn" title="Đổi màu nền ngày/đêm/giấy cũ">
                <svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Reading Article -->
        <main class="reader-article-container" style="max-width: ${readerSettings.maxWidth}px;">
          <article class="reader-content ${readerSettings.dropCap ? 'enable-dropcap' : ''}" id="reader-body" style="font-family: var(--font-${readerSettings.fontFamily}); font-size: ${readerSettings.fontSize}px; line-height: ${readerSettings.lineHeight};">
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
            <span>Nền đọc:</span>
            <div class="btn-group">
              <button class="btn-group-item ${currentTheme === 'light' ? 'active' : ''}" id="reader-theme-light-btn" title="Nền trắng sáng">Sáng</button>
              <button class="btn-group-item ${currentTheme === 'sepia' ? 'active' : ''}" id="reader-theme-sepia-btn" title="Nền giấy cũ dịu mắt">Giấy cũ</button>
              <button class="btn-group-item ${currentTheme === 'dark' ? 'active' : ''}" id="reader-theme-dark-btn" title="Nền tối ban đêm">Tối</button>
            </div>
          </div>
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
              <button class="btn-group-item" id="font-decrease-btn" title="Giảm cỡ chữ">A -</button>
              <span style="padding: 0.35rem 0.6rem; font-size: 0.82rem; font-weight: 600;" id="font-size-label">${readerSettings.fontSize}px</span>
              <button class="btn-group-item" id="font-increase-btn" title="Tăng cỡ chữ">A +</button>
            </div>
          </div>
          <div class="setting-row">
            <span>Dãn dòng:</span>
            <div class="btn-group">
              <button class="btn-group-item" id="line-height-dec-btn" title="Giảm khoảng cách dòng">↕ -</button>
              <span style="padding: 0.35rem 0.6rem; font-size: 0.82rem; font-weight: 600;" id="line-height-label">${readerSettings.lineHeight.toFixed(1)}</span>
              <button class="btn-group-item" id="line-height-inc-btn" title="Tăng khoảng cách dòng">↕ +</button>
            </div>
          </div>
          <div class="setting-row">
            <span>Độ rộng:</span>
            <div class="btn-group">
              <button class="btn-group-item" id="width-dec-btn" title="Thu hẹp khung đọc">↔ -</button>
              <span style="padding: 0.35rem 0.6rem; font-size: 0.82rem; font-weight: 600;" id="width-label">${readerSettings.maxWidth}px</span>
              <button class="btn-group-item" id="width-inc-btn" title="Mở rộng khung đọc">↔ +</button>
            </div>
          </div>
          <div class="setting-row">
            <span>Đầu chương:</span>
            <div class="btn-group">
              <button class="btn-group-item ${readerSettings.dropCap ? 'active' : ''}" id="dropcap-on-btn" title="Bật chữ hoa đầu chương phóng to nghệ thuật">Drop Cap</button>
              <button class="btn-group-item ${!readerSettings.dropCap ? 'active' : ''}" id="dropcap-off-btn" title="Chữ thường chuẩn">Thường</button>
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

    // Line Height Controls
    const lineDecBtn = document.getElementById('line-height-dec-btn');
    const lineIncBtn = document.getElementById('line-height-inc-btn');
    const lineHeightLabel = document.getElementById('line-height-label');

    if (lineDecBtn && lineIncBtn && lineHeightLabel) {
      lineDecBtn.addEventListener('click', () => {
        if (readerSettings.lineHeight > 1.45) {
          readerSettings.lineHeight = Math.round((readerSettings.lineHeight - 0.1) * 10) / 10;
          localStorage.setItem('sheepa_reader_line_height', readerSettings.lineHeight);
          readerBody.style.lineHeight = readerSettings.lineHeight;
          lineHeightLabel.textContent = readerSettings.lineHeight.toFixed(1);
        }
      });
      lineIncBtn.addEventListener('click', () => {
        if (readerSettings.lineHeight < 2.35) {
          readerSettings.lineHeight = Math.round((readerSettings.lineHeight + 0.1) * 10) / 10;
          localStorage.setItem('sheepa_reader_line_height', readerSettings.lineHeight);
          readerBody.style.lineHeight = readerSettings.lineHeight;
          lineHeightLabel.textContent = readerSettings.lineHeight.toFixed(1);
        }
      });
    }

    // Reading Width Controls
    const widthDecBtn = document.getElementById('width-dec-btn');
    const widthIncBtn = document.getElementById('width-inc-btn');
    const widthLabel = document.getElementById('width-label');
    const readerContainer = document.querySelector('.reader-article-container');

    if (widthDecBtn && widthIncBtn && widthLabel) {
      widthDecBtn.addEventListener('click', () => {
        if (readerSettings.maxWidth > 580) {
          readerSettings.maxWidth -= 60;
          localStorage.setItem('sheepa_reader_width', readerSettings.maxWidth);
          if (readerContainer) readerContainer.style.maxWidth = `${readerSettings.maxWidth}px`;
          widthLabel.textContent = `${readerSettings.maxWidth}px`;
        }
      });
      widthIncBtn.addEventListener('click', () => {
        if (readerSettings.maxWidth < 1060) {
          readerSettings.maxWidth += 60;
          localStorage.setItem('sheepa_reader_width', readerSettings.maxWidth);
          if (readerContainer) readerContainer.style.maxWidth = `${readerSettings.maxWidth}px`;
          widthLabel.textContent = `${readerSettings.maxWidth}px`;
        }
      });
    }

    // Drop Cap Controls
    const dropCapOnBtn = document.getElementById('dropcap-on-btn');
    const dropCapOffBtn = document.getElementById('dropcap-off-btn');
    if (dropCapOnBtn && dropCapOffBtn && readerBody) {
      dropCapOnBtn.addEventListener('click', () => {
        readerSettings.dropCap = true;
        localStorage.setItem('sheepa_reader_dropcap', 'true');
        dropCapOnBtn.classList.add('active');
        dropCapOffBtn.classList.remove('active');
        readerBody.classList.add('enable-dropcap');
      });
      dropCapOffBtn.addEventListener('click', () => {
        readerSettings.dropCap = false;
        localStorage.setItem('sheepa_reader_dropcap', 'false');
        dropCapOffBtn.classList.add('active');
        dropCapOnBtn.classList.remove('active');
        readerBody.classList.remove('enable-dropcap');
      });
    }

    // Drawer Theme Selection Buttons
    const drawerThemeLight = document.getElementById('reader-theme-light-btn');
    const drawerThemeSepia = document.getElementById('reader-theme-sepia-btn');
    const drawerThemeDark = document.getElementById('reader-theme-dark-btn');

    if (drawerThemeLight && drawerThemeSepia && drawerThemeDark) {
      drawerThemeLight.addEventListener('click', () => setTheme('light'));
      drawerThemeSepia.addEventListener('click', () => setTheme('sepia'));
      drawerThemeDark.addEventListener('click', () => setTheme('dark'));
    }

    // Reader theme button (cycles through light -> sepia -> dark)
    const readerThemeBtn = document.getElementById('reader-theme-btn');
    if (readerThemeBtn) {
      readerThemeBtn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        let nextTheme = 'sepia';
        if (cur === 'light') nextTheme = 'sepia';
        else if (cur === 'sepia') nextTheme = 'dark';
        else nextTheme = 'light';
        setTheme(nextTheme);
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

  // --- DOWNLOAD PASSCODE CONFIGURATION ---
  let downloadPasscodes = ['thesheepa', 'sheepa', 'sheepa2024', 'sheepa2025', 'sheepa2026'];
  let libraryTelegramUrl = 'https://t.me/thesheepa';

  async function loadLibrarySettings() {
    try {
      const res = await fetch('data/settings.json');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.downloadPasscodes) && data.downloadPasscodes.length > 0) {
          downloadPasscodes = data.downloadPasscodes.map(c => String(c).trim().toLowerCase());
        }
        if (data.telegramUrl) {
          libraryTelegramUrl = data.telegramUrl;
        }
      }
    } catch (e) {
      // Dùng danh sách mã mặc định
    }
  }

  function isDownloadUnlocked(book) {
    if (localStorage.getItem('sheepa_download_unlocked') === 'true') return true;
    if (book && localStorage.getItem(`sheepa_unlocked_${book.id}`) === 'true') return true;
    return false;
  }

  // --- DOWNLOAD MODAL (EPUB & PDF WITH PASSCODE LOCK) ---
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
    const isUnlocked = isDownloadUnlocked(book);

    let lockBoxHtml = '';
    if (!isUnlocked) {
      lockBoxHtml = `
        <div class="download-lock-box">
          <div class="lock-icon-badge">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <div style="font-weight: 700; font-size: 1.05rem; margin-bottom: 0.35rem;">Khu vực tải sách có mã khóa</div>
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.5;">
            Vui lòng nhập mã mở khóa để tải toàn bộ tài liệu (.EPUB & .PDF) của cuốn sách này:
          </div>
          <form id="download-passcode-form" class="passcode-input-group" onsubmit="return false;">
            <input type="password" id="download-passcode-input" placeholder="Nhập mã truy cập..." autocomplete="off">
            <button type="submit" class="btn-primary" id="btn-unlock-download">Mở khóa</button>
          </form>
          <div id="passcode-error-msg" class="passcode-error-msg" style="display: none;"></div>
          <div class="passcode-hint">
            Chưa có mã khóa? Nhận mã mở khóa miễn phí tại <a href="${libraryTelegramUrl}" target="_blank" rel="noopener">Telegram @thesheepa</a>
          </div>
        </div>
      `;
    } else {
      lockBoxHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.1rem; background: var(--bg-secondary); padding: 0.6rem 0.9rem; border-radius: 8px; border: 1px solid var(--border-color);">
          <div class="unlocked-status-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Đã mở khóa tải sách thành viên
          </div>
          <button class="btn-relock" id="btn-relock-downloads" title="Khóa lại chức năng tải để bảo mật">Khóa lại</button>
        </div>
      `;
    }

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Tải sách "${escapeHtml(book.title)}"</h3>
          <button class="icon-btn" id="btn-close-modal" style="width: 32px; height: 32px;">✕</button>
        </div>

        ${lockBoxHtml}

        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem;">
          Chọn định dạng sách điện tử hoặc tài liệu đọc offline:
        </p>

        <!-- EPUB Option -->
        ${hasEpub ? (
          isUnlocked ? `
            <a href="${book.downloads.epub}" download="${book.id}.epub" class="download-option-btn">
              <div>
                <div style="font-weight: 700;">Sách Điện Tử (.EPUB)</div>
                <div style="font-size: 0.78rem; color: var(--text-tertiary);">Định dạng chuẩn cho Kindle, Apple Books, Kobo, Boox</div>
              </div>
              <span class="download-badge">TẢI VỀ</span>
            </a>
          ` : `
            <div class="download-option-btn download-locked-btn" id="btn-locked-epub" style="cursor: pointer;" title="Vui lòng nhập mã khóa ở trên để mở tải">
              <div>
                <div style="font-weight: 700;">Sách Điện Tử (.EPUB)</div>
                <div style="font-size: 0.78rem; color: var(--text-tertiary);">Định dạng chuẩn cho Kindle, Apple Books, Kobo, Boox</div>
              </div>
              <span class="badge-tag" style="background: var(--bg-hover); color: var(--text-secondary);">🔒 CẦN MÃ KHÓA</span>
            </div>
          `
        ) : `
          <div class="download-option-btn" style="opacity: 0.55; cursor: not-allowed;">
            <div>
              <div style="font-weight: 700;">Sách Điện Tử (.EPUB)</div>
              <div style="font-size: 0.78rem; color: var(--text-tertiary);">Đang được biên tập và xuất bản</div>
            </div>
            <span class="badge-tag">SẮP CÓ</span>
          </div>
        `}

        <!-- PDF Option -->
        ${hasPdf ? (
          isUnlocked ? `
            <a href="${book.downloads.pdf}" download="${book.id}.pdf" class="download-option-btn">
              <div>
                <div style="font-weight: 700;">Tài Liệu Đọc In (.PDF)</div>
                <div style="font-size: 0.78rem; color: var(--text-tertiary);">Bố cục trang in chuẩn cho máy tính và máy tính bảng</div>
              </div>
              <span class="download-badge">TẢI VỀ</span>
            </a>
          ` : `
            <div class="download-option-btn download-locked-btn" id="btn-locked-pdf" style="cursor: pointer;" title="Vui lòng nhập mã khóa ở trên để mở tải">
              <div>
                <div style="font-weight: 700;">Tài Liệu Đọc In (.PDF)</div>
                <div style="font-size: 0.78rem; color: var(--text-tertiary);">Bố cục trang in chuẩn cho máy tính và máy tính bảng</div>
              </div>
              <span class="badge-tag" style="background: var(--bg-hover); color: var(--text-secondary);">🔒 CẦN MÃ KHÓA</span>
            </div>
          `
        ) : `
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

    // Passcode Form Submit & Validation
    const passForm = document.getElementById('download-passcode-form');
    const passInput = document.getElementById('download-passcode-input');
    const passError = document.getElementById('passcode-error-msg');
    const relockBtn = document.getElementById('btn-relock-downloads');
    const lockedEpub = document.getElementById('btn-locked-epub');
    const lockedPdf = document.getElementById('btn-locked-pdf');

    if (passForm && passInput) {
      passForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const entered = (passInput.value || '').trim().toLowerCase();
        if (!entered) {
          if (passError) {
            passError.textContent = 'Vui lòng nhập mã khóa.';
            passError.style.display = 'block';
          }
          passInput.focus();
          return;
        }

        const bookCode = (book.downloadPasscode || '').trim().toLowerCase();
        const isMatch = downloadPasscodes.includes(entered) || (bookCode && entered === bookCode);

        if (isMatch) {
          localStorage.setItem('sheepa_download_unlocked', 'true');
          // Refresh modal to unlocked state immediately
          openDownloadModal(book);
        } else {
          if (passError) {
            passError.textContent = 'Mã khóa không chính xác. Hãy kiểm tra lại hoặc liên hệ Telegram @thesheepa.';
            passError.style.display = 'block';
          }
          passInput.style.borderColor = '#e53e3e';
          passInput.select();
        }
      });
    }

    if (relockBtn) {
      relockBtn.addEventListener('click', () => {
        localStorage.removeItem('sheepa_download_unlocked');
        openDownloadModal(book);
      });
    }

    if (lockedEpub) {
      lockedEpub.addEventListener('click', () => {
        if (passInput) {
          passInput.focus();
          passInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
    if (lockedPdf) {
      lockedPdf.addEventListener('click', () => {
        if (passInput) {
          passInput.focus();
          passInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
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
    initHeaderControls();
    initQuoteEvents();
    await Promise.all([loadBooks(), loadQuotes(), loadLibrarySettings()]);
    randomizeQuote();
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
