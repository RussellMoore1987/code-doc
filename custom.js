// Custom JavaScript for DevDocs

// @versioning
// * update JS with versioning to prevent caching issues. look for '?v=' in index.html

/* ============================================================
   GRAPHIC NOVEL / COMIC BOOK VIEWER
   BEGIN
============================================================ */

(function () {

'use strict';

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------

const GN_LS_PREFIX     = 'gn-progress-';
const GN_ZOOM_MIN      = 0.25;
const GN_ZOOM_MAX      = 1.0;
const GN_ZOOM_STEP     = 0.25;
const GN_MODAL_ID      = 'gn-viewer-modal';

// ------------------------------------------------------------
// State
// ------------------------------------------------------------

const gn = {
    // View state
    isOpen:       false,
    isLibrary:    true,
    books:        [],
    currentBook:  null,
    currentPage:  0,        // 0-indexed
    viewMode:     'single', // single | double | triple | scroll
    zoom:         1.0,
    tocOpen:      false,
    lastFocused:  null,
    _scrollTracker:  null,
    magnifyOn:       false,
    _magnifierMove:  null,
    _magnifierLeave: null,
    _bmHideTimer:    null,
    // DOM refs (populated after modal is built)
    modal:        null,
    refs:         {},
};

// ------------------------------------------------------------
// Book Discovery / HTML Parsing
// ------------------------------------------------------------

/** Discovers and parses all .graphic-novel-book elements in the document. */
function gnDiscoverBooks() {
    const bookEls = document.querySelectorAll('.graphic-novel-book');
    gn.books = Array.from(bookEls).map(gnParseBook).filter(Boolean);
}

/** Parses a single .graphic-novel-book element into a plain object. */
function gnParseBook(el) {
    const id = el.dataset.bookId;
    if (!id) return null;

    const titleEl     = el.querySelector('.book-title');
    const descEl      = el.querySelector('.book-description');
    const coverImg    = el.querySelector('.book-cover img');
    const bookPagesEl = el.querySelector('.book-pages');

    // Accept both <img> (image pages) and <div data-page-src> (text pages)
    const pages = bookPagesEl
        ? Array.from(bookPagesEl.children)
              .filter((c) => c.tagName === 'IMG' || c.dataset.pageSrc)
              .map((c) => c.tagName === 'IMG'
                  ? { type: 'image', src: c.getAttribute('src') || '', alt: c.getAttribute('alt') || '' }
                  : { type: 'text',  src: c.dataset.pageSrc || '',    alt: c.getAttribute('alt') || '' }
              )
        : [];

    if (!titleEl || !descEl || !coverImg || !pages.length) return null;

    const chapters = Array.from(el.querySelectorAll('.book-chapter')).map((ch) => ({
        name:    ch.textContent.trim(),
        page:    Math.max(1, parseInt(ch.dataset.page, 10) || 1),
    }));

    return {
        id,
        type:        el.dataset.bookType || 'image',
        title:       titleEl.textContent.trim(),
        description: descEl.textContent.trim(),
        author:      el.querySelector('.book-author')?.textContent.trim() || '',
        year:        el.querySelector('.book-year')?.textContent.trim()   || '',
        genre:       el.querySelector('.book-genre')?.textContent.trim()  || '',
        coverSrc:    coverImg.getAttribute('src') || '',
        coverAlt:    coverImg.getAttribute('alt') || '',
        pages,
        chapters,
    };
}

// ------------------------------------------------------------
// Modal Management
// ------------------------------------------------------------

/** Builds the full modal DOM and appends it to <body>. Called once. */
function gnBuildModal() {
    if (document.getElementById(GN_MODAL_ID)) return; // already built

    const overlay = document.createElement('div');
    overlay.id = GN_MODAL_ID;
    overlay.className = 'gn-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Graphic Novel Viewer');
    overlay.setAttribute('aria-hidden', 'true');

    overlay.innerHTML = `
      <div class="gn-modal">

        <!-- Top bar (shared by both views) -->
        <div class="gn-modal-bar" id="gn-modal-bar">
          <div class="gn-modal-bar-left">
            <button class="gn-btn gn-hidden" id="gn-back-to-library"
                    aria-label="Back to Library"
                    data-tooltip="Back to Library">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none"
                   stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Library
            </button>
            <span class="gn-bar-book-title gn-hidden" id="gn-bar-book-title"></span>
          </div>
          <button class="gn-modal-close" id="gn-modal-close"
                  aria-label="Close Graphic Novel Viewer"
                  data-tooltip="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- Library view -->
        <div id="gn-library" class="gn-library">
          <div class="gn-library-header">
            <h3>Graphic Novel Library</h3>
            <p>Select a book below to start reading.</p>
          </div>
          <ul id="gn-book-grid" class="gn-book-grid"
               aria-label="Available graphic novels"></ul>
        </div>

        <!-- Reader view (hidden until a book is opened) -->
        <div id="gn-reader" class="gn-reader gn-hidden">

          <!-- Reader toolbar -->
          <div class="gn-reader-toolbar" id="gn-reader-toolbar" role="toolbar" aria-label="Reader controls">

            <!-- Navigation group -->
            <div class="gn-toolbar-group">
              <button class="gn-icon-btn" id="gn-first-page"
                      aria-label="First page" data-tooltip="First Page" title="First page">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="19" y1="20" x2="9" y2="12"/><line x1="9" y1="12" x2="19" y2="4"/>
                  <line x1="5" y1="19" x2="5" y2="5"/>
                </svg>
              </button>
              <button class="gn-icon-btn" id="gn-prev-page"
                      aria-label="Previous page" data-tooltip="Previous Page (←)" title="Previous page">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>

              <div class="gn-page-counter" aria-live="polite" aria-atomic="true">
                <input type="text" class="gn-page-input" id="gn-page-input"
                       min="1" aria-label="Go to page" title="Go to page"/>
                <span>&nbsp;/&nbsp;</span>
                <span id="gn-total-pages">0</span>
              </div>

              <button class="gn-icon-btn" id="gn-next-page"
                      aria-label="Next page" data-tooltip="Next Page (→)" title="Next page">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
              <button class="gn-icon-btn" id="gn-last-page"
                      aria-label="Last page" data-tooltip="Last Page" title="Last page">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="5" y1="20" x2="15" y2="12"/><line x1="15" y1="12" x2="5" y2="4"/>
                  <line x1="19" y1="19" x2="19" y2="5"/>
                </svg>
              </button>
            </div>

            <div class="gn-toolbar-sep"></div>

            <!-- View mode group -->
            <div class="gn-toolbar-group">
              <button class="gn-icon-btn" id="gn-view-single"
                      aria-label="Single page" aria-pressed="true"
                      data-tooltip="Single Page View" title="Single page"
                      data-view="single">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2">
                  <rect x="7" y="3" width="10" height="18" rx="1"/>
                </svg>
              </button>
              <button class="gn-icon-btn" id="gn-view-double"
                      aria-label="Two-page spread" aria-pressed="false"
                      data-tooltip="Two-Page Spread" title="Two-page spread"
                      data-view="double">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2">
                  <rect x="2" y="4" width="9" height="16" rx="1"/>
                  <rect x="13" y="4" width="9" height="16" rx="1"/>
                </svg>
              </button>
              <button class="gn-icon-btn gn-view-btn-triple" id="gn-view-triple"
                      aria-label="Three-page view" aria-pressed="false"
                      data-tooltip="Three-Page View" title="Three-page view"
                      data-view="triple">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2">
                  <rect x="1" y="5" width="6" height="14" rx="1"/>
                  <rect x="9" y="5" width="6" height="14" rx="1"/>
                  <rect x="17" y="5" width="6" height="14" rx="1"/>
                </svg>
              </button>
              <button class="gn-icon-btn" id="gn-view-scroll"
                      aria-label="Scroll / Detail view" aria-pressed="false"
                      data-tooltip="Scroll / Detail View" title="Scroll view"
                      data-view="scroll">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <rect x="5" y="3" width="14" height="18" rx="1"/>
                  <line x1="9" y1="8" x2="15" y2="8"/>
                  <line x1="9" y1="12" x2="15" y2="12"/>
                  <line x1="9" y1="16" x2="13" y2="16"/>
                </svg>
              </button>
            </div>

            <div class="gn-toolbar-sep"></div>

            <!-- Zoom group -->
            <div class="gn-toolbar-group">
              <button class="gn-icon-btn" id="gn-zoom-out"
                      aria-label="Zoom out" data-tooltip="Zoom Out (−)" title="Zoom out">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <circle cx="11" cy="11" r="7"/>
                  <line x1="8" y1="11" x2="14" y2="11"/>
                  <line x1="16.5" y1="16.5" x2="21" y2="21"/>
                </svg>
              </button>
              <div class="gn-page-counter">
                <input type="text" class="gn-page-input" id="gn-zoom-display"
                       aria-label="Zoom percentage" title="Zoom percentage"
                       value="100" maxlength="3"/>
                <span>%</span>
              </div>
              <button class="gn-icon-btn" id="gn-zoom-in"
                      aria-label="Zoom in" data-tooltip="Zoom In (+)" title="Zoom in">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <circle cx="11" cy="11" r="7"/>
                  <line x1="11" y1="8" x2="11" y2="14"/>
                  <line x1="8" y1="11" x2="14" y2="11"/>
                  <line x1="16.5" y1="16.5" x2="21" y2="21"/>
                </svg>
              </button>
              <button class="gn-icon-btn" id="gn-zoom-reset"
                      aria-label="Reset zoom" data-tooltip="Reset Zoom (0)" title="Reset zoom">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <polyline points="3 3 3 8 8 8"/>
                </svg>
              </button>
            </div>

            <div class="gn-toolbar-sep"></div>

            <!-- Actions group -->
            <div class="gn-toolbar-group">
              <button class="gn-icon-btn" id="gn-magnify"
                      aria-label="Magnify page" data-tooltip="Magnify / Detail View (M)" title="Magnify">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <circle cx="11" cy="11" r="7"/>
                  <line x1="16.5" y1="16.5" x2="21" y2="21"/>
                  <line x1="11" y1="8" x2="11" y2="14"/>
                  <line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
              </button>
              <div class="gn-bookmark-wrap" id="gn-bookmark-wrap">
                <button class="gn-icon-btn" id="gn-bookmark"
                        aria-label="Bookmark this page" aria-pressed="false"
                        data-tooltip="Bookmark (B)" title="Bookmark">
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span class="gn-bm-badge" id="gn-bm-badge" hidden></span>
                </button>
                <div class="gn-bookmark-dropdown" id="gn-bookmark-dropdown" hidden></div>
              </div>
              <button class="gn-icon-btn" id="gn-toc-toggle"
                      aria-label="Table of contents" aria-pressed="false"
                      data-tooltip="Table of Contents (T)" title="Table of contents">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="18" x2="15" y2="18"/>
                </svg>
              </button>
              <button class="gn-icon-btn" id="gn-fullscreen"
                      aria-label="Toggle fullscreen" aria-pressed="false"
                      data-tooltip="Fullscreen (F)" title="Fullscreen">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 3 21 3 21 9"/>
                  <polyline points="9 21 3 21 3 15"/>
                  <line x1="21" y1="3" x2="14" y2="10"/>
                  <line x1="3" y1="21" x2="10" y2="14"/>
                </svg>
              </button>
            </div>

          </div><!-- end .gn-reader-toolbar -->

          <!-- Reader body: stage + optional TOC -->
          <div class="gn-reader-body" id="gn-reader-body">

            <button class="gn-nav-arrow gn-nav-arrow--prev" id="gn-stage-prev"
                    aria-label="Previous page" data-tooltip="Previous Page (←)" title="Previous page">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none"
                   stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>

            <div class="gn-stage" id="gn-stage">
              <div class="gn-pages-wrap" id="gn-pages-wrap"></div>
            </div>

            <button class="gn-nav-arrow gn-nav-arrow--next" id="gn-stage-next"
                    aria-label="Next page" data-tooltip="Next Page (→)" title="Next page">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none"
                   stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>

            <!-- Table of Contents panel -->
            <div class="gn-toc-panel" id="gn-toc-panel" hidden
                 role="navigation" aria-label="Table of Contents">
              <div class="gn-toc-header">
                <span class="gn-toc-header-title">Contents</span>
                <button class="gn-icon-btn" id="gn-toc-close"
                        aria-label="Close table of contents">
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
              <div class="gn-toc-list" id="gn-toc-list" role="list"></div>
            </div>

          </div><!-- end .gn-reader-body -->

        </div><!-- end #gn-reader -->

      </div><!-- end .gn-modal -->
    `;

    document.body.appendChild(overlay);
    gn.modal = overlay;
    gnCacheRefs();
    gnBindModalEvents();

    // Wire tooltips on the newly built modal
    if (typeof setupTooltipsIn === 'function') {
        setupTooltipsIn(overlay);
    }
}

/** Caches frequently-used DOM refs from the modal. */
function gnCacheRefs() {
    const q = (id) => document.getElementById(id);
    gn.refs = {
        overlay:       gn.modal,
        library:       q('gn-library'),
        reader:        q('gn-reader'),
        bookGrid:      q('gn-book-grid'),
        backBtn:       q('gn-back-to-library'),
        closeBtn:      q('gn-modal-close'),
        barTitle:      q('gn-bar-book-title'),
        // Nav
        firstBtn:      q('gn-first-page'),
        prevBtn:       q('gn-prev-page'),
        nextBtn:       q('gn-next-page'),
        lastBtn:       q('gn-last-page'),
        stagePrev:     q('gn-stage-prev'),
        stageNext:     q('gn-stage-next'),
        pageInput:     q('gn-page-input'),
        totalPages:    q('gn-total-pages'),
        // View buttons
        viewSingle:    q('gn-view-single'),
        viewDouble:    q('gn-view-double'),
        viewTriple:    q('gn-view-triple'),
        viewScroll:    q('gn-view-scroll'),
        // Zoom
        zoomIn:        q('gn-zoom-in'),
        zoomOut:       q('gn-zoom-out'),
        zoomReset:     q('gn-zoom-reset'),
        zoomDisplay:   q('gn-zoom-display'),
        // Actions
        magnify:       q('gn-magnify'),
        bookmark:         q('gn-bookmark'),
        bookmarkBadge:    q('gn-bm-badge'),
        bookmarkWrap:     q('gn-bookmark-wrap'),
        bookmarkDropdown: q('gn-bookmark-dropdown'),
        tocToggle:     q('gn-toc-toggle'),
        fullscreen:    q('gn-fullscreen'),
        // Stage
        stage:         q('gn-stage'),
        pagesWrap:     q('gn-pages-wrap'),
        readerBody:    q('gn-reader-body'),
        // TOC
        tocPanel:      q('gn-toc-panel'),
        tocClose:      q('gn-toc-close'),
        tocList:       q('gn-toc-list'),
    };
}

/** Opens the modal overlay and traps focus. */
function gnOpenModal() {
    if (!gn.modal) return;
    gn.isOpen = true;
    gn.lastFocused = document.activeElement;
    gn.modal.classList.add('gn-overlay--open');
    gn.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', gnHandleKeydown);
    gn.modal.addEventListener('wheel', gnHandleWheel, { passive: false });
}

/** Closes the modal overlay and restores focus. */
function gnCloseModal() {
    if (!gn.modal) return;
    gn.isOpen = false;
    gn.modal.classList.remove('gn-overlay--open');
    gn.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    // Exit fullscreen if active
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }
    gn.modal.classList.remove('gn-fullscreen');
    document.removeEventListener('keydown', gnHandleKeydown);
    gn.modal.removeEventListener('wheel', gnHandleWheel);
    // Turn off magnifier loupe
    if (gn.magnifyOn) { gn.magnifyOn = false; gnDetachMagnifier(); gn.refs.magnify?.classList.remove('gn-icon-btn--active'); }
    if (gn.lastFocused && typeof gn.lastFocused.focus === 'function') {
        gn.lastFocused.focus();
    }
    gn.lastFocused = null;
}

// ------------------------------------------------------------
// Library
// ------------------------------------------------------------

/** Switches to the library view inside the modal. */
function gnShowLibrary() {
    gn.isLibrary = true;
    const r = gn.refs;
    r.library.classList.remove('gn-hidden');
    r.reader.classList.add('gn-hidden');
    r.backBtn.classList.add('gn-hidden');
    r.barTitle.classList.add('gn-hidden');
    r.barTitle.textContent = '';
    // Close TOC if open
    if (gn.tocOpen) gnToggleToc();
    // Turn off magnifier loupe
    if (gn.magnifyOn) { gn.magnifyOn = false; gnDetachMagnifier(); gn.refs.magnify?.classList.remove('gn-icon-btn--active'); gn.refs.magnify?.setAttribute('aria-pressed', 'false'); }
    gnRenderLibrary();
}

/** Rebuilds all book cards in the library grid. */
function gnRenderLibrary() {
    const grid = gn.refs.bookGrid;
    grid.innerHTML = '';
    if (!gn.books.length) {
        grid.innerHTML = '<p style="padding:20px;color:var(--text-muted);">No graphic novels found on this page.</p>';
        return;
    }
    gn.books.forEach((book) => {
        const card = gnBuildLibraryCard(book);
        grid.appendChild(card);
    });
}

/** Builds a single book card for the library grid. */
function gnBuildLibraryCard(book) {
    const progress = gnLoadProgress(book.id);
    const total    = book.pages.length;
    const lastPage = gnFurthestPage(progress, total); // 0-indexed, spread-aware
    const pct      = total > 0 ? Math.round((lastPage / (total - 1)) * 100) : 0;

    let badgeClass = 'gn-book-card-badge--new';
    let badgeLabel = 'New';
    let openLabel  = 'Open Book';
    if (progress && lastPage > 0 && lastPage < total - 1) {
        badgeClass = 'gn-book-card-badge--progress';
        badgeLabel = 'In Progress';
        openLabel  = 'Continue Reading';
    } else if (progress && lastPage >= total - 1 && total > 1) {
        badgeClass = 'gn-book-card-badge--done';
        badgeLabel = 'Completed';
        openLabel  = 'Read Again';
    }

    const chapterCount = book.chapters.length ? `${book.chapters.length} chapters · ` : '';
    const progressHtml = progress
        ? `<div class="gn-book-card-progress-wrap">
             <div class="gn-book-card-progress-bg">
               <div class="gn-book-card-progress-fill" style="width:${pct}%"></div>
             </div>
             <span class="gn-book-card-progress-label">${lastPage + 1} / ${total} pages</span>
           </div>`
        : '';

    const li = document.createElement('li');
    li.style.listStyle = 'none';

    const card = document.createElement('article');
    card.className = 'gn-book-card';
    card.innerHTML = `
      <span class="gn-book-card-badge ${badgeClass}">${badgeLabel}</span>
      <div class="gn-book-card-cover">
        <img src="${gnEscHtml(book.coverSrc)}" alt="${gnEscHtml(book.coverAlt)}" loading="lazy">
      </div>
      <div class="gn-book-card-body">
        <h4 class="gn-book-card-title">${gnEscHtml(book.title)}</h4>
        <div class="gn-book-card-meta-row">
          ${book.genre ? `<span class="gn-book-card-genre">${gnEscHtml(book.genre)}</span>` : ''}
          ${book.author ? `<span class="gn-book-card-author">${gnEscHtml(book.author)}</span>` : ''}
        </div>
        <p class="gn-book-card-desc">${gnEscHtml(book.description)}</p>
        <div class="gn-book-card-info-row">
          <span>${chapterCount}${total} page${total !== 1 ? 's' : ''}</span>
          ${book.year ? `<span>${gnEscHtml(book.year)}</span>` : ''}
        </div>
        ${progressHtml}
        <button class="gn-book-card-open" data-book-id="${gnEscHtml(book.id)}"
                aria-label="Open ${gnEscHtml(book.title)}">
          ${openLabel}
        </button>
      </div>
    `;

    card.querySelector('.gn-book-card-open').addEventListener('click', (e) => {
        e.stopPropagation();
        // "Read Again" resets progress so the book reopens from page 1
        if (openLabel === 'Read Again') {
            try { localStorage.removeItem(GN_LS_KEY(book.id)); } catch { /* silent */ }
            gnRefreshAllCards();
        }
        gnOpenBook(book.id);
    });
    card.querySelector('.gn-book-card-cover').addEventListener('click', () => gnOpenBook(book.id));

    li.appendChild(card);
    return li;
}

// ------------------------------------------------------------
// Reader Rendering
// ------------------------------------------------------------

/** Opens a book by ID, switching to reader view. */
function gnOpenBook(bookId) {
    const book = gn.books.find((b) => b.id === bookId);
    if (!book) return;

    gn.currentBook = book;

    // Restore saved progress
    const progress = gnLoadProgress(bookId);
    gn.viewMode   = (progress && progress.viewMode) || 'single';
    gn.zoom       = (progress && progress.zoom)     || 1.0;
    gn.currentPage = progress ? Math.min(progress.lastPage, book.pages.length - 1) : 0;
    // Triple view is not supported for novel books
    if (book.type === 'novel' && gn.viewMode === 'triple') gn.viewMode = 'double';

    gnShowReaderView();
}

/** Switches the modal to the reader view. */
function gnShowReaderView() {
    gn.isLibrary = false;
    const r = gn.refs;

    r.library.classList.add('gn-hidden');
    r.reader.classList.remove('gn-hidden');
    r.backBtn.classList.remove('gn-hidden');
    r.barTitle.classList.remove('gn-hidden');
    r.barTitle.textContent = gn.currentBook.title;

    // Clear type-specific zoom CSS vars from any previous book
    r.stage.style.removeProperty('--gn-text-size');
    r.stage.style.removeProperty('--gn-zoom-w');

    const isNovel = gn.currentBook.type === 'novel';

    gnBuildToc(gn.currentBook);
    gnRenderPage();
    gnUpdateNavUI();
    gnUpdateViewModeUI();
    gnUpdateZoomUI();
    gnUpdateBookmarkUI();

    // Focus the reader area
    r.stage.focus && r.stage.setAttribute('tabindex', '-1');
    r.stage.focus();
}

/**
 * Renders the current page(s) into the pages wrapper
 * according to the current view mode.
 */
function gnRenderPage() {
    const r     = gn.refs;
    const book  = gn.currentBook;
    const wrap  = r.pagesWrap;

    if (!book) return;

    // Page transition
    wrap.classList.add('gn-page-transition');

    setTimeout(() => {
        // Remove any previous scroll tracker
        if (gn._scrollTracker) {
            r.stage.removeEventListener('scroll', gn._scrollTracker);
            gn._scrollTracker = null;
        }

        wrap.innerHTML = '';
        const stage   = r.stage;
        const total   = book.pages.length;

        // Set CSS classes for view mode on stage and wrap
        stage.className = 'gn-stage' + (gn.viewMode === 'scroll' ? ' gn-stage--scroll' : '');
        wrap.className  = 'gn-pages-wrap' + (gn.viewMode === 'scroll' ? ' gn-pages-wrap--scroll' : '');

        if (gn.viewMode === 'scroll') {
            // All pages stacked
            book.pages.forEach((page, i) => {
                wrap.appendChild(gnBuildPageFrame(page, i, book));
            });

            // Update page counter as user scrolls
            let ticking = false;
            gn._scrollTracker = () => {
                if (ticking) return;
                ticking = true;
                requestAnimationFrame(() => {
                    ticking = false;
                    const frames = wrap.children;
                    if (!frames.length) return;
                    const stageRect = stage.getBoundingClientRect();
                    let bestIndex = gn.currentPage;
                    let bestVisible = -1;
                    for (let i = 0; i < frames.length; i++) {
                        const rect = frames[i].getBoundingClientRect();
                        const visible = Math.max(0, Math.min(rect.bottom, stageRect.bottom) - Math.max(rect.top, stageRect.top));
                        if (visible > bestVisible) { bestVisible = visible; bestIndex = i; }
                    }
                    if (bestIndex !== gn.currentPage) {
                        gn.currentPage = bestIndex;
                        gnUpdateNavUI();
                        gnUpdateBookmarkUI();
                        gnUpdateTocHighlight();
                    }
                });
            };
            stage.addEventListener('scroll', gn._scrollTracker, { passive: true });

            // Scroll to current page
            setTimeout(() => {
                const target = wrap.children[gn.currentPage];
                if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
            }, 60);
        } else {
            const step = gnGetStep();
            const start = gn.currentPage;
            for (let i = start; i < start + step && i < total; i++) {
                wrap.appendChild(gnBuildPageFrame(book.pages[i], i, book));
            }
        }

        // Apply zoom in scroll mode
        gnApplyZoomVar();

        wrap.classList.remove('gn-page-transition');
        gnUpdateTocHighlight();
        gnPreloadAdjacent();
    }, 80);
}

/** Builds a single page frame element (wrapper + img or fetched text content). */
function gnBuildPageFrame(page, index, book) {
    if (page.type === 'text') return gnBuildTextPageFrame(page, index, book);

    const frame = document.createElement('div');
    frame.className = 'gn-page-frame';
    frame.dataset.pageIndex = index;

    // Loading placeholder
    const placeholder = document.createElement('div');
    placeholder.className = 'gn-page-placeholder';
    placeholder.setAttribute('aria-label', `Loading page ${index + 1}`);
    const spinner = document.createElement('div');
    spinner.className = 'gn-page-spinner';
    placeholder.appendChild(spinner);
    frame.appendChild(placeholder);

    // Image
    const img = new Image();
    img.className = 'gn-page-img gn-img-loading';
    img.alt = page.alt || `${book.title} — Page ${index + 1}`;
    img.loading = 'lazy';

    img.onload = () => {
        img.classList.remove('gn-img-loading');
        placeholder.remove();
        frame.appendChild(img);
    };

    img.onerror = () => {
        spinner.remove();
        placeholder.setAttribute('aria-label', `Page ${index + 1} could not be loaded`);
        placeholder.innerHTML = `
          <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true" fill="none"
               stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="3" x2="21" y2="21"/>
          </svg>
          <span>Page ${index + 1} unavailable</span>`;
    };

    img.src = page.src;
    return frame;
}

/** Builds a text page frame; fetches the HTML fragment and injects it asynchronously. */
function gnBuildTextPageFrame(page, index, book) {
    const frame = document.createElement('div');
    frame.className = 'gn-page-frame gn-page-frame--text';
    frame.dataset.pageIndex = index;

    const placeholder = document.createElement('div');
    placeholder.className = 'gn-page-placeholder';
    placeholder.setAttribute('aria-label', `Loading page ${index + 1}`);
    const spinner = document.createElement('div');
    spinner.className = 'gn-page-spinner';
    placeholder.appendChild(spinner);
    frame.appendChild(placeholder);

    gnFetchTextPage(page.src).then((html) => {
        placeholder.remove();
        if (html === null) {
            const err = document.createElement('div');
            err.className = 'gn-page-placeholder';
            err.innerHTML = `
              <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true" fill="none"
                   stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="3" y1="3" x2="21" y2="21"/>
              </svg>
              <span>Page ${index + 1} unavailable</span>`;
            frame.appendChild(err);
            return;
        }
        const content = document.createElement('div');
        content.className = 'gn-text-page';
        content.innerHTML = html;
        frame.appendChild(content);
    });

    return frame;
}

// ------------------------------------------------------------
// Page Navigation
// ------------------------------------------------------------

/** Navigates to the given 0-indexed page number. */
function gnGoToPage(n) {
    const book  = gn.currentBook;
    if (!book) return;
    const total = book.pages.length;
    n = Math.max(0, Math.min(n, total - 1));
    // Align to step boundary (except in scroll mode)
    if (gn.viewMode !== 'scroll') {
        const step = gnGetStep();
        n = Math.floor(n / step) * step;
    }
    gn.currentPage = n;
    // In scroll mode pages are already in the DOM — just scroll to the target frame
    if (gn.viewMode === 'scroll' && gn.refs.pagesWrap.children.length > 0) {
        const target = gn.refs.pagesWrap.children[n];
        if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } else {
        gnRenderPage();
    }
    gnUpdateNavUI();
    gnUpdateBookmarkUI();
    gnSaveProgress();
}

function gnPrevPage() {
    if (gn.viewMode === 'scroll') {
        const prev = Math.max(0, gn.currentPage - 1);
        if (prev !== gn.currentPage) gnGoToPage(prev);
        return;
    }
    gnGoToPage(gn.currentPage - gnGetStep());
}

function gnNextPage() {
    if (gn.viewMode === 'scroll') {
        const next = Math.min((gn.currentBook?.pages.length || 1) - 1, gn.currentPage + 1);
        if (next !== gn.currentPage) gnGoToPage(next);
        return;
    }
    gnGoToPage(gn.currentPage + gnGetStep());
}

function gnFirstPage() { gnGoToPage(0); }

function gnLastPage() {
    if (!gn.currentBook) return;
    const total = gn.currentBook.pages.length;
    gnGoToPage(gn.viewMode === 'scroll' ? total - 1 : total - 1);
}

/** Returns how many pages advance per "next" in the current mode. */
function gnGetStep() {
    return gn.viewMode === 'double' ? 2 : gn.viewMode === 'triple' ? 3 : 1;
}

/** Same as gnGetStep but for arbitrary saved progress, independent of the live gn state. */
function gnStepForViewMode(viewMode) {
    return viewMode === 'double' ? 2 : viewMode === 'triple' ? 3 : 1;
}

/** Resolves the last page actually reached, accounting for double/triple spreads where
 *  the stored lastPage is the spread's start index rather than its final page. */
function gnFurthestPage(progress, total) {
    if (!progress) return 0;
    const step = gnStepForViewMode(progress.viewMode);
    return Math.min(progress.lastPage + step - 1, total - 1);
}

/** Updates nav button disabled states and page counter. */
function gnUpdateNavUI() {
    const r    = gn.refs;
    const book = gn.currentBook;
    if (!book) return;

    const total  = book.pages.length;
    const cur    = gn.currentPage; // 0-indexed
    const step   = gn.viewMode === 'scroll' ? 1 : gnGetStep();
    const atEnd  = cur + step >= total;
    const atStart = cur === 0;

    r.firstBtn.disabled = atStart;
    r.prevBtn.disabled  = atStart;
    r.nextBtn.disabled  = atEnd;
    r.lastBtn.disabled  = atEnd;
    r.stagePrev.disabled = atStart;
    r.stageNext.disabled = atEnd;

    // Page input: show 1-indexed; show spread range in multi-page modes
    const displayEnd = Math.min(cur + step - 1, total - 1);
    r.pageInput.value = (step > 1 && displayEnd > cur)
        ? `${cur + 1}–${displayEnd + 1}`
        : cur + 1;
    r.pageInput.max   = total;

    r.totalPages.textContent = total;

    if (step > 1 && displayEnd > cur) {
        r.pageInput.setAttribute('aria-label', `Current pages ${cur + 1}–${displayEnd + 1} of ${total}`);
    } else {
        r.pageInput.setAttribute('aria-label', `Page ${cur + 1} of ${total}`);
    }
}

// ------------------------------------------------------------
// Viewing Modes
// ------------------------------------------------------------

/** Sets the view mode and re-renders. */
function gnSetViewMode(mode) {
    if (gn.viewMode === mode) return;
    // Triple view not supported for novel books
    if (mode === 'triple' && gn.currentBook?.type === 'novel') mode = 'double';
    const prevStep = gnGetStep();
    gn.viewMode = mode;
    // Align current page to new step
    const step = gnGetStep();
    gn.currentPage = Math.floor(gn.currentPage / step) * step;
    if (mode === 'scroll') {
        const saved = gnLoadProgress(gn.currentBook?.id);
        gn.zoom = (saved && saved.zoom) || gn.zoom;
    }
    gnUpdateViewModeUI();
    gnUpdateZoomUI();
    gnRenderPage();
    gnUpdateNavUI();
    gnSaveProgress();
}

/** Updates aria-pressed on all view mode buttons. Hides triple-page for novel books. */
function gnUpdateViewModeUI() {
    const r = gn.refs;
    const isNovel = gn.currentBook?.type === 'novel';
    const btns = [r.viewSingle, r.viewDouble, r.viewTriple, r.viewScroll];
    btns.forEach((btn) => {
        if (!btn) return;
        const active = btn.dataset.view === gn.viewMode;
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        btn.classList.toggle('gn-icon-btn--active', active);
    });
    // Triple view is not meaningful for text novels
    if (r.viewTriple) {
        r.viewTriple.hidden   = isNovel;
        r.viewTriple.disabled = isNovel;
    }
}

// ------------------------------------------------------------
// Zoom / Magnification
// ------------------------------------------------------------

// Snap to next/prev 25% boundary rather than blindly adding the step
function gnZoomIn()    { gnSetZoom(Math.ceil((gn.zoom + 0.001) / GN_ZOOM_STEP) * GN_ZOOM_STEP); }
function gnZoomOut()   { gnSetZoom(Math.floor((gn.zoom - 0.001) / GN_ZOOM_STEP) * GN_ZOOM_STEP); }
function gnZoomReset() { gnSetZoom(1.0); }

/** Sets zoom level; for novels scales font size, for images may switch to scroll mode. */
function gnSetZoom(z) {
    const isNovel = gn.currentBook?.type === 'novel';
    const minZ = isNovel ? 0.5 : GN_ZOOM_MIN;
    const maxZ = isNovel ? 2.0 : GN_ZOOM_MAX;
    gn.zoom = Math.round(Math.min(maxZ, Math.max(minZ, z)) * 100) / 100;
    if (!isNovel && gn.viewMode !== 'scroll') {
        gnSetViewMode('scroll');
        return; // gnSetViewMode calls gnUpdateZoomUI and gnRenderPage
    }
    gnApplyZoomVar();
    gnUpdateZoomUI();
    gnSaveProgress();
}

/** Applies zoom as a CSS variable: font-size for novels, image width for scroll mode. */
function gnApplyZoomVar() {
    if (gn.currentBook?.type === 'novel') {
        gn.refs.stage.style.setProperty('--gn-text-size', `${Math.round(gn.zoom * 16)}px`);
        return;
    }
    if (gn.viewMode !== 'scroll') return;
    gn.refs.stage.style.setProperty('--gn-zoom-w', `${gn.zoom * 100}%`);
}

function gnUpdateZoomUI() {
    const r = gn.refs;
    const isNovel  = gn.currentBook?.type === 'novel';
    const inScroll = gn.viewMode === 'scroll';
    const zoomOn   = isNovel || inScroll;
    r.zoomDisplay.value    = `${Math.round(gn.zoom * 100)}`;
    r.zoomDisplay.disabled = !zoomOn;
    r.zoomIn.disabled      = zoomOn && gn.zoom >= (isNovel ? 2.0 : GN_ZOOM_MAX);
    r.zoomOut.disabled     = zoomOn && gn.zoom <= (isNovel ? 0.5 : GN_ZOOM_MIN);
    r.zoomReset.disabled   = zoomOn && gn.zoom === 1.0;
}

/** Magnify: loupe for image books; zoomed text clone for novel books. */
function gnMagnify() {
    gn.magnifyOn = !gn.magnifyOn;
    const btn = gn.refs.magnify;
    btn.setAttribute('aria-pressed', gn.magnifyOn ? 'true' : 'false');
    btn.classList.toggle('gn-icon-btn--active', gn.magnifyOn);
    if (gn.magnifyOn) { gnAttachMagnifier(); } else { gnDetachMagnifier(); }
}

function gnAttachMagnifier() {
    const body = gn.refs.readerBody;
    body.classList.add('gn-magnify-active');
    let glass = document.getElementById('gn-magnifier-glass');
    if (!glass) {
        glass = document.createElement('div');
        glass.id = 'gn-magnifier-glass';
        glass.setAttribute('aria-hidden', 'true');
        document.body.appendChild(glass);
    }
    glass.innerHTML = '';
    glass.style.backgroundImage = '';
    glass.style.display = 'none';
    const isNovel = gn.currentBook?.type === 'novel';
    gn._magnifierMove  = isNovel ? (e) => gnOnTextMagnifierMove(e, glass) : (e) => gnOnMagnifierMove(e, glass);
    gn._magnifierLeave = () => { glass.style.display = 'none'; };
    body.addEventListener('mousemove',  gn._magnifierMove);
    body.addEventListener('mouseleave', gn._magnifierLeave);
}

function gnDetachMagnifier() {
    const body = gn.refs.readerBody;
    if (!body) return;
    body.classList.remove('gn-magnify-active');
    if (gn._magnifierMove)  { body.removeEventListener('mousemove',  gn._magnifierMove);  gn._magnifierMove  = null; }
    if (gn._magnifierLeave) { body.removeEventListener('mouseleave', gn._magnifierLeave); gn._magnifierLeave = null; }
    const glass = document.getElementById('gn-magnifier-glass');
    if (glass) {
        glass.style.display = 'none';
        glass.innerHTML = '';
        glass.style.backgroundImage = '';
    }
}

/** Text loupe: positions a fixed clipping window over a scaled copy of the live text page. */
function gnOnTextMagnifierMove(e, glass) {
    // Hit-test the actual point under the cursor so this works across single,
    // double/triple spreads (multiple frames side by side), and scroll mode
    // (multiple frames stacked, only some of which are visible/scrolled into view).
    const el       = document.elementFromPoint(e.clientX, e.clientY);
    const frame    = el && el.closest('.gn-page-frame--text');
    const textPage = frame && frame.querySelector('.gn-text-page');
    if (!textPage) { glass.style.display = 'none'; return; }

    const ZOOM    = 2.0;
    const GLASS_W = 340;
    const GLASS_H = 260;
    const GAP     = 16;

    // Position glass beside cursor
    const spaceRight = window.innerWidth - e.clientX - GAP;
    const glassLeft  = spaceRight >= GLASS_W ? e.clientX + GAP : e.clientX - GLASS_W - GAP;
    const glassTop   = Math.max(8, Math.min(window.innerHeight - GLASS_H - 8, e.clientY - GLASS_H / 2));

    // Cursor position within the text page's content coordinate space
    const pageRect = textPage.getBoundingClientRect();
    const relX = e.clientX - pageRect.left;
    const relY = e.clientY - pageRect.top + textPage.scrollTop;

    // Scaled origin: the point in the scaled space that should appear at glass top-left
    const originX = relX * ZOOM - GLASS_W / 2;
    const originY = relY * ZOOM - GLASS_H / 2;

    // The glass acts as a viewport: it shows a ZOOM-scaled slice of the text page.
    // We render the loupe by placing a wrapper inside the glass that:
    //   1. Is the same width as the text page
    //   2. Is scaled by ZOOM from its top-left
    //   3. Is offset so the cursor region is centred in the glass
    let inner = glass.querySelector('.gn-text-loupe-inner');
    if (!inner) {
        inner = document.createElement('div');
        // Keep the "gn-text-page" class so the real image/row layout rules
        // (max-width, flex ratios, min-width:0, etc.) apply to the mirrored
        // content — without it, images render at native size and overlap.
        inner.className = 'gn-text-page gn-text-loupe-inner';
        glass.appendChild(inner);
    }

    // Mirror content only when the hovered frame (page) changes, keyed by its page index
    const pageKey = frame.dataset.pageIndex;
    if (inner.dataset.pageIndex !== pageKey) {
        inner.innerHTML = textPage.innerHTML;
        inner.dataset.pageIndex = pageKey;
        // Carry over computed text styles explicitly
        const cs = getComputedStyle(textPage);
        inner.style.cssText = [
            'position:absolute', 'top:0', 'left:0', 'margin:0',
            `width:${textPage.offsetWidth}px`, 'max-width:none',
            'height:auto', 'overflow:visible', 'pointer-events:none',
            'transform-origin:0 0', 'box-sizing:border-box',
            `font-family:${cs.fontFamily}`,
            `font-size:${cs.fontSize}`,
            `line-height:${cs.lineHeight}`,
            `padding:${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
            'color:#e6edf3',
        ].join(';');
        inner.querySelectorAll('img').forEach((img) => {
            img.style.cssText += ';max-width:100%;min-width:0;height:auto;display:block;';
        });
    }

    inner.style.transform = `scale(${ZOOM}) translate(${-originX / ZOOM}px, ${-originY / ZOOM}px)`;

    glass.style.display    = 'block';
    glass.style.width      = GLASS_W + 'px';
    glass.style.height     = GLASS_H + 'px';
    glass.style.left       = glassLeft + 'px';
    glass.style.top        = glassTop  + 'px';
    glass.style.background = '#161b22';
}

function gnOnMagnifierMove(e, glass) {
    const el  = document.elementFromPoint(e.clientX, e.clientY);
    const img = el && (el.tagName === 'IMG' ? el : el.closest('.gn-page-frame')?.querySelector('img.gn-page-img'));
    if (!img || !img.complete || !img.naturalWidth) { glass.style.display = 'none'; return; }

    const ZOOM    = 2.5;
    const GLASS_W = 260;
    const GLASS_H = 260;
    const GAP     = 16;

    const rect = img.getBoundingClientRect();
    const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const relY = Math.max(0, Math.min(1, (e.clientY - rect.top)  / rect.height));
    const bgW  = rect.width  * ZOOM;
    const bgH  = rect.height * ZOOM;
    const bgPX = relX * bgW - GLASS_W / 2;
    const bgPY = relY * bgH - GLASS_H / 2;

    // Place on the side with the most horizontal room
    const spaceRight = window.innerWidth - e.clientX - GAP;
    const left = spaceRight >= GLASS_W ? e.clientX + GAP : e.clientX - GLASS_W - GAP;
    const top  = Math.max(8, Math.min(window.innerHeight - GLASS_H - 8, e.clientY - GLASS_H / 2));

    glass.style.display          = 'block';
    glass.style.left             = left + 'px';
    glass.style.top              = top  + 'px';
    glass.style.backgroundImage  = `url('${img.src}')`;
    glass.style.backgroundSize   = `${bgW}px ${bgH}px`;
    glass.style.backgroundPosition = `-${bgPX}px -${bgPY}px`;
}

// ------------------------------------------------------------
// Table of Contents
// ------------------------------------------------------------

function gnToggleToc() {
    gn.tocOpen = !gn.tocOpen;
    const r = gn.refs;
    r.tocPanel.hidden = !gn.tocOpen;
    r.readerBody.classList.toggle('gn-toc-open', gn.tocOpen);
    r.tocToggle.setAttribute('aria-pressed', gn.tocOpen ? 'true' : 'false');
    r.tocToggle.classList.toggle('gn-icon-btn--active', gn.tocOpen);
    if (gn.tocOpen) {
        // Focus first TOC item
        const firstItem = r.tocList.querySelector('.gn-toc-item');
        if (firstItem) firstItem.focus();
    }
}

/** Rebuilds the TOC list from book chapter data. */
function gnBuildToc(book) {
    const list = gn.refs.tocList;
    list.innerHTML = '';
    if (!book.chapters.length) {
        list.innerHTML = '<p style="padding:12px 16px;font-size:13px;color:#8b949e;">No chapters defined.</p>';
        return;
    }
    book.chapters.forEach((ch) => {
        const btn = document.createElement('button');
        btn.className = 'gn-toc-item';
        btn.setAttribute('role', 'listitem');
        btn.dataset.page = ch.page; // 1-based
        btn.innerHTML = `${gnEscHtml(ch.name)}<span class="gn-toc-page-num">Page ${ch.page}</span>`;
        btn.addEventListener('click', () => {
            gnGoToPage(ch.page - 1); // convert to 0-indexed
            // On mobile, close TOC after selection
            if (window.innerWidth < 640 && gn.tocOpen) gnToggleToc();
        });
        list.appendChild(btn);
    });
}

/** Highlights the TOC item matching the current page. */
function gnUpdateTocHighlight() {
    const book = gn.currentBook;
    if (!book) return;

    const cur  = gn.currentPage + 1; // 1-indexed

    // Update bar title with chapter name when chapters exist
    const r = gn.refs;
    if (book.chapters.length) {
        let activeIndex = 0;
        book.chapters.forEach((ch, i) => {
            if (ch.page <= cur) activeIndex = i;
        });
        const chapterName = book.chapters[activeIndex].name;
        r.barTitle.textContent = `${book.title} \u2013 ${chapterName}`;

        const items = r.tocList.querySelectorAll('.gn-toc-item');
        items.forEach((item, i) => {
            item.classList.toggle('gn-toc-item--active', i === activeIndex);
        });
    } else {
        r.barTitle.textContent = book.title;
    }
}

// ------------------------------------------------------------
// Bookmarks / Local Storage
// ------------------------------------------------------------

const GN_LS_KEY = (bookId) => GN_LS_PREFIX + bookId;

function gnLoadProgress(bookId) {
    try {
        const raw = localStorage.getItem(GN_LS_KEY(bookId));
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function gnSaveProgress() {
    if (!gn.currentBook) return;
    const data = {
        lastPage:  gn.currentPage,
        bookmarks: gnLoadBookmarks(gn.currentBook.id),
        viewMode:  gn.viewMode,
        zoom:      gn.zoom,
    };
    try {
        localStorage.setItem(GN_LS_KEY(gn.currentBook.id), JSON.stringify(data));
    } catch {
        // localStorage unavailable - silent fail
    }
    // Update all card surfaces to reflect new progress
    gnRefreshAllCards();
}

function gnRefreshAllCards() {
    gnRenderPageCards();
    gnRenderInlineCards();
    gnRenderLibrary();
}

// Returns sorted array of bookmarked page indices; migrates old single-bookmark format
function gnLoadBookmarks(bookId) {
    try {
        const raw  = localStorage.getItem(GN_LS_KEY(bookId));
        const data = raw ? JSON.parse(raw) : null;
        if (!data) return [];
        if (Array.isArray(data.bookmarks)) return data.bookmarks;
        return typeof data.bookmark === 'number' ? [data.bookmark] : [];
    } catch { return []; }
}

function gnSaveBookmarks(bms) {
    if (!gn.currentBook) return;
    try {
        const raw  = localStorage.getItem(GN_LS_KEY(gn.currentBook.id));
        const data = raw ? JSON.parse(raw) : {};
        data.bookmarks = bms;
        delete data.bookmark;
        localStorage.setItem(GN_LS_KEY(gn.currentBook.id), JSON.stringify(data));
    } catch {}
}

/** Returns the page indices visible in the current span (1 in single/scroll, 2 in double, 3 in triple). */
function gnGetCurrentSpan() {
    if (!gn.currentBook) return [];
    const step  = gn.viewMode === 'scroll' ? 1 : gnGetStep();
    const total = gn.currentBook.pages.length;
    const pages = [];
    for (let i = gn.currentPage; i < gn.currentPage + step && i < total; i++) pages.push(i);
    return pages;
}

function gnToggleBookmark() {
    if (!gn.currentBook) return;
    const span = gnGetCurrentSpan();
    let bms    = gnLoadBookmarks(gn.currentBook.id);
    if (span.some((p) => bms.includes(p))) {
        bms = bms.filter((p) => !span.includes(p)); // remove all in span
    } else {
        bms = [...bms, span[0]].sort((a, b) => a - b); // bookmark first page of span
    }
    gnSaveBookmarks(bms);
    gnUpdateBookmarkUI();
}

function gnRemoveBookmark(pageIndex) {
    if (!gn.currentBook) return;
    gnSaveBookmarks(gnLoadBookmarks(gn.currentBook.id).filter((p) => p !== pageIndex));
    gnUpdateBookmarkUI();
}

function gnUpdateBookmarkUI() {
    if (!gn.currentBook) return;
    const bms    = gnLoadBookmarks(gn.currentBook.id);
    const active = gnGetCurrentSpan().some((p) => bms.includes(p));
    const btn    = gn.refs.bookmark;
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.classList.toggle('gn-icon-btn--active', active);
    const svgPath = btn.querySelector('path');
    if (svgPath) svgPath.setAttribute('fill', active ? 'currentColor' : 'none');
    // Update badge count
    const badge = gn.refs.bookmarkBadge;
    if (badge) {
        badge.textContent = bms.length;
        badge.hidden = bms.length === 0;
    }
    gnBuildBookmarkDropdown();
}

function gnBuildBookmarkDropdown() {
    const dropdown = gn.refs.bookmarkDropdown;
    if (!dropdown || !gn.currentBook) return;
    const bms = gnLoadBookmarks(gn.currentBook.id);
    dropdown.innerHTML = '';
    if (!bms.length) { dropdown.hidden = true; return; }
    bms.forEach((pageIndex) => {
        const item = document.createElement('div');
        item.className = 'gn-bm-item';

        const link = document.createElement('button');
        link.className = 'gn-bm-link';
        link.textContent = `Page ${pageIndex + 1}`;
        link.addEventListener('click', () => {
            gnGoToPage(pageIndex);
            dropdown.hidden = true;
        });

        const del = document.createElement('button');
        del.className = 'gn-bm-delete';
        del.setAttribute('aria-label', `Remove bookmark for page ${pageIndex + 1}`);
        del.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>`;
        del.addEventListener('click', (e) => { e.stopPropagation(); gnRemoveBookmark(pageIndex); });

        item.appendChild(link);
        item.appendChild(del);
        dropdown.appendChild(item);
    });
}

// ------------------------------------------------------------
// Preloading
// ------------------------------------------------------------

/** Preloads the page(s) adjacent to the current position. */
function gnPreloadAdjacent() {
    const book = gn.currentBook;
    if (!book) return;
    const total = book.pages.length;
    const step  = gnGetStep();
    const indices = [
        gn.currentPage + step,
        gn.currentPage - step,
        gn.currentPage + step * 2,
    ];
    indices.forEach((i) => {
        if (i >= 0 && i < total) {
            const page = book.pages[i];
            if (!page) return;
            if (page.type === 'text') {
                if (page.src && !gnTextPageCache.has(page.src)) gnFetchTextPage(page.src);
            } else {
                if (page.src && !gnPreloadCache.has(page.src)) {
                    const img = new Image();
                    img.src = page.src;
                    gnPreloadCache.add(page.src);
                }
            }
        }
    });
}

const gnPreloadCache = new Set();
const gnTextPageCache = new Map();

/** Fetches and caches an HTML text page fragment. Strips scripts and inline handlers for safety. */
async function gnFetchTextPage(src) {
    if (gnTextPageCache.has(src)) return gnTextPageCache.get(src);
    try {
        const resp = await fetch(src);
        if (!resp.ok) return null;
        let html = await resp.text();
        html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        html = html.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
        gnTextPageCache.set(src, html);
        return html;
    } catch {
        return null;
    }
}

// ------------------------------------------------------------
// Page Preview Cards (inline on custom.html, outside the modal)
// ------------------------------------------------------------

/** Renders book preview cards into #gn-page-cards on the page. */
function gnRenderPageCards() {
    const container = document.getElementById('gn-page-cards');
    if (!container) return;

    container.innerHTML = '';
    gn.books.forEach((book) => {
        const card = gnBuildPreviewCard(book);
        container.appendChild(card);
    });
}

/** Renders a single card into any element with data-gn-card="book-id". */
function gnRenderInlineCards() {
    document.querySelectorAll('[data-gn-card]').forEach((el) => {
        const book = gn.books.find((b) => b.id === el.dataset.gnCard);
        if (!book) return;
        el.innerHTML = '';
        // Reuse gnBuildPreviewCard and unwrap the <article> from its <li>
        el.appendChild(gnBuildPreviewCard(book).firstElementChild);
    });
}

/** Wires any element with data-gn-open="book-id" to open that book on click. */
function gnWireOpenLinks() {
    document.querySelectorAll('[data-gn-open]').forEach((el) => {
        const bookId = el.dataset.gnOpen;
        if (!gn.books.find((b) => b.id === bookId)) return;
        // Clone to drop any listener attached during a previous navigation
        const fresh = el.cloneNode(true);
        el.replaceWith(fresh);
        fresh.addEventListener('click', () => {
            gnOpenBook(bookId);
            gnOpenModal();
        });
    });
}

function gnBuildPreviewCard(book) {
    const progress = gnLoadProgress(book.id);
    const total    = book.pages.length;
    const lastPage = gnFurthestPage(progress, total); // spread-aware
    const pct      = total > 1 ? Math.round((lastPage / (total - 1)) * 100) : 0;

    let badgeClass = 'gn-book-card-badge--new';
    let badgeLabel = 'New';
    let openLabel  = 'Open Book';
    if (progress && lastPage > 0 && lastPage < total - 1) {
        badgeClass = 'gn-book-card-badge--progress';
        badgeLabel = 'In Progress';
        openLabel  = 'Continue Reading';
    } else if (progress && lastPage >= total - 1 && total > 1) {
        badgeClass = 'gn-book-card-badge--done';
        badgeLabel = 'Completed';
        openLabel  = 'Read Again';
    }

    const li = document.createElement('li');
    li.style.listStyle = 'none';

    const card = document.createElement('article');
    card.className = 'gn-page-card';

    const progressHtml = progress
        ? `<div class="gn-page-card-progress-bar-bg">
             <div class="gn-page-card-progress-fill" style="width:${pct}%"></div>
           </div>
           <span class="gn-page-card-progress-label">${lastPage + 1} / ${total} pages</span>`
        : '';

    card.innerHTML = `
      <div class="gn-page-card-cover">
        <span class="gn-book-card-badge ${badgeClass}">${badgeLabel}</span>
        <img src="${gnEscHtml(book.coverSrc)}" alt="${gnEscHtml(book.coverAlt)}" loading="lazy">
      </div>
      <div class="gn-page-card-body">
        <div class="gn-page-card-title">${gnEscHtml(book.title)}</div>
        <div class="gn-page-card-meta">${total} page${total !== 1 ? 's' : ''}${book.author ? ' · ' + gnEscHtml(book.author) : ''}</div>
        ${progressHtml}
        <button class="gn-page-card-open-btn" aria-label="${openLabel} ${gnEscHtml(book.title)}">${openLabel}</button>
      </div>
    `;

    card.querySelector('.gn-page-card-open-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        // "Read Again" resets progress so the book reopens from page 1
        if (openLabel === 'Read Again') {
            try { localStorage.removeItem(GN_LS_KEY(book.id)); } catch { /* silent */ }
            gnRefreshAllCards();
        }
        gnOpenBook(book.id);
        gnOpenModal();
    });
    card.addEventListener('click', () => {
        gnOpenBook(book.id);
        gnOpenModal();
    });

    li.appendChild(card);
    return li;
}

// ------------------------------------------------------------
// Keyboard Controls
// ------------------------------------------------------------

function gnHandleKeydown(e) {
    // Don't steal keys from form fields
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;

    // Focus trap (Tab)
    if (e.key === 'Tab') {
        const focusable = Array.from(gn.modal.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), [tabindex="0"]'
        )).filter((el) => el.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault(); first.focus();
        }
        return;
    }

    if (!gn.isOpen) return;

    switch (e.key) {
        case 'Escape':
            if (gn.tocOpen) { gnToggleToc(); break; }
            gnCloseModal();
            break;
        case 'ArrowLeft':
            if (!gn.isLibrary) { e.preventDefault(); gnPrevPage(); }
            break;
        case 'ArrowRight':
            if (!gn.isLibrary) { e.preventDefault(); gnNextPage(); }
            break;
        case '+':
        case '=':
            if (!gn.isLibrary) { e.preventDefault(); gnZoomIn(); }
            break;
        case '-':
            if (!gn.isLibrary) { e.preventDefault(); gnZoomOut(); }
            break;
        case '0':
            if (!gn.isLibrary) { e.preventDefault(); gnZoomReset(); }
            break;
        case 'b':
        case 'B':
            if (!gn.isLibrary) { e.preventDefault(); gnToggleBookmark(); }
            break;
        case 't':
        case 'T':
            if (!gn.isLibrary) { e.preventDefault(); gnToggleToc(); }
            break;
        case 'm':
        case 'M':
            if (!gn.isLibrary) { e.preventDefault(); gnMagnify(); }
            break;
        case 'f':
        case 'F':
            if (!gn.isLibrary) { e.preventDefault(); gnToggleFullscreen(); }
            break;
    }
}

// ------------------------------------------------------------
// Wheel / Scroll-to-page-turn
// ------------------------------------------------------------

let _gnWheelLast = 0;

function gnHandleWheel(e) {
    if (!gn.isOpen || gn.isLibrary || gn.viewMode === 'scroll') return;
    // Ignore events that originate inside a real scrollable element other than the stage
    let node = e.target;
    while (node && node !== gn.modal) {
        if (node !== gn.refs.stage && (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth)) return;
        node = node.parentElement;
    }
    e.preventDefault();
    const now = Date.now();
    if (now - _gnWheelLast < 400) return; // throttle
    _gnWheelLast = now;
    if (e.deltaY > 0) gnNextPage();
    else if (e.deltaY < 0) gnPrevPage();
}

// ------------------------------------------------------------
// Fullscreen
// ------------------------------------------------------------

function gnToggleFullscreen() {
    const r = gn.refs;
    if (!document.fullscreenEnabled) return;

    if (!document.fullscreenElement) {
        gn.modal.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen().catch(() => {});
    }
}

function gnUpdateFullscreenUI() {
    const isFs = !!document.fullscreenElement;
    const btn  = gn.refs.fullscreen;
    if (!btn) return;
    btn.setAttribute('aria-pressed', isFs ? 'true' : 'false');
    btn.classList.toggle('gn-icon-btn--active', isFs);
    // Swap icon
    btn.innerHTML = isFs
        ? `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <polyline points="4 14 10 14 10 20"/>
             <polyline points="20 10 14 10 14 4"/>
             <line x1="10" y1="14" x2="3" y2="21"/>
             <line x1="21" y1="3" x2="14" y2="10"/>
           </svg>`
        : `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <polyline points="15 3 21 3 21 9"/>
             <polyline points="9 21 3 21 3 15"/>
             <line x1="21" y1="3" x2="14" y2="10"/>
             <line x1="3" y1="21" x2="10" y2="14"/>
           </svg>`;
}

// ------------------------------------------------------------
// Modal Event Binding
// ------------------------------------------------------------

function gnBindModalEvents() {
    const r = gn.refs;

    // Close
    r.closeBtn.addEventListener('click', gnCloseModal);

    // Click backdrop (outside .gn-modal) to close
    gn.modal.addEventListener('click', (e) => {
        if (e.target === gn.modal) gnCloseModal();
    });

    // Back to Library
    r.backBtn.addEventListener('click', () => gnShowLibrary());

    // Navigation
    r.firstBtn.addEventListener('click', gnFirstPage);
    r.prevBtn.addEventListener('click',  gnPrevPage);
    r.nextBtn.addEventListener('click',  gnNextPage);
    r.lastBtn.addEventListener('click',  gnLastPage);
    r.stagePrev.addEventListener('click', gnPrevPage);
    r.stageNext.addEventListener('click', gnNextPage);

    r.pageInput.addEventListener('change', () => {
        const val = parseInt(r.pageInput.value, 10);
        if (!isNaN(val)) gnGoToPage(val - 1);
    });

    // View mode
    [r.viewSingle, r.viewDouble, r.viewTriple, r.viewScroll].forEach((btn) => {
        if (!btn) return;
        btn.addEventListener('click', () => gnSetViewMode(btn.dataset.view));
    });

    // Zoom
    r.zoomIn.addEventListener('click',    gnZoomIn);
    r.zoomOut.addEventListener('click',   gnZoomOut);
    r.zoomReset.addEventListener('click', gnZoomReset);

    // Zoom input: commit on blur/enter, arrow keys ±5%
    r.zoomDisplay.addEventListener('change', () => {
        const val = parseInt(r.zoomDisplay.value, 10);
        gnSetZoom(isNaN(val) ? gn.zoom : val / 100);
    });
    r.zoomDisplay.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp')   { e.preventDefault(); gnSetZoom(gn.zoom + 0.05); }
        if (e.key === 'ArrowDown') { e.preventDefault(); gnSetZoom(gn.zoom - 0.05); }
        if (e.key === 'Enter')     { r.zoomDisplay.blur(); }
    });

    // Magnify
    r.magnify.addEventListener('click', gnMagnify);

    // Bookmark
    r.bookmark.addEventListener('click', gnToggleBookmark);
    r.bookmarkWrap.addEventListener('mouseenter', () => {
        clearTimeout(gn._bmHideTimer);
        const bms = gn.currentBook ? gnLoadBookmarks(gn.currentBook.id) : [];
        if (bms.length) { gnBuildBookmarkDropdown(); r.bookmarkDropdown.hidden = false; }
    });
    r.bookmarkWrap.addEventListener('mouseleave', () => {
        gn._bmHideTimer = setTimeout(() => { r.bookmarkDropdown.hidden = true; }, 200);
    });

    // TOC
    r.tocToggle.addEventListener('click', gnToggleToc);
    r.tocClose.addEventListener('click',  gnToggleToc);

    // Fullscreen
    r.fullscreen.addEventListener('click', gnToggleFullscreen);
    document.addEventListener('fullscreenchange', gnUpdateFullscreenUI);
}

// ------------------------------------------------------------
// Utility
// ------------------------------------------------------------

/** Escapes HTML special characters to prevent XSS. */
function gnEscHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ------------------------------------------------------------
// Initialization & Page-Load Detection
// ------------------------------------------------------------

/** Called every time custom.html loads (books are discovered). */
function gnSetup() {
    gnDiscoverBooks();
    if (!gn.books.length) return;

    // Build modal once (stays in <body> permanently)
    if (!document.getElementById(GN_MODAL_ID)) {
        gnBuildModal();
    }

    // Render preview cards on the page
    gnRenderPageCards();
    gnRenderInlineCards();
    gnWireOpenLinks();

    // Wire the "Open Library" button
    const openBtn = document.getElementById('gn-open-library-btn');
    if (openBtn) {
        // Remove previous listener (page re-loaded)
        openBtn.replaceWith(openBtn.cloneNode(true));
        const freshBtn = document.getElementById('gn-open-library-btn');
        if (freshBtn) {
            freshBtn.addEventListener('click', () => {
                gnShowLibrary();
                gnOpenModal();
            });
        }
    }
}

/** Sets up a MutationObserver to detect when custom.html is loaded via AJAX. */
function gnInit() {
    const contentBody = document.getElementById('content-body');
    if (!contentBody) return;

    // Check immediately (page might already be loaded)
    if (contentBody.querySelector('.graphic-novel-book')) {
        gnSetup();
    }

    // Watch for future AJAX navigations
    const observer = new MutationObserver(() => {
        if (contentBody.querySelector('.graphic-novel-book')) {
            gnSetup();
        }
    });

    observer.observe(contentBody, { childList: true });

    // Close the modal when the browser navigates back/forward
    window.addEventListener('popstate', () => {
        if (gn.isOpen) gnCloseModal();
    });
}

// Boot
if (document.readyState !== 'loading') {
    gnInit();
} else {
    document.addEventListener('DOMContentLoaded', gnInit);
}

})(); // end IIFE

/* ============================================================
   GRAPHIC NOVEL / COMIC BOOK VIEWER
   END
============================================================ */
