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
const GN_URL_BOOK_PARAM = 'gnbook';
const GN_URL_PAGE_PARAM = 'gnpage';
const GN_TTS_WPM        = 200; // words-per-minute used for the estimated reading time badge
const GN_TTS_SUPPORTED  = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
const GN_TTS_VOICE_LS_KEY = 'gn-tts-voice-uri';
const GN_TTS_RATE_LS_KEY  = 'gn-tts-rate';
const GN_HL_LS_PREFIX     = 'gn-highlights-'; // per-book highlight storage, separate from gn-progress-*
const GN_HL_COLORS        = ['yellow', 'green', 'blue', 'pink', 'orange'];

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
    _scrollSaveTimer: null,
    _scrollFrameReady: null,
    _scrollSettleObserver: null,
    _scrollSettleIdleTimer:    null,
    _scrollSettleHardCapTimer: null,
    _scrollSettleCancelEvents: null,
    _scrollSettleStage:    null,
    _scrollTrackerSuspended: false,
    _wheelGraceUntil: 0,
    magnifyOn:       false,
    _magnifierMove:  null,
    _magnifierLeave: null,
    _bmHideTimer:    null,
    // Text-to-speech (read aloud) state
    ttsPlaying:        false,
    ttsAutoAdvance:    true,
    _ttsUtterance:     null,
    _ttsWordMap:       null,
    _ttsWordMapPage:   null,
    _ttsWordIndex:     0,
    _ttsFullText:      '',
    _ttsAutoAdvancing: false,
    _ttsPageOffset:    0, // which page within a multi-page spread (double/triple) is being read
    ttsClickToReadOn:  false,
    _ttsContextAction: null,
    ttsVoiceURI:       '', // selected SpeechSynthesisVoice.voiceURI, persisted across sessions
    ttsRate:           1,  // selected playback speed, persisted across sessions
    ttsPanelOpen:      false, // whether the read-aloud controls section is expanded (closed by default, per book)
    _ttsProgress:      null, // { page, wordIndex } remembered resume point, persisted per book
    _ttsSaveTimer:     null,
    // Text highlighter state (novel books only)
    hlPanelOpen:       false,
    _hlPending:        null, // { mode: 'create', container, start, end, page, text } | { mode: 'manage', id }
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
                      aria-label="First page" data-tooltip="First Page">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="19" y1="20" x2="9" y2="12"/><line x1="9" y1="12" x2="19" y2="4"/>
                  <line x1="5" y1="19" x2="5" y2="5"/>
                </svg>
              </button>
              <button class="gn-icon-btn" id="gn-prev-page"
                      aria-label="Previous page" data-tooltip="Previous Page (←)">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>

              <div class="gn-page-counter" aria-live="polite" aria-atomic="true">
                <input type="text" class="gn-page-input" id="gn-page-input"
                       min="1" aria-label="Go to page"/>
                <span>&nbsp;/&nbsp;</span>
                <span id="gn-total-pages">0</span>
              </div>

              <button class="gn-icon-btn" id="gn-next-page"
                      aria-label="Next page" data-tooltip="Next Page (→)">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
              <button class="gn-icon-btn" id="gn-last-page"
                      aria-label="Last page" data-tooltip="Last Page">
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
                      data-tooltip="Single Page View"
                      data-view="single">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2">
                  <rect x="7" y="3" width="10" height="18" rx="1"/>
                </svg>
              </button>
              <button class="gn-icon-btn" id="gn-view-double"
                      aria-label="Two-page spread" aria-pressed="false"
                      data-tooltip="Two-Page Spread"
                      data-view="double">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2">
                  <rect x="2" y="4" width="9" height="16" rx="1"/>
                  <rect x="13" y="4" width="9" height="16" rx="1"/>
                </svg>
              </button>
              <button class="gn-icon-btn gn-view-btn-triple" id="gn-view-triple"
                      aria-label="Three-page view" aria-pressed="false"
                      data-tooltip="Three-Page View"
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
                      data-tooltip="Scroll / Detail View"
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
                      aria-label="Zoom out" data-tooltip="Zoom Out (−)">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <circle cx="11" cy="11" r="7"/>
                  <line x1="8" y1="11" x2="14" y2="11"/>
                  <line x1="16.5" y1="16.5" x2="21" y2="21"/>
                </svg>
              </button>
              <div class="gn-page-counter">
                <input type="text" class="gn-page-input" id="gn-zoom-display"
                       aria-label="Zoom percentage"
                       value="100" maxlength="3"/>
                <span>%</span>
              </div>
              <button class="gn-icon-btn" id="gn-zoom-in"
                      aria-label="Zoom in" data-tooltip="Zoom In (+)">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <circle cx="11" cy="11" r="7"/>
                  <line x1="11" y1="8" x2="11" y2="14"/>
                  <line x1="8" y1="11" x2="14" y2="11"/>
                  <line x1="16.5" y1="16.5" x2="21" y2="21"/>
                </svg>
              </button>
              <button class="gn-icon-btn" id="gn-zoom-reset"
                      aria-label="Reset zoom" data-tooltip="Reset Zoom (0)">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <polyline points="3 3 3 8 8 8"/>
                </svg>
              </button>
            </div>

            <div class="gn-toolbar-sep"></div>

            <!-- Read Aloud group -->
            <div class="gn-toolbar-group" id="gn-tts-group">
              <button class="gn-icon-btn" id="gn-tts-section-toggle"
                      aria-label="Show or hide read-aloud controls" aria-pressed="false"
                      data-tooltip="Show/Hide Read Aloud Controls">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
                </svg>
              </button>
              <div class="gn-toolbar-group gn-tts-controls" id="gn-tts-controls" hidden>
              <button class="gn-icon-btn" id="gn-tts-prev"
                      aria-label="Read previous page" data-tooltip="Read Previous Page">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="19 20 9 12 19 4 19 20"/>
                  <line x1="5" y1="19" x2="5" y2="5"/>
                </svg>
              </button>
              <button class="gn-icon-btn" id="gn-tts-skip-back"
                      aria-label="Skip back 10 words" data-tooltip="Skip Back 10 Words">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="11 19 2 12 11 5 11 19"/>
                  <polygon points="22 19 13 12 22 5 22 19"/>
                </svg>
              </button>
              <button class="gn-icon-btn" id="gn-tts-toggle"
                      aria-label="Read page aloud" aria-pressed="false"
                      data-tooltip="Read Aloud (R)">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="6 4 18 12 6 20 6 4"/>
                </svg>
              </button>
              <button class="gn-icon-btn" id="gn-tts-skip-forward"
                      aria-label="Skip ahead 10 words" data-tooltip="Skip Ahead 10 Words">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="13 19 22 12 13 5 13 19"/>
                  <polygon points="2 19 11 12 2 5 2 19"/>
                </svg>
              </button>
              <button class="gn-icon-btn" id="gn-tts-next"
                      aria-label="Read next page" data-tooltip="Read Next Page">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="5 4 15 12 5 20 5 4"/>
                  <line x1="19" y1="5" x2="19" y2="19"/>
                </svg>
              </button>
              <button class="gn-icon-btn" id="gn-tts-autoplay"
                      aria-label="Auto-advance pages while reading" aria-pressed="true"
                      data-tooltip="Auto-Advance Pages">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="17 1 21 5 17 9"/>
                  <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                  <polyline points="7 23 3 19 7 15"/>
                  <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
              </button>
              <button class="gn-icon-btn" id="gn-tts-click-read"
                      aria-label="Toggle read-from-here mode" aria-pressed="false"
                      data-tooltip="Read From Here (Right-Click Text)">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 12V5.5a1.5 1.5 0 0 1 3 0V11"/>
                  <path d="M12 11.5V4.5a1.5 1.5 0 0 1 3 0V11"/>
                  <path d="M15 11.5v-2a1.5 1.5 0 0 1 3 0V13"/>
                  <path d="M18 13v-1a1.5 1.5 0 0 1 3 0v5a6 6 0 0 1-6 6h-2.5a6 6 0 0 1-5-2.7L5 15.5A1.5 1.5 0 1 1 7.5 13.8L9 15.5"/>
                </svg>
              </button>
              <select class="gn-tts-voice-select" id="gn-tts-voice-select"
                      aria-label="Read-aloud voice">
                <option value="">Default Voice</option>
              </select>
              <select class="gn-tts-voice-select" id="gn-tts-rate-select"
                      aria-label="Read-aloud speed">
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1" selected>1x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="1.75">1.75x</option>
                <option value="2">2x</option>
              </select>
              <span class="gn-reading-time" id="gn-reading-time" hidden></span>
              </div>
            </div>

            <div class="gn-toolbar-sep"></div>

            <!-- Actions group -->
            <div class="gn-toolbar-group">
              <button class="gn-icon-btn" id="gn-magnify"
                      aria-label="Magnify page" data-tooltip="Magnify / Detail View (M)">
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
                        data-tooltip="Bookmark (B)">
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span class="gn-bm-badge" id="gn-bm-badge" hidden></span>
                </button>
                <div class="gn-bookmark-dropdown" id="gn-bookmark-dropdown" hidden></div>
              </div>
              <button class="gn-icon-btn" id="gn-highlights-toggle"
                      aria-label="Highlights" aria-pressed="false"
                      data-tooltip="Highlights (H)">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M8.5 15.5 3 21l1-4.5L15.5 5 19 8.5 8.5 15.5Z"/>
                  <path d="M14 6.5 17.5 10"/>
                  <path d="M3 21h5"/>
                </svg>
              </button>
              <button class="gn-icon-btn" id="gn-toc-toggle"
                      aria-label="Table of contents" aria-pressed="false"
                      data-tooltip="Table of Contents (T)">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="18" x2="15" y2="18"/>
                </svg>
              </button>
              <button class="gn-icon-btn" id="gn-fullscreen"
                      aria-label="Toggle fullscreen" aria-pressed="false"
                      data-tooltip="Fullscreen (S)">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 3 21 3 21 9"/>
                  <polyline points="9 21 3 21 3 15"/>
                  <line x1="21" y1="3" x2="14" y2="10"/>
                  <line x1="3" y1="21" x2="10" y2="14"/>
                </svg>
              </button>
              <button class="gn-icon-btn" id="gn-export-pdf"
                      aria-label="Export to PDF" data-tooltip="Export to PDF (Print)">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
              </button>
              <button class="gn-icon-btn" id="gn-shortcuts"
                      aria-label="Keyboard shortcuts" aria-pressed="false"
                      data-tooltip="Keyboard Shortcuts (?)">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2"/>
                  <line x1="6" y1="9" x2="6" y2="9"/>
                  <line x1="10" y1="9" x2="10" y2="9"/>
                  <line x1="14" y1="9" x2="14" y2="9"/>
                  <line x1="18" y1="9" x2="18" y2="9"/>
                  <line x1="6" y1="12" x2="6" y2="12"/>
                  <line x1="10" y1="12" x2="10" y2="12"/>
                  <line x1="14" y1="12" x2="14" y2="12"/>
                  <line x1="18" y1="12" x2="18" y2="12"/>
                  <line x1="7" y1="16" x2="17" y2="16"/>
                </svg>
              </button>
            </div>

          </div><!-- end .gn-reader-toolbar -->

          <!-- Reader body: stage + optional TOC -->
          <div class="gn-reader-body" id="gn-reader-body">

            <button class="gn-nav-arrow gn-nav-arrow--prev" id="gn-stage-prev"
                    aria-label="Previous page" data-tooltip="Previous Page (←)">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none"
                   stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>

            <div class="gn-stage" id="gn-stage">
              <div class="gn-pages-wrap" id="gn-pages-wrap"></div>
            </div>

            <button class="gn-nav-arrow gn-nav-arrow--next" id="gn-stage-next"
                    aria-label="Next page" data-tooltip="Next Page (→)">
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

            <!-- Highlights panel -->
            <div class="gn-hl-panel" id="gn-highlights-panel" hidden
                 role="complementary" aria-label="Highlights">
              <div class="gn-hl-panel-header">
                <span class="gn-hl-panel-title">Highlights</span>
                <button class="gn-icon-btn" id="gn-highlights-close"
                        aria-label="Close highlights panel">
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
              <div class="gn-hl-panel-search">
                <input type="text" id="gn-highlights-search"
                       placeholder="Search highlights…" aria-label="Search highlights">
              </div>
              <div class="gn-hl-list" id="gn-highlights-list"></div>
            </div>

          </div><!-- end .gn-reader-body -->

        </div><!-- end #gn-reader -->

        <!-- Keyboard shortcuts help dialog -->
        <div class="gn-shortcuts-overlay" id="gn-shortcuts-overlay" hidden>
          <div class="gn-shortcuts-dialog" role="dialog" aria-modal="true" aria-label="Keyboard Shortcuts">
            <div class="gn-shortcuts-header">
              <span class="gn-shortcuts-title">Keyboard Shortcuts</span>
              <button class="gn-icon-btn" id="gn-shortcuts-close" aria-label="Close keyboard shortcuts">
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
            <ul class="gn-shortcuts-list">
              <li><span class="gn-shortcuts-keys"><kbd>&larr;</kbd><kbd>&rarr;</kbd></span><span>Previous / next page</span></li>
              <li><span class="gn-shortcuts-keys"><kbd>+</kbd><kbd>-</kbd></span><span>Zoom in / out</span></li>
              <li><span class="gn-shortcuts-keys"><kbd>0</kbd></span><span>Reset zoom</span></li>
              <li><span class="gn-shortcuts-keys"><kbd>B</kbd></span><span>Toggle Bookmark, current page</span></li>
              <li><span class="gn-shortcuts-keys"><kbd>T</kbd></span><span>Toggle table of contents</span></li>
              <li><span class="gn-shortcuts-keys"><kbd>H</kbd></span><span>Toggle highlights panel, (only for text novels)</span></li>
              <li><span class="gn-shortcuts-keys"><kbd>M</kbd></span><span>Toggle magnifier</span></li>
              <li><span class="gn-shortcuts-keys"><kbd>R</kbd></span><span>Read page aloud, (only for text novels)</span></li>
              <li><span class="gn-shortcuts-keys"><kbd>S</kbd></span><span>Toggle fullscreen</span></li>
              <li><span class="gn-shortcuts-keys"><kbd>?</kbd></span><span>Toggle this help</span></li>
              <li><span class="gn-shortcuts-keys"><kbd>Esc</kbd></span><span>Close panel / viewer</span></li>
            </ul>
          </div>
        </div>

        <!-- Highlighter color-picker / manage popup (shown next to a text selection or an existing highlight) -->
        <div class="gn-hl-popup" id="gn-hl-popup" hidden role="menu" aria-label="Highlight options">
          <button class="gn-hl-color gn-hl-color--yellow" data-color="yellow" title="Yellow" aria-label="Yellow highlight"></button>
          <button class="gn-hl-color gn-hl-color--green"  data-color="green"  title="Green"  aria-label="Green highlight"></button>
          <button class="gn-hl-color gn-hl-color--blue"   data-color="blue"   title="Blue"   aria-label="Blue highlight"></button>
          <button class="gn-hl-color gn-hl-color--pink"   data-color="pink"   title="Pink"   aria-label="Pink highlight"></button>
          <button class="gn-hl-color gn-hl-color--orange" data-color="orange" title="Orange" aria-label="Orange highlight"></button>
          <button class="gn-hl-remove" id="gn-hl-remove-btn" hidden aria-label="Remove highlight" title="Remove highlight">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>

        <!-- Read-from-here context menu (shown on right-click when the mode is active) -->
        <div class="gn-tts-context-menu" id="gn-tts-context-menu" hidden role="menu">
          <button class="gn-tts-context-item" id="gn-tts-context-read" role="menuitem">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="6 4 18 12 6 20 6 4"/>
            </svg>
            Read from Here
          </button>
        </div>

      </div><!-- end .gn-modal -->
    `;

    document.body.appendChild(overlay);
    gn.modal = overlay;
    gnCacheRefs();
    gnBindModalEvents();

    // Populate the voice picker now, and again once the browser finishes loading voices
    gnPopulateTtsVoices();
    if (GN_TTS_SUPPORTED) window.speechSynthesis.addEventListener('voiceschanged', gnPopulateTtsVoices);

    // Restore the saved playback speed
    gn.ttsRate = gnLoadTtsRatePref();
    if (gn.refs.ttsRateSelect) gn.refs.ttsRateSelect.value = String(gn.ttsRate);

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
        // Highlighter
        hlToggle:      q('gn-highlights-toggle'),
        hlPanel:       q('gn-highlights-panel'),
        hlClose:       q('gn-highlights-close'),
        hlSearchInput: q('gn-highlights-search'),
        hlList:        q('gn-highlights-list'),
        hlPopup:       q('gn-hl-popup'),
        hlRemoveBtn:   q('gn-hl-remove-btn'),
        hlColorButtons: gn.modal.querySelectorAll('.gn-hl-color'),
        fullscreen:    q('gn-fullscreen'),
        exportPdf:     q('gn-export-pdf'),
        shortcutsBtn:      q('gn-shortcuts'),
        shortcutsOverlay:  q('gn-shortcuts-overlay'),
        shortcutsClose:    q('gn-shortcuts-close'),
        ttsToggle:     q('gn-tts-toggle'),
        ttsAutoplay:   q('gn-tts-autoplay'),
        ttsPrev:       q('gn-tts-prev'),
        ttsNext:       q('gn-tts-next'),
        ttsSkipBack:   q('gn-tts-skip-back'),
        ttsSkipForward: q('gn-tts-skip-forward'),
        ttsClickRead:  q('gn-tts-click-read'),
        ttsContextMenu: q('gn-tts-context-menu'),
        ttsContextRead: q('gn-tts-context-read'),
        ttsVoiceSelect: q('gn-tts-voice-select'),
        ttsRateSelect:  q('gn-tts-rate-select'),
        ttsSectionToggle: q('gn-tts-section-toggle'),
        ttsControls:    q('gn-tts-controls'),
        ttsGroup:       q('gn-tts-group'),
        readingTime:   q('gn-reading-time'),
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
    // Flush any pending scroll-position save so progress isn't lost
    if (gn._scrollSaveTimer) {
        clearTimeout(gn._scrollSaveTimer);
        gn._scrollSaveTimer = null;
        gnSaveProgress();
    }
    gnStopScrollSettle();
    gnClearUrlParams();
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
    // Close shortcuts help if open
    if (gn.refs.shortcutsOverlay && !gn.refs.shortcutsOverlay.hidden) gn.refs.shortcutsOverlay.hidden = true;
    gnHideTtsContextMenu();
    gnStopTts();
    gnHideHighlightPopup();
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
    // Flush any pending scroll-position save before leaving the current book
    if (gn._scrollSaveTimer) {
        clearTimeout(gn._scrollSaveTimer);
        gn._scrollSaveTimer = null;
        gnSaveProgress();
    }
    gnStopScrollSettle();
    gnClearUrlParams();
    gn.isLibrary = true;
    const r = gn.refs;
    r.library.classList.remove('gn-hidden');
    r.reader.classList.add('gn-hidden');
    r.backBtn.classList.add('gn-hidden');
    r.barTitle.classList.add('gn-hidden');
    r.barTitle.textContent = '';
    // Close TOC if open
    if (gn.tocOpen) gnToggleToc();
    // Close highlights panel if open
    if (gn.hlPanelOpen) gnToggleHighlightsPanel();
    gnHideHighlightPopup();
    // Close shortcuts help if open
    if (gn.refs.shortcutsOverlay && !gn.refs.shortcutsOverlay.hidden) gn.refs.shortcutsOverlay.hidden = true;
    gnStopTts();
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

/** Opens a book by ID, switching to reader view. Pass explicitPage (0-indexed) to override saved progress, e.g. from a deep-linked URL. */
function gnOpenBook(bookId, explicitPage) {
    const book = gn.books.find((b) => b.id === bookId);
    if (!book) return;

    // Flush any pending scroll-position save for whatever book was open before this one
    if (gn._scrollSaveTimer) {
        clearTimeout(gn._scrollSaveTimer);
        gn._scrollSaveTimer = null;
        gnSaveProgress();
    }

    gnStopTts();
    gn.currentBook = book;

    gnHideHighlightPopup();

    // Ignore wheel events for a moment after opening — guards against residual
    // trackpad/mouse momentum silently flipping pages in the freshly-opened book
    gn._wheelGraceUntil = Date.now() + 500;

    // Restore saved progress
    const progress = gnLoadProgress(bookId);
    gn.viewMode   = (progress && progress.viewMode) || 'single';
    gn.zoom       = (progress && progress.zoom)     || 1.0;
    gn.currentPage = progress ? Math.min(progress.lastPage, book.pages.length - 1) : 0;
    gn._ttsProgress = progress?.ttsProgress || null;
    gn.ttsPanelOpen = progress?.ttsPanelOpen || false;
    if (typeof explicitPage === 'number') {
        gn.currentPage = Math.max(0, Math.min(explicitPage, book.pages.length - 1));
    }
    // Triple view is not supported for novel books
    if (book.type === 'novel' && gn.viewMode === 'triple') gn.viewMode = 'double';

    gnShowReaderView();
}

/** Switches the modal to the reader view. */
function gnShowReaderView() {
    gn.isLibrary = false;
    gnUpdateUrl();
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
    gnUpdateTtsAvailability();
    gnApplyTtsPanelState();
    gnUpdateHighlightAvailability();
    if (gn.hlPanelOpen) gnRenderHighlightsPanel();

    // Focus the reader area
    r.stage.focus && r.stage.setAttribute('tabindex', '-1');
    r.stage.focus();
}

/** Stops any in-progress scroll-settle correction (see gnStartScrollSettle). */
function gnStopScrollSettle() {
    gn._scrollTrackerSuspended = false;
    if (gn._scrollSettleObserver) {
        gn._scrollSettleObserver.disconnect();
        gn._scrollSettleObserver = null;
    }
    clearTimeout(gn._scrollSettleIdleTimer);
    clearTimeout(gn._scrollSettleHardCapTimer);
    if (gn._scrollSettleCancelEvents && gn._scrollSettleStage) {
        gn._scrollSettleCancelEvents.forEach((evt) => {
            gn._scrollSettleStage.removeEventListener(evt, gnStopScrollSettle);
        });
    }
    gn._scrollSettleCancelEvents = null;
    gn._scrollSettleStage = null;
}

/**
 * Keeps the target frame pinned to the top of the stage in scroll mode while its
 * still-loading images/text reflow the page above it (the initial scrollIntoView()
 * lands using placeholder-sized frames, then drifts once real content loads in).
 * Backs off the moment the user starts scrolling/interacting on their own.
 */
function gnStartScrollSettle(stage, wrap, targetIndex) {
    gnStopScrollSettle();
    // While we're actively re-pinning the scroll position ourselves, the resulting
    // 'scroll' events can hit gn._scrollTracker mid-layout-flux and make it briefly
    // miscompute the current page from geometry, overwriting the page we already
    // know is correct. Suspend the tracker for the duration of this correction —
    // it resumes as soon as the user does any real scrolling/interacting.
    gn._scrollTrackerSuspended = true;
    const rearm = () => {
        // Sliding idle window: keep correcting as long as layout keeps shifting
        // (e.g. several images in a long preceding chapter loading in one by one),
        // only stopping once things have been quiet for a bit.
        clearTimeout(gn._scrollSettleIdleTimer);
        gn._scrollSettleIdleTimer = setTimeout(gnStopScrollSettle, 700);
    };
    const observer = new ResizeObserver(() => {
        const target = wrap.children[targetIndex];
        if (target) target.scrollIntoView({ block: 'start', behavior: 'auto' });
        rearm();
    });
    Array.from(wrap.children).forEach((el) => observer.observe(el));
    gn._scrollSettleObserver = observer;
    rearm();
    // Absolute safety net regardless of how long images keep trickling in
    gn._scrollSettleHardCapTimer = setTimeout(gnStopScrollSettle, 10000);
    // Any real user interaction cancels the auto re-pinning immediately
    gn._scrollSettleCancelEvents = ['wheel', 'touchstart', 'pointerdown'];
    gn._scrollSettleStage = stage;
    gn._scrollSettleCancelEvents.forEach((evt) => {
        stage.addEventListener(evt, gnStopScrollSettle, { passive: true, once: true });
    });
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
    gnHideHighlightPopup();

    // Page transition
    wrap.classList.add('gn-page-transition');

    setTimeout(() => {
        // Remove any previous scroll tracker
        if (gn._scrollTracker) {
            r.stage.removeEventListener('scroll', gn._scrollTracker);
            gn._scrollTracker = null;
        }
        gnStopScrollSettle();

        wrap.innerHTML = '';
        const stage   = r.stage;
        const total   = book.pages.length;

        // Set CSS classes for view mode on stage and wrap
        stage.className = 'gn-stage' + (gn.viewMode === 'scroll' ? ' gn-stage--scroll' : '');
        wrap.className  = 'gn-pages-wrap' + (gn.viewMode === 'scroll' ? ' gn-pages-wrap--scroll' : '');

        if (gn.viewMode === 'scroll') {
            // All pages stacked
            const readyPromises = [];
            book.pages.forEach((page, i) => {
                const { frame, ready } = gnBuildPageFrame(page, i, book);
                wrap.appendChild(frame);
                readyPromises[i] = ready;
            });
            gn._scrollFrameReady = readyPromises;

            // Update page counter as user scrolls
            let ticking = false;
            gn._scrollTracker = () => {
                if (ticking) return;
                ticking = true;
                requestAnimationFrame(() => {
                    ticking = false;
                    // While a programmatic scroll-settle correction is in flight, skip —
                    // its own 'scroll' events can hit mid-layout-flux and misread the
                    // page from geometry, overwriting a target we already know is correct.
                    if (gn._scrollTrackerSuspended) return;
                    const frames = wrap.children;
                    if (!frames.length) return;
                    const stageRect = stage.getBoundingClientRect();
                    // The "current" page is whichever frame's top has scrolled up to (or
                    // past) the stage's top edge — NOT whichever has the most visible area.
                    // Using visible area instead misidentifies short pages: right after
                    // landing on one via scrollIntoView({block:'start'}), the next page can
                    // already show more visible height, flipping currentPage forward by one.
                    const threshold = stageRect.top + 2;
                    let bestIndex = 0;
                    for (let i = 0; i < frames.length; i++) {
                        const rect = frames[i].getBoundingClientRect();
                        if (rect.top <= threshold) {
                            bestIndex = i;
                        } else {
                            break; // frames are stacked top-to-bottom in order
                        }
                    }
                    if (bestIndex !== gn.currentPage) {
                        gn.currentPage = bestIndex;
                        gnUpdateNavUI();
                        gnUpdateBookmarkUI();
                        gnUpdateTocHighlight();
                        gnHideHighlightPopup();
                        // Debounce progress saves so rapid scrolling doesn't spam localStorage,
                        // but still persist the reached page (needed for resume + completion state).
                        clearTimeout(gn._scrollSaveTimer);
                        gn._scrollSaveTimer = setTimeout(gnSaveProgress, 250);
                    }
                });
            };
            stage.addEventListener('scroll', gn._scrollTracker, { passive: true });

            // Wait for the target page and everything above it to fully finish loading
            // (including embedded images) BEFORE scrolling at all, rather than scrolling
            // immediately and correcting for drift afterward - this is the actual source
            // of truth for "is layout stable yet", not a fixed delay/timeout guess.
            const targetPage = gn.currentPage;
            Promise.all(readyPromises.slice(0, targetPage + 1)).then(() => {
                // Bail if the user navigated elsewhere while we were waiting
                if (gn.currentBook !== book || gn.viewMode !== 'scroll' || gn.currentPage !== targetPage) return;
                gnUpdateReadingTime();
                gnPrepareTtsForCurrentPage();
                const target = wrap.children[targetPage];
                if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
                // Backup safety net for any late reflow we didn't account for (fonts, etc.)
                gnStartScrollSettle(stage, wrap, targetPage);
            });
        } else {
            const step = gnGetStep();
            const start = gn.currentPage;
            const frameReadies = [];
            for (let i = start; i < start + step && i < total; i++) {
                const { frame, ready } = gnBuildPageFrame(book.pages[i], i, book);
                wrap.appendChild(frame);
                frameReadies.push(ready);
            }
            Promise.all(frameReadies).then(() => {
                // Bail if the user navigated elsewhere while we were waiting
                if (gn.currentBook !== book || gn.currentPage !== start) return;
                gnUpdateReadingTime();
                gnPrepareTtsForCurrentPage();
            });
        }

        // Apply zoom in scroll mode
        gnApplyZoomVar();

        wrap.classList.remove('gn-page-transition');
        gnUpdateTocHighlight();
        gnPreloadAdjacent();
    }, 80);
}

/** Builds a single page frame element (wrapper + img or fetched text content).
 *  Returns { frame, ready } where ready resolves once the frame's content —
 *  including any embedded images — has fully finished loading. */
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
    // No loading="lazy" here: this element is detached until onload appends it,
    // and Chrome's viewport-distance heuristic can't evaluate a detached image -
    // it sometimes just defers the fetch forever, deadlocking the placeholder/spinner.

    const ready = new Promise((resolveReady) => {
        img.onload = () => {
            img.classList.remove('gn-img-loading');
            placeholder.remove();
            frame.appendChild(img);
            resolveReady();
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
            resolveReady();
        };
    });

    img.src = page.src;
    return { frame, ready };
}

/** Builds a text page frame; fetches the HTML fragment and injects it asynchronously.
 *  Returns { frame, ready } where ready also waits for embedded images to load. */
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

    const ready = gnFetchTextPage(page.src).then((html) => {
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
        // Re-wrap any saved highlight ranges for this page — offsets are relative
        // to content.textContent and are stable since wrapping never changes text length.
        gnApplyHighlightsToFrame(content, book.id, index);
        // The fetched fragment's own <img>s (e.g. chapter art) can keep reflowing
        // this frame's height well after the text itself is in the DOM — wait for
        // them too so "ready" actually means "height is stable".
        const imgs = Array.from(content.querySelectorAll('img'));
        return Promise.all(imgs.map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
        })));
    });

    return { frame, ready };
}

// ------------------------------------------------------------
// Page Navigation
// ------------------------------------------------------------

/** Navigates to the given 0-indexed page number. */
function gnGoToPage(n) {
    const book  = gn.currentBook;
    if (!book) return;
    gn._ttsPageOffset = 0;
    gnHideTtsContextMenu();
    gnHideHighlightPopup();
    if (!gn._ttsAutoAdvancing) gnStopTts();
    const total = book.pages.length;
    n = Math.max(0, Math.min(n, total - 1));
    // Align to step boundary (except in scroll mode)
    if (gn.viewMode !== 'scroll') {
        const step = gnGetStep();
        n = Math.floor(n / step) * step;
    }
    gn.currentPage = n;
    // In scroll mode pages are already in the DOM — wait for the target and
    // everything above it to fully settle (images/text loaded) before scrolling,
    // same rationale as the initial scroll-mode render in gnRenderPage().
    if (gn.viewMode === 'scroll' && gn.refs.pagesWrap.children.length > 0) {
        const stage = gn.refs.stage;
        const wrap  = gn.refs.pagesWrap;
        const readyPromises = gn._scrollFrameReady || [];
        Promise.all(readyPromises.slice(0, n + 1)).then(() => {
            // Bail if the user navigated elsewhere while we were waiting
            if (gn.currentBook !== book || gn.viewMode !== 'scroll' || gn.currentPage !== n) return;
            gnUpdateReadingTime();
            gnPrepareTtsForCurrentPage();
            const target = wrap.children[n];
            if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
            // Backup safety net for any late reflow we didn't account for (fonts, etc.)
            gnStartScrollSettle(stage, wrap, n);
        });
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
    if (r.ttsPrev) r.ttsPrev.disabled = atStart;
    if (r.ttsNext) r.ttsNext.disabled = atEnd;

    // Page input: show 1-indexed; show spread range in multi-page modes
    const displayEnd = Math.min(cur + step - 1, total - 1);
    r.pageInput.value = (step > 1 && displayEnd > cur)
        ? `${cur + 1}–${displayEnd + 1}`
        : cur + 1;
    r.pageInput.max   = total;
    gnSizePageInput();

    r.totalPages.textContent = total;

    if (step > 1 && displayEnd > cur) {
        r.pageInput.setAttribute('aria-label', `Current pages ${cur + 1}–${displayEnd + 1} of ${total}`);
    } else {
        r.pageInput.setAttribute('aria-label', `Page ${cur + 1} of ${total}`);
    }
}

/** Grows/shrinks #gn-page-input's width to fit its current text (e.g. "1" vs "125–126")
 *  instead of clipping at a fixed width. */
function gnSizePageInput() {
    const input = gn.refs.pageInput;
    if (!input) return;
    const len = String(input.value).length;
    input.style.width = `${Math.max(2, len) + 1.5}ch`;
}

// ------------------------------------------------------------
// Viewing Modes
// ------------------------------------------------------------


/** Sets the view mode and re-renders. */
function gnSetViewMode(mode) {
    if (gn.viewMode === mode) return;
    gnStopTts();
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
        // Carry over computed text styles explicitly (theme-aware — reads the live page's
        // actual colors rather than assuming the dark reader chrome's palette)
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
            `color:${cs.color}`,
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
    glass.style.background = getComputedStyle(frame).backgroundColor;
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
    // Clamp so the pan never goes negative (leaves a blank leading gap) or past the
    // far edge (leaves a blank trailing gap) — without this it "sticks" near edges.
    const bgPX = Math.max(0, Math.min(bgW - GLASS_W, relX * bgW - GLASS_W / 2));
    const bgPY = Math.max(0, Math.min(bgH - GLASS_H, relY * bgH - GLASS_H / 2));

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
    // Only one right-side panel (TOC / Highlights) can be open at a time
    if (gn.tocOpen && gn.hlPanelOpen) gnToggleHighlightsPanel();
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
        ttsProgress: gn._ttsProgress || null,
        ttsPanelOpen: gn.ttsPanelOpen,
    };
    try {
        localStorage.setItem(GN_LS_KEY(gn.currentBook.id), JSON.stringify(data));
    } catch {
        // localStorage unavailable - silent fail
    }
    gnUpdateUrl();
    // Update all card surfaces to reflect new progress
    gnRefreshAllCards();
}

function gnRefreshAllCards() {
    gnRenderPageCards();
    gnRenderInlineCards();
    gnRenderLibrary();
}

// ------------------------------------------------------------
// URL State (deep-linkable book + page)
// ------------------------------------------------------------

/** Reflects the current book + page in the URL query string, without adding a history entry. */
function gnUpdateUrl() {
    if (!gn.currentBook) return;
    const url = new URL(location.href);
    url.searchParams.set(GN_URL_BOOK_PARAM, gn.currentBook.id);
    url.searchParams.set(GN_URL_PAGE_PARAM, String(gn.currentPage + 1)); // 1-indexed for readability
    history.replaceState(history.state, '', url);
}

/** Removes the book/page params from the URL, e.g. when returning to the library or closing the reader. */
function gnClearUrlParams() {
    const url = new URL(location.href);
    if (!url.searchParams.has(GN_URL_BOOK_PARAM) && !url.searchParams.has(GN_URL_PAGE_PARAM)) return;
    url.searchParams.delete(GN_URL_BOOK_PARAM);
    url.searchParams.delete(GN_URL_PAGE_PARAM);
    history.replaceState(history.state, '', url);
}

/** Opens directly to the book/page referenced in the URL query string, if any (deep-link support). */
function gnRestoreFromUrl() {
    if (gn.isOpen) return;
    const params = new URLSearchParams(location.search);
    const bookId = params.get(GN_URL_BOOK_PARAM);
    if (!bookId) return;
    const book = gn.books.find((b) => b.id === bookId);
    if (!book) return;
    const pageParam = Number.parseInt(params.get(GN_URL_PAGE_PARAM), 10);
    const pageIndex = Number.isFinite(pageParam) ? Math.max(0, pageParam - 1) : 0;
    gnOpenBook(bookId, pageIndex);
    gnOpenModal();
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
            if (gn.refs.hlPopup && !gn.refs.hlPopup.hidden) { gnHideHighlightPopup(); break; }
            if (gn.refs.ttsContextMenu && !gn.refs.ttsContextMenu.hidden) { gnHideTtsContextMenu(); break; }
            if (gn.refs.shortcutsOverlay && !gn.refs.shortcutsOverlay.hidden) { gnToggleShortcuts(); break; }
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
        case 'h':
        case 'H':
            if (!gn.isLibrary && gn.currentBook?.type === 'novel') { e.preventDefault(); gnToggleHighlightsPanel(); }
            break;
        case 'm':
        case 'M':
            if (!gn.isLibrary) { e.preventDefault(); gnMagnify(); }
            break;
        case 's':
        case 'S':
            if (!gn.isLibrary) { e.preventDefault(); gnToggleFullscreen(); }
            break;
        case 'r':
        case 'R':
            if (!gn.isLibrary) { e.preventDefault(); gnToggleTts(); }
            break;
        case '?':
        case '/':
            e.preventDefault(); gnToggleShortcuts();
            break;
    }
}

// ------------------------------------------------------------
// Wheel / Scroll-to-page-turn
// ------------------------------------------------------------

let _gnWheelLast = 0;

function gnHandleWheel(e) {
    if (!gn.isOpen || gn.isLibrary || gn.viewMode === 'scroll') return;
    if (Date.now() < gn._wheelGraceUntil) return;
    // Ignore events that originate inside a real scrollable element other than the stage
    let node = e.target;
    while (node && node !== gn.modal) {
        if (node !== gn.refs.stage && (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth)) return;
        node = node.parentElement;
    }
    e.preventDefault();
    // Ignore weak/trailing deltas from decaying trackpad momentum so it can't
    // keep silently flipping pages after the user has stopped scrolling
    if (Math.abs(e.deltaY) < 15) return;
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

// ------------------------------------------------------------
// Keyboard Shortcuts Help Dialog
// ------------------------------------------------------------

function gnToggleShortcuts() {
    const r = gn.refs;
    if (!r.shortcutsOverlay) return;
    const opening = r.shortcutsOverlay.hidden;
    r.shortcutsOverlay.hidden = !opening;
    r.shortcutsBtn?.setAttribute('aria-pressed', opening ? 'true' : 'false');
    r.shortcutsBtn?.classList.toggle('gn-icon-btn--active', opening);
    if (opening) r.shortcutsClose?.focus();
    else r.shortcutsBtn?.focus();
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
// Text-to-Speech / Read Aloud
// ------------------------------------------------------------

/** Finds the rendered .gn-text-page element for the given page index (defaults to the current page). */
function gnGetActiveTextPage(pageIndex = gn.currentPage) {
    const wrap = gn.refs.pagesWrap;
    if (!wrap) return null;
    const frame = Array.from(wrap.children).find((f) => Number(f.dataset.pageIndex) === pageIndex);
    return frame ? frame.querySelector('.gn-text-page') : null;
}

/** Resolves the actual page index being read aloud, accounting for double/triple-page spreads. */
function gnGetTtsReadIndex() {
    const total = gn.currentBook?.pages.length || 0;
    return Math.min(gn.currentPage + (gn._ttsPageOffset || 0), Math.max(total - 1, 0));
}

/** Resolves the page actually feeding the live word map (i.e., genuinely being read aloud),
 *  independent of gn.currentPage. In scroll mode gn.currentPage tracks scroll position, and the
 *  read-aloud highlight's own scrollIntoView({block:'center'}) can nudge that past a page boundary,
 *  making it disagree with the page that's really being read. Falls back to gn.currentPage when
 *  nothing is being read yet. */
function gnGetTtsActiveReadPage() {
    const frame = gn._ttsWordMapPage?.closest('.gn-page-frame');
    const idx = frame ? Number(frame.dataset.pageIndex) : NaN;
    return Number.isFinite(idx) ? idx : gn.currentPage;
}

/** Shows/hides the entire read-aloud section \u2014 only text novel books have anything to read. */
function gnUpdateTtsAvailability() {
    const r = gn.refs;
    const show = GN_TTS_SUPPORTED && gn.currentBook?.type === 'novel';
    if (r.ttsGroup) {
        r.ttsGroup.hidden = !show;
        // Hide the toolbar separators flanking the group too, so no empty gap is left behind
        const prevSep = r.ttsGroup.previousElementSibling;
        const nextSep = r.ttsGroup.nextElementSibling;
        if (prevSep?.classList.contains('gn-toolbar-sep')) prevSep.hidden = !show;
        if (nextSep?.classList.contains('gn-toolbar-sep')) nextSep.hidden = !show;
    }
    if (!show && r.readingTime) r.readingTime.hidden = true;
}

/** Shows/hides the whole read-aloud controls group, remembering the choice per book. */
function gnToggleTtsPanel() {
    gn.ttsPanelOpen = !gn.ttsPanelOpen;
    gnApplyTtsPanelState();
    gnSaveProgress();
}

function gnApplyTtsPanelState() {
    const r = gn.refs;
    if (r.ttsControls) r.ttsControls.hidden = !gn.ttsPanelOpen;
    if (r.ttsSectionToggle) {
        r.ttsSectionToggle.setAttribute('aria-pressed', gn.ttsPanelOpen ? 'true' : 'false');
        r.ttsSectionToggle.classList.toggle('gn-icon-btn--active', gn.ttsPanelOpen);
    }
}

/** Fills the voice picker with the browser's available voices, preserving the saved choice. */
function gnPopulateTtsVoices() {
    const sel = gn.refs.ttsVoiceSelect;
    if (!sel || !GN_TTS_SUPPORTED) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return; // some browsers load voices asynchronously - retried on 'voiceschanged'

    sel.innerHTML = '<option value="">Default Voice</option>';
    voices.forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v.voiceURI;
        opt.textContent = `${v.name} (${v.lang})`;
        sel.appendChild(opt);
    });

    const preferred = gn.ttsVoiceURI || gnLoadTtsVoicePref();
    sel.value = voices.some((v) => v.voiceURI === preferred) ? preferred : '';
    gn.ttsVoiceURI = sel.value;
}

function gnLoadTtsVoicePref() {
    try { return localStorage.getItem(GN_TTS_VOICE_LS_KEY) || ''; } catch { return ''; }
}

function gnSaveTtsVoicePref(uri) {
    try { localStorage.setItem(GN_TTS_VOICE_LS_KEY, uri || ''); } catch { /* silent */ }
}

/** Resolves the currently selected SpeechSynthesisVoice, if any. */
function gnGetSelectedTtsVoice() {
    if (!GN_TTS_SUPPORTED || !gn.ttsVoiceURI) return null;
    return window.speechSynthesis.getVoices().find((v) => v.voiceURI === gn.ttsVoiceURI) || null;
}

/** Applies a newly picked voice, restarting the current word immediately if already reading. */
function gnOnTtsVoiceChange() {
    const sel = gn.refs.ttsVoiceSelect;
    gn.ttsVoiceURI = sel?.value || '';
    gnSaveTtsVoicePref(gn.ttsVoiceURI);
    if (gn.ttsPlaying) gnSpeakFromWordIndex(gn._ttsWordIndex || 0);
}

function gnLoadTtsRatePref() {
    try {
        const val = parseFloat(localStorage.getItem(GN_TTS_RATE_LS_KEY));
        return Number.isFinite(val) ? val : 1;
    } catch { return 1; }
}

function gnSaveTtsRatePref(rate) {
    try { localStorage.setItem(GN_TTS_RATE_LS_KEY, String(rate)); } catch { /* silent */ }
}

/** Applies a newly picked speed, restarting the current word immediately if already reading. */
function gnOnTtsRateChange() {
    const sel = gn.refs.ttsRateSelect;
    const rate = parseFloat(sel?.value);
    gn.ttsRate = Number.isFinite(rate) ? rate : 1;
    gnSaveTtsRatePref(gn.ttsRate);
    if (gn.ttsPlaying) gnSpeakFromWordIndex(gn._ttsWordIndex || 0);
}

/** Enables the read-aloud button once the current page's text frame exists, and resumes
 *  playback automatically when a page change was triggered by auto-advance. */
function gnPrepareTtsForCurrentPage() {
    const r = gn.refs;
    if (!r.ttsToggle) return;
    const textPage = gnGetActiveTextPage();
    const disabled = !GN_TTS_SUPPORTED || gn.currentBook?.type !== 'novel' || !textPage;
    r.ttsToggle.disabled = disabled;
    if (r.ttsSkipBack)    r.ttsSkipBack.disabled    = disabled;
    if (r.ttsSkipForward) r.ttsSkipForward.disabled = disabled;
    if (gn.ttsPlaying) gnSpeakCurrentPage();
}

/** Updates the "pN ~M min read" badge for the current page's word count. */
function gnUpdateReadingTime() {
    const r = gn.refs;
    if (!r.readingTime) return;
    const textPage = gn.currentBook?.type === 'novel' ? gnGetActiveTextPage() : null;
    const words = textPage ? (textPage.textContent.match(/\S+/g) || []).length : 0;
    if (!words) { r.readingTime.hidden = true; return; }
    r.readingTime.textContent = `p${gn.currentPage + 1} ~${Math.max(1, Math.round(words / GN_TTS_WPM))} min read`;
    r.readingTime.hidden = false;
}

/** Wraps each word of a text page's content in a <span> for read-aloud highlighting.
 *  Returns { start, end, el } offsets that match the container's original textContent. */
function gnWrapWordsForTts(container) {
    const wordMap = [];
    let offset = 0;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);

    textNodes.forEach((textNode) => {
        const chunks = textNode.nodeValue.match(/\s+|\S+/g) || [];
        const frag = document.createDocumentFragment();
        chunks.forEach((chunk) => {
            if (/\S/.test(chunk)) {
                const span = document.createElement('span');
                span.className = 'gn-tts-word';
                span.textContent = chunk;
                frag.appendChild(span);
                wordMap.push({ start: offset, end: offset + chunk.length, el: span });
            } else {
                frag.appendChild(document.createTextNode(chunk));
            }
            offset += chunk.length;
        });
        textNode.parentNode.replaceChild(frag, textNode);
    });

    return wordMap;
}

function gnClearTtsHighlight() {
    gn.refs.pagesWrap?.querySelectorAll('.gn-tts-word--active').forEach((el) => el.classList.remove('gn-tts-word--active'));
}

function gnUpdateTtsUI() {
    const btn = gn.refs.ttsToggle;
    if (!btn) return;
    btn.setAttribute('aria-pressed', gn.ttsPlaying ? 'true' : 'false');
    btn.classList.toggle('gn-icon-btn--active', gn.ttsPlaying);
    btn.innerHTML = gn.ttsPlaying
        ? `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <rect x="6" y="4" width="4" height="16"/>
             <rect x="14" y="4" width="4" height="16"/>
           </svg>`
        : `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <polygon points="6 4 18 12 6 20 6 4"/>
           </svg>`;
}

/** Stops any in-progress read-aloud playback and clears highlighting. */
function gnStopTts() {
    if (!gn.ttsPlaying && !gn._ttsUtterance) return;
    if (GN_TTS_SUPPORTED) window.speechSynthesis.cancel();
    clearTimeout(gn._ttsSaveTimer);
    gn.ttsPlaying = false;
    gn._ttsUtterance = null;
    gn._ttsWordMap = null;
    gn._ttsWordMapPage = null;
    gn._ttsWordIndex = 0;
    gn._ttsFullText = '';
    gn._ttsPageOffset = 0;
    gnClearTtsHighlight();
    gnUpdateTtsUI();
    gnSaveProgress(); // remember the resume point (gn._ttsProgress) immediately
}

/** Builds (once per page frame) the word map + full text used for read-aloud highlighting and seeking. */
function gnEnsureTtsWordMap() {
    const textPage = gnGetActiveTextPage(gnGetTtsReadIndex());
    if (!textPage) return null;
    if (gn._ttsWordMap && gn._ttsWordMapPage === textPage) return gn._ttsWordMap;
    gn._ttsFullText = textPage.textContent;
    gn._ttsWordMap = gnWrapWordsForTts(textPage);
    gn._ttsWordMapPage = textPage;
    gn._ttsWordIndex = 0;
    return gn._ttsWordMap;
}

/** Speaks the current page's text aloud, highlighting each word as it's spoken.
 *  Resumes from the last remembered word if this page was where playback last stopped. */
function gnSpeakCurrentPage() {
    if (!GN_TTS_SUPPORTED) return;
    const wordMap = gnEnsureTtsWordMap();
    if (!wordMap) { gnStopTts(); return; }
    if (!wordMap.length) {
        // Nothing to read on this page — skip ahead or stop
        if (gn.ttsAutoAdvance) gnTtsAdvanceToNextPage();
        else gnStopTts();
        return;
    }
    gn.ttsPlaying = true;
    const resumeAt = gn._ttsProgress && gn._ttsProgress.page === gnGetTtsReadIndex()
        ? Math.min(gn._ttsProgress.wordIndex, wordMap.length - 1)
        : 0;
    gnSpeakFromWordIndex(resumeAt);
}

/** Speaks the current page starting at the given word index — used by skip-forward/back. */
function gnSpeakFromWordIndex(startIndex) {
    const wordMap = gn._ttsWordMap;
    if (!wordMap || !wordMap.length) { gnStopTts(); return; }
    if (startIndex >= wordMap.length) {
        // Skipped past the end of this page
        if (gn.ttsAutoAdvance) gnTtsAdvanceToNextPage();
        else gnStopTts();
        return;
    }
    startIndex = Math.max(0, startIndex);

    window.speechSynthesis.cancel();
    gnClearTtsHighlight();

    const baseOffset = wordMap[startIndex].start;
    const text = gn._ttsFullText.slice(baseOffset);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = gnGetSelectedTtsVoice();
    utterance.rate = gn.ttsRate || 1;
    let wordCursor = startIndex;
    utterance.onboundary = (e) => {
        if (e.name && e.name !== 'word') return;
        const charIndex = e.charIndex + baseOffset;
        while (wordCursor < wordMap.length - 1 && wordMap[wordCursor].end <= charIndex) wordCursor++;
        gn._ttsWordIndex = wordCursor;
        gn._ttsProgress = { page: gnGetTtsReadIndex(), wordIndex: wordCursor };
        clearTimeout(gn._ttsSaveTimer);
        gn._ttsSaveTimer = setTimeout(gnSaveProgress, 1000);
        gnClearTtsHighlight();
        const word = wordMap[wordCursor];
        if (word) {
            word.el.classList.add('gn-tts-word--active');
            word.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    };
    utterance.onend = () => {
        if (gn._ttsUtterance !== utterance) return; // superseded by a skip/cancel
        gnClearTtsHighlight();
        if (!gn.ttsPlaying) return; // stopped manually mid-utterance
        if (gn.ttsAutoAdvance) gnTtsAdvanceToNextPage();
        else gnStopTts();
    };
    utterance.onerror = () => {
        if (gn._ttsUtterance !== utterance) return; // superseded by a skip/cancel
        gnStopTts();
    };

    gn._ttsUtterance = utterance;
    gn._ttsWordIndex = startIndex;
    gn.ttsPlaying = true;
    gnUpdateTtsUI();
    // Chrome/Edge intermittently swallow speak() when it's called in the same tick as
    // cancel() (a long-standing engine bug) - the utterance silently never starts, and
    // speechSynthesis.speaking can get stuck true. Deferring one tick reliably avoids it.
    // This is why "read next page" seemed to work "on and off": whether it failed depended
    // on how fast the page's text/images finished loading before this ran.
    setTimeout(() => {
        if (gn._ttsUtterance !== utterance) return; // superseded before the deferred speak fired
        window.speechSynthesis.speak(utterance);
    }, 50);
}

/** Advances to the next page within the current spread, or to the next spread/page,
 *  and keeps reading — or stops once the book ends. */
function gnTtsAdvanceToNextPage() {
    const book  = gn.currentBook;
    const total = book?.pages.length || 0;
    if (!book) { gnStopTts(); return; }
    const step = gn.viewMode === 'scroll' ? 1 : gnGetStep();

    // Double/triple-page spreads show several pages at once — read each one in turn
    // before flipping to the next spread.
    const nextOffset = (gn._ttsPageOffset || 0) + 1;
    if (gn.viewMode !== 'scroll' && nextOffset < step && gn.currentPage + nextOffset < total) {
        gn._ttsPageOffset = nextOffset;
        gnSpeakCurrentPage();
        return;
    }

    if (gn.currentPage + step >= total) {
        gn._ttsProgress = null; // finished the book — start over next time
        gnStopTts();
        return;
    }
    gn._ttsPageOffset = 0;
    gn._ttsAutoAdvancing = true;
    gnNextPage();
    gn._ttsAutoAdvancing = false;
    // gnPrepareTtsForCurrentPage() resumes reading once the new page's text frame is ready
}

function gnToggleTts() {
    if (!GN_TTS_SUPPORTED) return;
    if (gn.ttsPlaying) gnStopTts();
    else gnSpeakCurrentPage();
}

function gnToggleTtsAutoAdvance() {
    gn.ttsAutoAdvance = !gn.ttsAutoAdvance;
    const btn = gn.refs.ttsAutoplay;
    btn?.setAttribute('aria-pressed', gn.ttsAutoAdvance ? 'true' : 'false');
    btn?.classList.toggle('gn-icon-btn--active', gn.ttsAutoAdvance);
}

/** Skips the read-aloud position forward/back by N words on the current page. */
function gnTtsSkipWords(delta) {
    if (!GN_TTS_SUPPORTED || !gn.currentBook) return;
    const wordMap = gnEnsureTtsWordMap();
    if (!wordMap || !wordMap.length) return;
    gn.ttsPlaying = true;
    gnSpeakFromWordIndex((gn._ttsWordIndex || 0) + delta);
}

/** Jumps to the previous/next page and (re)starts reading it, cutting off any speech in progress. */
function gnTtsJumpAndRead(delta) {
    if (!GN_TTS_SUPPORTED || !gn.currentBook) return;
    // Null this out BEFORE cancel(): cancel() asynchronously fires the in-progress utterance's
    // onend/onerror, and their "superseded" guard (`gn._ttsUtterance !== utterance`) only works
    // if this no longer matches by the time that fires. Otherwise that stale onend still passes
    // the guard, sees gn.ttsPlaying === true, and calls gnTtsAdvanceToNextPage() itself - racing
    // with the explicit gnPrevPage()/gnNextPage() below and skipping/misplacing the target page
    // (the intermittent "next page doesn't start reading" symptom).
    gn._ttsUtterance = null;
    window.speechSynthesis.cancel();
    gnClearTtsHighlight();
    gn.ttsPlaying = true;
    gnUpdateTtsUI();
    gn._ttsAutoAdvancing = true; // page frame's onReady resumes reading once it lands
    if (gn.viewMode === 'scroll') {
        // Navigate off the page actually being read, not the scroll-tracked gn.currentPage
        // (see gnGetTtsActiveReadPage for why those two can disagree in scroll mode).
        const total = gn.currentBook.pages.length;
        const target = Math.max(0, Math.min(gnGetTtsActiveReadPage() + delta, total - 1));
        gnGoToPage(target);
    } else if (delta < 0) {
        gnPrevPage();
    } else {
        gnNextPage();
    }
    gn._ttsAutoAdvancing = false;
}

// ------------------------------------------------------------
// Read From Here (right-click a word to start reading there)
// ------------------------------------------------------------

function gnToggleTtsClickToRead() {
    gn.ttsClickToReadOn = !gn.ttsClickToReadOn;
    const btn = gn.refs.ttsClickRead;
    btn?.setAttribute('aria-pressed', gn.ttsClickToReadOn ? 'true' : 'false');
    btn?.classList.toggle('gn-icon-btn--active', gn.ttsClickToReadOn);
    gn.refs.readerBody?.classList.toggle('gn-tts-click-mode', gn.ttsClickToReadOn);
    gnHideTtsContextMenu();
}

/** Resolves the character offset (relative to container's full textContent) of a range's start. */
function gnCharOffsetForRangeStart(container, range) {
    if (!range || !container.contains(range.startContainer)) return null;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    let offset = 0;
    let node;
    while ((node = walker.nextNode())) {
        if (node === range.startContainer) return offset + range.startOffset;
        offset += node.nodeValue.length;
    }
    return null;
}

/** Resolves the character offset (relative to container's full textContent) under a click point. */
function gnCharOffsetFromPoint(container, x, y) {
    let range = null;
    if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(x, y);
    } else if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(x, y);
        if (pos) {
            range = document.createRange();
            range.setStart(pos.offsetNode, pos.offset);
        }
    }
    return gnCharOffsetForRangeStart(container, range);
}

/** Resolves the character offset of the start of the active (non-collapsed) text selection, if any. */
function gnCharOffsetFromSelectionStart(container) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    return gnCharOffsetForRangeStart(container, sel.getRangeAt(0));
}

/** Finds the word map entry containing (or nearest after) a given character offset. */
function gnFindWordIndexForOffset(wordMap, charOffset) {
    for (let i = 0; i < wordMap.length; i++) {
        if (charOffset < wordMap[i].end) return i;
    }
    return wordMap.length - 1;
}

/** Right-click handler active only while "read from here" mode is on. */
function gnHandleTtsContextMenu(e) {
    if (!gn.ttsClickToReadOn) return;
    const frame = e.target.closest('.gn-page-frame--text');
    const textPage = frame?.querySelector('.gn-text-page');
    if (!textPage) return;
    // A right-click on selected text reads from the selection's first word, not the click point
    const charOffset = gnCharOffsetFromSelectionStart(textPage) ?? gnCharOffsetFromPoint(textPage, e.clientX, e.clientY);
    if (charOffset === null) return;
    e.preventDefault();

    const pageIndex = Number(frame.dataset.pageIndex);
    let wordMap;
    if (gn._ttsWordMap && gn._ttsWordMapPage === textPage) {
        wordMap = gn._ttsWordMap;
    } else {
        gn._ttsFullText = textPage.textContent;
        wordMap = gnWrapWordsForTts(textPage);
        gn._ttsWordMap = wordMap;
        gn._ttsWordMapPage = textPage;
    }
    if (!wordMap.length) return;
    const wordIndex = gnFindWordIndexForOffset(wordMap, charOffset);

    gnShowTtsContextMenu(e.clientX, e.clientY, () => {
        if (gn.viewMode === 'scroll') {
            gn.currentPage = pageIndex;
            gn._ttsPageOffset = 0;
            gnUpdateNavUI();
            gnUpdateBookmarkUI();
            gnUpdateTocHighlight();
        } else {
            gn._ttsPageOffset = pageIndex - gn.currentPage;
        }
        gnSpeakFromWordIndex(wordIndex);
    });
}

function gnShowTtsContextMenu(x, y, onConfirm) {
    const menu = gn.refs.ttsContextMenu;
    if (!menu) return;
    gn._ttsContextAction = onConfirm;
    menu.hidden = false;
    const rect = menu.getBoundingClientRect();
    const maxX = Math.max(8, window.innerWidth - rect.width - 8);
    const maxY = Math.max(8, window.innerHeight - rect.height - 8);
    menu.style.left = `${Math.min(x, maxX)}px`;
    menu.style.top  = `${Math.min(y, maxY)}px`;
}

function gnHideTtsContextMenu() {
    const menu = gn.refs.ttsContextMenu;
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    gn._ttsContextAction = null;
}

// ------------------------------------------------------------
// Text Highlighter (novel books only)
// ------------------------------------------------------------

const GN_HL_KEY = (bookId) => GN_HL_LS_PREFIX + bookId;

function gnLoadHighlights(bookId) {
    try {
        const arr = JSON.parse(localStorage.getItem(GN_HL_KEY(bookId)));
        return Array.isArray(arr) ? arr : [];
    } catch { return []; }
}

function gnSaveHighlights(bookId, arr) {
    try { localStorage.setItem(GN_HL_KEY(bookId), JSON.stringify(arr)); } catch { /* silent */ }
}

function gnGenHighlightId() {
    return `hl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Shows/hides the toolbar's highlights button — only text novels have anything to highlight. */
function gnUpdateHighlightAvailability() {
    const show = gn.currentBook?.type === 'novel';
    if (gn.refs.hlToggle) gn.refs.hlToggle.hidden = !show;
    if (!show && gn.hlPanelOpen) gnToggleHighlightsPanel();
    if (!show) gnHideHighlightPopup();
}

/** Resolves the character offsets of a Range relative to container's full textContent,
 *  clamping to container bounds when the selection extends outside of it (e.g. a
 *  double/triple-page spread where the user dragged across two page frames). */
function gnGetRangeCharOffsets(container, range) {
    if (!range) return null;
    const startInContainer = container.contains(range.startContainer);
    const endInContainer   = container.contains(range.endContainer);
    if (!startInContainer && !endInContainer) return null;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    let offset = 0, start = null, end = null, node;
    while ((node = walker.nextNode())) {
        const len = node.nodeValue.length;
        if (startInContainer && node === range.startContainer) start = offset + range.startOffset;
        if (endInContainer && node === range.endContainer)     end   = offset + range.endOffset;
        offset += len;
    }
    if (start === null) start = 0;      // selection began before this container
    if (end === null)   end   = offset; // selection continues past this container
    if (end <= start) return null;
    return { start, end };
}

/** Wraps the [start, end) character range of container's text in one or more
 *  <mark class="gn-highlight"> elements (multiple when the range spans several
 *  underlying text nodes, e.g. across paragraphs or inline elements). */
function gnApplyHighlightRange(container, start, end, color, id) {
    if (end <= start) return;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    const targets = [];
    let offset = 0, node;
    while ((node = walker.nextNode())) {
        const len = node.nodeValue.length;
        const nodeStart = offset, nodeEnd = offset + len;
        if (nodeEnd > start && nodeStart < end) {
            targets.push({ node, from: Math.max(0, start - nodeStart), to: Math.min(len, end - nodeStart) });
        }
        offset += len;
        if (offset >= end) break;
    }
    targets.forEach(({ node, from, to }) => {
        if (from >= to || !node.parentNode) return;
        const range = document.createRange();
        range.setStart(node, from);
        range.setEnd(node, to);
        const mark = document.createElement('mark');
        mark.className = 'gn-highlight';
        mark.dataset.color = color;
        mark.dataset.highlightId = id;
        try { range.surroundContents(mark); } catch { /* malformed range - skip this segment */ }
    });
}

/** Re-applies every saved highlight belonging to a given page onto its freshly-rendered frame. */
function gnApplyHighlightsToFrame(container, bookId, pageIndex) {
    gnLoadHighlights(bookId)
        .filter((h) => h.page === pageIndex)
        .forEach((h) => gnApplyHighlightRange(container, h.start, h.end, h.color, h.id));
}

/** Removes every <mark> rendered for a given highlight id (a highlight can render as
 *  several marks when its range spans multiple text nodes), merging their text back in. */
function gnUnwrapHighlightMarks(id) {
    const marks = gn.refs.pagesWrap?.querySelectorAll(`.gn-highlight[data-highlight-id="${CSS.escape(id)}"]`);
    marks?.forEach((mark) => {
        const parent = mark.parentNode;
        if (!parent) return;
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
        parent.normalize();
    });
}

function gnPositionHighlightPopup(rect) {
    const popup = gn.refs.hlPopup;
    if (!popup) return;
    popup.hidden = false;
    const popRect = popup.getBoundingClientRect();
    const gap = 8;
    let left = rect.left + rect.width / 2 - popRect.width / 2;
    let top  = rect.top - popRect.height - gap;
    if (top < 8) top = rect.bottom + gap; // flip below the selection if there's no room above
    left = Math.max(8, Math.min(window.innerWidth - popRect.width - 8, left));
    top  = Math.max(8, Math.min(window.innerHeight - popRect.height - 8, top));
    popup.style.left = `${left}px`;
    popup.style.top  = `${top}px`;
}

function gnHideHighlightPopup() {
    const popup = gn.refs.hlPopup;
    if (!popup || popup.hidden) return;
    popup.hidden = true;
    gn._hlPending = null;
}

/** Checks the live selection after mouseup/keyup and, if it's a non-collapsed
 *  selection inside a novel's text page, shows the color-picker popup for it. */
function gnHandleTextSelectionChange() {
    if (!gn.currentBook || gn.currentBook.type !== 'novel') return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return; // leave any existing popup as-is
    const range = sel.getRangeAt(0);
    const anchorEl = range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
    const textPage = anchorEl?.closest('.gn-text-page');
    if (!textPage) return;
    const offsets = gnGetRangeCharOffsets(textPage, range);
    if (!offsets) return;
    const frame = textPage.closest('.gn-page-frame');
    const pageIndex = frame ? Number(frame.dataset.pageIndex) : gn.currentPage;

    gn._hlPending = { mode: 'create', container: textPage, start: offsets.start, end: offsets.end, page: pageIndex, text: sel.toString() };
    if (gn.refs.hlRemoveBtn) gn.refs.hlRemoveBtn.hidden = true;
    gnPositionHighlightPopup(range.getBoundingClientRect());
}

/** Shows the manage popup (change color / remove) when an existing highlight is clicked. */
function gnHandleHighlightMarkClick(e) {
    const mark = e.target.closest('.gn-highlight');
    if (!mark) return;
    e.stopPropagation();
    gn._hlPending = { mode: 'manage', id: mark.dataset.highlightId };
    if (gn.refs.hlRemoveBtn) gn.refs.hlRemoveBtn.hidden = false;
    gnPositionHighlightPopup(mark.getBoundingClientRect());
}

function gnHandleHlColorClick(color) {
    if (!gn._hlPending) return;
    if (gn._hlPending.mode === 'create') gnCreateHighlightFromSelection(color);
    else if (gn._hlPending.mode === 'manage') gnChangeHighlightColor(gn._hlPending.id, color);
    gnHideHighlightPopup();
}

function gnCreateHighlightFromSelection(color) {
    if (!gn._hlPending || gn._hlPending.mode !== 'create' || !gn.currentBook) return;
    const { container, start, end, page, text } = gn._hlPending;
    const id = gnGenHighlightId();
    const bookId = gn.currentBook.id;
    const list = gnLoadHighlights(bookId);
    list.push({ id, page, start, end, text: text.slice(0, 300), color, ts: Date.now() });
    gnSaveHighlights(bookId, list);
    gnApplyHighlightRange(container, start, end, color, id);
    window.getSelection()?.removeAllRanges();
    gnRenderHighlightsPanel();
}

function gnChangeHighlightColor(id, color) {
    if (!gn.currentBook) return;
    const bookId = gn.currentBook.id;
    const list = gnLoadHighlights(bookId);
    const item = list.find((h) => h.id === id);
    if (!item) return;
    item.color = color;
    gnSaveHighlights(bookId, list);
    gn.refs.pagesWrap?.querySelectorAll(`.gn-highlight[data-highlight-id="${CSS.escape(id)}"]`)
        .forEach((m) => { m.dataset.color = color; });
    gnRenderHighlightsPanel();
}

function gnRemoveHighlightById(id) {
    if (!gn.currentBook) return;
    const bookId = gn.currentBook.id;
    gnSaveHighlights(bookId, gnLoadHighlights(bookId).filter((h) => h.id !== id));
    gnUnwrapHighlightMarks(id);
    gnHideHighlightPopup();
    gnRenderHighlightsPanel();
}

/** Opens/closes the right-side highlights panel. Only one right-side panel (TOC or
 *  Highlights) is shown at a time. */
function gnToggleHighlightsPanel() {
    gn.hlPanelOpen = !gn.hlPanelOpen;
    const r = gn.refs;
    if (gn.hlPanelOpen && gn.tocOpen) gnToggleToc();
    r.hlPanel.hidden = !gn.hlPanelOpen;
    r.readerBody.classList.toggle('gn-hl-open', gn.hlPanelOpen);
    r.hlToggle.setAttribute('aria-pressed', gn.hlPanelOpen ? 'true' : 'false');
    r.hlToggle.classList.toggle('gn-icon-btn--active', gn.hlPanelOpen);
    if (gn.hlPanelOpen) {
        gnRenderHighlightsPanel();
        r.hlSearchInput?.focus();
    }
}

/** Rebuilds the highlights panel list, filtered by the current search term. */
function gnRenderHighlightsPanel() {
    const list = gn.refs.hlList;
    if (!list || !gn.currentBook) return;
    const term = (gn.refs.hlSearchInput?.value || '').trim().toLowerCase();
    const highlights = gnLoadHighlights(gn.currentBook.id)
        .filter((h) => !term || h.text.toLowerCase().includes(term))
        .sort((a, b) => a.page - b.page || a.start - b.start);

    list.innerHTML = '';
    if (!highlights.length) {
        const msg = term ? 'No highlights match your search.' : 'No highlights yet. Select text in the novel to add one.';
        list.innerHTML = `<p class="gn-hl-empty">${msg}</p>`;
        return;
    }
    highlights.forEach((h) => {
        const item = document.createElement('button');
        item.className = 'gn-hl-item';
        item.innerHTML = `
          <span class="gn-hl-dot" data-color="${gnEscHtml(h.color)}"></span>
          <span class="gn-hl-item-body">
            <span class="gn-hl-item-text">${gnEscHtml(h.text)}</span>
            <span class="gn-hl-item-page">Page ${h.page + 1}</span>
          </span>
          <span class="gn-hl-item-delete" role="button" aria-label="Remove highlight">
            <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </span>`;
        item.addEventListener('click', (e) => {
            if (e.target.closest('.gn-hl-item-delete')) {
                e.stopPropagation();
                gnRemoveHighlightById(h.id);
                return;
            }
            gnGoToHighlight(h);
        });
        list.appendChild(item);
    });
}

/** Jumps to a highlight's page, then scrolls it into view and flashes it once rendered. */
function gnGoToHighlight(h) {
    gnGoToPage(h.page);
    gnFlashHighlightWhenReady(h.id);
}

function gnFlashHighlightWhenReady(id, attemptsLeft = 20) {
    const mark = gn.refs.pagesWrap?.querySelector(`.gn-highlight[data-highlight-id="${CSS.escape(id)}"]`);
    if (mark) {
        mark.scrollIntoView({ block: 'center', behavior: 'smooth' });
        mark.classList.add('gn-highlight--flash');
        setTimeout(() => mark.classList.remove('gn-highlight--flash'), 1600);
        return;
    }
    if (attemptsLeft <= 0) return;
    setTimeout(() => gnFlashHighlightWhenReady(id, attemptsLeft - 1), 100);
}

// ------------------------------------------------------------
// Export to PDF (browser print dialog)
// ------------------------------------------------------------

/** Renders every page of the current book into a hidden print area, then opens the print dialog. */
async function gnExportToPdf() {
    const book = gn.currentBook;
    if (!book) return;
    const btn = gn.refs.exportPdf;
    btn.disabled = true;
    btn.classList.add('gn-icon-btn--busy');
    // Browsers suggest document.title as the "Save as PDF" filename
    const prevTitle = document.title;
    document.title = book.title || prevTitle;
    try {
        await gnBuildPrintArea(book);
        window.print();
    } finally {
        document.title = prevTitle;
        btn.disabled = false;
        btn.classList.remove('gn-icon-btn--busy');
    }
}

/** Builds/fills #gn-print-area with a title page followed by every page of the book, in order. */
async function gnBuildPrintArea(book) {
    let area = document.getElementById('gn-print-area');
    if (!area) {
        area = document.createElement('div');
        area.id = 'gn-print-area';
        document.body.appendChild(area);
    }
    area.innerHTML = '';

    const cover = document.createElement('div');
    cover.className = 'gn-print-page gn-print-cover';
    cover.innerHTML = `
        <h1>${gnEscHtml(book.title)}</h1>
        ${book.author ? `<p class="gn-print-meta">${gnEscHtml(book.author)}</p>` : ''}
        ${book.year   ? `<p class="gn-print-meta">${gnEscHtml(book.year)}</p>`   : ''}
        <p class="gn-print-desc">${gnEscHtml(book.description)}</p>
    `;
    area.appendChild(cover);

    for (const page of book.pages) {
        const pageEl = document.createElement('div');
        pageEl.className = 'gn-print-page';
        if (page.type === 'text') {
            // Text/novel pages flow together in print - only the cover forces a page break
            pageEl.classList.add('gn-print-page--flow');
            const html = await gnFetchTextPage(page.src);
            const content = document.createElement('div');
            content.className = 'gn-text-page';
            content.innerHTML = html || '<p>Page unavailable.</p>';
            pageEl.appendChild(content);
        } else {
            pageEl.classList.add('gn-print-page--image');
            const img = document.createElement('img');
            img.alt = page.alt || '';
            img.src = page.src;
            pageEl.appendChild(img);
        }
        area.appendChild(pageEl);
    }

    // Wait for every image (page images + any embedded within novel page fragments) to finish loading
    const imgs = Array.from(area.querySelectorAll('img'));
    await Promise.all(imgs.map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => {
        img.addEventListener('load',  resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
    })));
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
    r.pageInput.addEventListener('input', gnSizePageInput);

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

    // Export to PDF (browser print dialog)
    r.exportPdf.addEventListener('click', gnExportToPdf);

    // Keyboard shortcuts help
    r.shortcutsBtn?.addEventListener('click', gnToggleShortcuts);
    r.shortcutsClose?.addEventListener('click', gnToggleShortcuts);
    r.shortcutsOverlay?.addEventListener('click', (e) => {
        if (e.target === r.shortcutsOverlay) gnToggleShortcuts();
    });

    // Read aloud
    r.ttsToggle?.addEventListener('click', gnToggleTts);
    r.ttsAutoplay?.addEventListener('click', gnToggleTtsAutoAdvance);
    r.ttsPrev?.addEventListener('click', () => gnTtsJumpAndRead(-1));
    r.ttsNext?.addEventListener('click', () => gnTtsJumpAndRead(1));
    r.ttsSkipBack?.addEventListener('click', () => gnTtsSkipWords(-10));
    r.ttsSkipForward?.addEventListener('click', () => gnTtsSkipWords(10));
    r.ttsVoiceSelect?.addEventListener('change', gnOnTtsVoiceChange);
    r.ttsRateSelect?.addEventListener('change', gnOnTtsRateChange);
    r.ttsSectionToggle?.addEventListener('click', gnToggleTtsPanel);

    // Read from here
    r.ttsClickRead?.addEventListener('click', gnToggleTtsClickToRead);
    r.pagesWrap?.addEventListener('contextmenu', gnHandleTtsContextMenu);
    r.ttsContextRead?.addEventListener('click', () => {
        const action = gn._ttsContextAction;
        gnHideTtsContextMenu();
        if (action) action();
    });
    document.addEventListener('click', (e) => {
        if (r.ttsContextMenu && !r.ttsContextMenu.hidden && !r.ttsContextMenu.contains(e.target)) {
            gnHideTtsContextMenu();
        }
    });

    // Text highlighter
    r.hlToggle?.addEventListener('click', gnToggleHighlightsPanel);
    r.hlClose?.addEventListener('click', gnToggleHighlightsPanel);
    r.hlSearchInput?.addEventListener('input', gnRenderHighlightsPanel);
    r.hlColorButtons?.forEach((btn) => btn.addEventListener('click', () => gnHandleHlColorClick(btn.dataset.color)));
    r.hlRemoveBtn?.addEventListener('click', () => {
        if (gn._hlPending?.mode === 'manage') gnRemoveHighlightById(gn._hlPending.id);
    });
    r.pagesWrap?.addEventListener('mouseup', () => setTimeout(gnHandleTextSelectionChange, 0));
    r.pagesWrap?.addEventListener('click', gnHandleHighlightMarkClick);
    document.addEventListener('mousedown', (e) => {
        if (r.hlPopup && !r.hlPopup.hidden && !r.hlPopup.contains(e.target)) gnHideHighlightPopup();
    });
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

    // Deep link: open directly to a book/page named in the URL, if any
    gnRestoreFromUrl();
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

    // Flush any pending debounced scroll-progress or read-aloud-progress save before the tab/page unloads
    window.addEventListener('pagehide', () => {
        if (gn._scrollSaveTimer) {
            clearTimeout(gn._scrollSaveTimer);
            gn._scrollSaveTimer = null;
            gnSaveProgress();
        }
        if (gn._ttsSaveTimer) {
            clearTimeout(gn._ttsSaveTimer);
            gn._ttsSaveTimer = null;
            gnSaveProgress();
        }
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
