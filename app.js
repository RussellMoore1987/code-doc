/**
 * app.js  –  Documentation App
 * Vanilla JS: navigation tree, Ajax content loading,
 * right-nav generation, scroll spy, sidebar resize & collapse,
 * light/dark theme toggle.
 */

/* ═══════════════════════════════════════════════════════════════
   NAVIGATION DATA  –  4 levels deep
   ═══════════════════════════════════════════════════════════════ */

const NAV_DATA = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    children: [
      {
        id: 'intro',
        label: 'Introduction',
        page: 'pages/intro.html'
      },
      {
        id: 'installation',
        label: 'Installation',
        page: 'pages/installation.html'
      },
      {
        id: 'first-steps-group',
        label: 'First Steps',
        children: [
          {
            id: 'first-steps',
            label: 'Overview',
            page: 'pages/first-steps.html'
          },
          {
            id: 'step1-group',
            label: 'Step 1 – Configure',
            children: [
              {
                id: 'step1-env',
                label: 'Environment Setup',
                page: 'pages/installation.html'
              },
              {
                id: 'deep-topic',
                label: 'Deep Topic',
                page: 'pages/deep-topic.html'
              }
            ]
          },
          {
            id: 'step2',
            label: 'Step 2 – Build & Run',
            page: 'pages/first-steps.html'
          }
        ]
      }
    ]
  },
  {
    id: 'advanced',
    label: 'Advanced Topics',
    children: [
      { id: 'config',   label: 'Configuration', page: 'pages/deep-topic.html' },
      { id: 'plugins',  label: 'Plugins',        page: 'pages/intro.html'      },
      { id: 'perf',     label: 'Performance',    page: 'pages/installation.html' }
    ]
  },
  {
    id: 'reference',
    label: 'Reference',
    children: [
      { id: 'api-ref',  label: 'API Reference',  page: 'pages/deep-topic.html' },
      { id: 'cli-ref',  label: 'CLI Reference',  page: 'pages/first-steps.html' },
      { id: 'faq',      label: 'FAQ',            page: 'pages/intro.html'      }
    ]
  }
];

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS & STATE
   ═══════════════════════════════════════════════════════════════ */

const MIN_SIDEBAR_WIDTH  = 220;   // absolute floor (px)
const DEFAULT_LEFT_WIDTH = 280;   // initial left sidebar width
const DEFAULT_RIGHT_WIDTH = 250;  // initial right sidebar width
const STORAGE_KEY_THEME  = 'devdocs-theme';
const STORAGE_KEY_LEFT_W = 'devdocs-left-w';
const STORAGE_KEY_RIGHT_W= 'devdocs-right-w';
const STORAGE_KEY_LEFT_C = 'devdocs-left-collapsed';
const STORAGE_KEY_RIGHT_C= 'devdocs-right-collapsed';

const state = {
  activeNavId:     null,
  scrollSpyObserver: null,
  leftCollapsed:   false,
  rightCollapsed:  false,
  leftWidth:       parseInt(localStorage.getItem(STORAGE_KEY_LEFT_W))  || DEFAULT_LEFT_WIDTH,
  rightWidth:      parseInt(localStorage.getItem(STORAGE_KEY_RIGHT_W)) || DEFAULT_RIGHT_WIDTH,
  currentRoute:    null,
  isNavigating:    false // Prevent recursion during navigation
};

/* ═══════════════════════════════════════════════════════════════
   DOM REFS
   ═══════════════════════════════════════════════════════════════ */

const elHtml         = document.documentElement;
const elLeftSidebar  = document.getElementById('sidebar-left');
const elRightSidebar = document.getElementById('sidebar-right');
const elLeftNav      = document.getElementById('left-nav');
const elRightNav     = document.getElementById('right-nav');
const elContentBody  = document.getElementById('content-body');
const elContentScroll= document.getElementById('content-scroll');
const elResizeLeft   = document.getElementById('resize-left');
const elResizeRight  = document.getElementById('resize-right');
const elCollapseLeft = document.getElementById('collapse-left');
const elCollapseRight= document.getElementById('collapse-right');
const elExpandLeft   = document.getElementById('expand-left');
const elExpandRight  = document.getElementById('expand-right');
const elStripLeft    = document.getElementById('strip-left');
const elStripRight   = document.getElementById('strip-right');
const elThemeToggle  = document.getElementById('theme-toggle');
const elAppWrapper   = document.getElementById('app-wrapper');

/* ═══════════════════════════════════════════════════════════════
   URL ROUTING & STATE MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */

/**
 * Parse URL hash into navigation state
 * Supports formats:
 * - #navId (page only, left nav item) 
 * - #navId#sectionId (page + section right nav item)
 */
function parseRoute(url = window.location.hash) {
  if (!url || !url.startsWith('#')) {
    return { navId: null, sectionId: null };
  }
  
  const hash = url.substring(1); // Remove '#'
  const parts = hash.split('#');
  
  if (parts.length === 1) {
    // Either #navId or #sectionId - need to determine which
    const navId = parts[0];
    const navItem = findNavItemById(navId);
    
    if (navItem && navItem.page) {
      // It's a nav item
      return { navId, sectionId: null };
    } else {
      // It's a section on current page
      return { navId: state.activeNavId, sectionId: navId };
    }
  } else if (parts.length === 2) {
    // #navId#sectionId
    return { navId: parts[0], sectionId: parts[1] };
  }
  
  return { navId: null, sectionId: null };
}

/**
 * Generate URL hash from navigation state
 */
function generateRoute(navId, sectionId = null) {
  if (!navId && !sectionId) return '';
  if (navId && sectionId) return `#${navId}#${sectionId}`;
  if (navId) return `#${navId}`;
  if (sectionId) return `#${sectionId}`;
  return '';
}

/**
 * Find nav item by ID (recursive search)
 */
function findNavItemById(id, items = NAV_DATA) {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findNavItemById(id, item.children);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Central navigation function - single source of truth
 * @param {string} navId - Navigation item ID
 * @param {string} sectionId - Section ID within the page
 * @param {boolean} pushHistory - Whether to update browser history
 * @param {boolean} smooth - Whether to use smooth scrolling
 */
async function navigateTo(navId, sectionId = null, pushHistory = true, smooth = true) {
  if (state.isNavigating) return;
  state.isNavigating = true;

  try {
    let targetNavId = navId;
    
    // If only sectionId provided, use current page
    if (!navId && sectionId && state.activeNavId) {
      targetNavId = state.activeNavId;
    }
    
    // Validate navigation item exists
    if (targetNavId) {
      const navItem = findNavItemById(targetNavId);
      if (!navItem) {
        console.warn(`Navigation item not found: ${targetNavId}`);
        state.isNavigating = false;
        return;
      }
    }
    
    // Update URL if requested
    if (pushHistory) {
      const newUrl = generateRoute(targetNavId, sectionId);
      if (newUrl !== window.location.hash) {
        history.pushState({ navId: targetNavId, sectionId }, '', newUrl || '#');
      }
    }
    
    // Load page if navigation changed
    if (targetNavId && targetNavId !== state.activeNavId) {
      const navItem = findNavItemById(targetNavId);
      if (navItem && navItem.page) {
        setActiveNav(targetNavId);
        const success = await loadPage(navItem.page);
        if (!success) {
          state.isNavigating = false;
          return;
        }
      }
    }
    
    // Scroll to section if provided
    if (sectionId) {
      // Wait a bit for content to render and scrollspy to initialize
      setTimeout(() => {
        const target = elContentBody.querySelector(`#${sectionId}`);
        if (target) {
          target.scrollIntoView({ 
            behavior: smooth ? 'smooth' : 'auto', 
            block: 'start' 
          });
          
          // Update right nav active state
          const rightNavLink = elRightNav.querySelector(`[data-target="${sectionId}"]`);
          if (rightNavLink) {
            elRightNav.querySelectorAll('.right-nav-link').forEach(a => {
              a.classList.remove('is-active');
            });
            rightNavLink.classList.add('is-active');
          }
        } else {
          console.warn(`Section not found: ${sectionId}`);
        }
      }, 150);
    }
    
    state.currentRoute = { navId: targetNavId, sectionId };
    
  } catch (error) {
    console.error('Navigation error:', error);
  } finally {
    state.isNavigating = false;
  }
}

/**
 * Handle browser back/forward buttons
 */
function handlePopState(event) {
  const route = parseRoute();
  navigateTo(route.navId, route.sectionId, false, false);
}

/**
 * Initialize routing on page load
 */
function initRouting() {
  // Handle popstate for browser navigation
  window.addEventListener('popstate', handlePopState);
  
  // Also handle hashchange as backup
  window.addEventListener('hashchange', (event) => {
    if (!state.isNavigating) {
      const route = parseRoute();
      navigateTo(route.navId, route.sectionId, false, false);
    }
  });
  
  // Parse initial route
  const route = parseRoute();
  if (route.navId || route.sectionId) {
    // Navigate to the route from URL
    navigateTo(route.navId, route.sectionId, false, false);
  } else {
    // Load default page and update URL
    const firstPage = findFirstPage(NAV_DATA);
    if (firstPage) {
      navigateTo(firstPage.id, null, true, false);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════════════════════════ */

function applyTheme(theme) {
  elHtml.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY_THEME, theme);
}

function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY_THEME);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

elThemeToggle.addEventListener('click', () => {
  const current = elHtml.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR WIDTH (CSS CUSTOM PROPERTIES)
   ═══════════════════════════════════════════════════════════════ */

function applySidebarWidths() {
  elLeftSidebar.style.width  = state.leftWidth  + 'px';
  elRightSidebar.style.width = state.rightWidth + 'px';
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR COLLAPSE / EXPAND
   ═══════════════════════════════════════════════════════════════ */

function collapseLeft() {
  state.leftCollapsed = true;
  elLeftSidebar.classList.add('is-collapsed');
  elResizeLeft.classList.add('is-hidden');
  elStripLeft.classList.add('is-visible');
  elStripLeft.setAttribute('aria-hidden', 'false');
  localStorage.setItem(STORAGE_KEY_LEFT_C, '1');
}

function expandLeft() {
  state.leftCollapsed = false;
  elLeftSidebar.classList.remove('is-collapsed');
  elResizeLeft.classList.remove('is-hidden');
  elStripLeft.classList.remove('is-visible');
  elStripLeft.setAttribute('aria-hidden', 'true');
  localStorage.removeItem(STORAGE_KEY_LEFT_C);
}

function collapseRight() {
  state.rightCollapsed = true;
  elRightSidebar.classList.add('is-collapsed');
  elResizeRight.classList.add('is-hidden');
  elStripRight.classList.add('is-visible');
  elStripRight.setAttribute('aria-hidden', 'false');
  localStorage.setItem(STORAGE_KEY_RIGHT_C, '1');
}

function expandRight() {
  state.rightCollapsed = false;
  elRightSidebar.classList.remove('is-collapsed');
  elResizeRight.classList.remove('is-hidden');
  elStripRight.classList.remove('is-visible');
  elStripRight.setAttribute('aria-hidden', 'true');
  localStorage.removeItem(STORAGE_KEY_RIGHT_C);
}

function initCollapseState() {
  if (localStorage.getItem(STORAGE_KEY_LEFT_C))  collapseLeft();
  if (localStorage.getItem(STORAGE_KEY_RIGHT_C)) collapseRight();
}

elCollapseLeft.addEventListener('click',  collapseLeft);
elCollapseRight.addEventListener('click', collapseRight);
elExpandLeft.addEventListener('click',    expandLeft);
elExpandRight.addEventListener('click',   expandRight);

/* ═══════════════════════════════════════════════════════════════
   RESIZE HANDLES
   ═══════════════════════════════════════════════════════════════ */

function initResize(handle, side) {
  let startX, startWidth;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startX     = e.clientX;
    startWidth = (side === 'left') ? state.leftWidth : state.rightWidth;

    handle.classList.add('is-dragging');
    document.body.classList.add('is-resizing');

    const onMove = (ev) => {
      const delta = ev.clientX - startX;
      let newWidth;

      if (side === 'left') {
        newWidth = Math.max(MIN_SIDEBAR_WIDTH, startWidth + delta);
        state.leftWidth = newWidth;
        elLeftSidebar.style.width = newWidth + 'px';
        localStorage.setItem(STORAGE_KEY_LEFT_W, newWidth);
      } else {
        newWidth = Math.max(MIN_SIDEBAR_WIDTH, startWidth - delta);
        state.rightWidth = newWidth;
        elRightSidebar.style.width = newWidth + 'px';
        localStorage.setItem(STORAGE_KEY_RIGHT_W, newWidth);
      }
    };

    const onUp = () => {
      handle.classList.remove('is-dragging');
      document.body.classList.remove('is-resizing');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });

  /* Keyboard resize: arrow keys on the handle */
  handle.addEventListener('keydown', (e) => {
    const STEP = 20;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const dir = e.key === 'ArrowLeft' ? -1 : 1;
      if (side === 'left') {
        state.leftWidth = Math.max(MIN_SIDEBAR_WIDTH, state.leftWidth + dir * STEP);
        elLeftSidebar.style.width = state.leftWidth + 'px';
        localStorage.setItem(STORAGE_KEY_LEFT_W, state.leftWidth);
      } else {
        state.rightWidth = Math.max(MIN_SIDEBAR_WIDTH, state.rightWidth - dir * STEP);
        elRightSidebar.style.width = state.rightWidth + 'px';
        localStorage.setItem(STORAGE_KEY_RIGHT_W, state.rightWidth);
      }
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   BUILD LEFT NAV TREE
   ═══════════════════════════════════════════════════════════════ */

function buildNavTree(items, depth = 0) {
  const ul = document.createElement('ul');

  items.forEach(item => {
    const li = document.createElement('li');
    li.className  = 'nav-item';
    li.dataset.id = item.id;

    const row = document.createElement('div');
    row.className = 'nav-row';
    row.style.setProperty('--nav-depth', depth);
    row.dataset.id = item.id;

    if (item.page)     row.dataset.page = item.page;
    if (!item.page && item.children) row.classList.add('is-group');

    /* Toggle arrow */
    if (item.children && item.children.length > 0) {
      const toggle = document.createElement('span');
      toggle.className = 'nav-toggle';
      toggle.setAttribute('aria-hidden', 'true');
      toggle.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14"><polyline points="9 18 15 12 9 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      row.appendChild(toggle);
    } else {
      const spacer = document.createElement('span');
      spacer.className = 'nav-toggle-spacer';
      row.appendChild(spacer);
    }

    const label = document.createElement('span');
    label.className   = 'nav-label';
    label.textContent = item.label;
    row.appendChild(label);

    li.appendChild(row);

    /* Recurse children */
    if (item.children && item.children.length > 0) {
      const children = document.createElement('div');
      children.className = 'nav-children';
      children.style.setProperty('--nav-depth', depth);
      children.appendChild(buildNavTree(item.children, depth + 1));
      li.appendChild(children);
    }

    ul.appendChild(li);
  });

  return ul;
}

/* Event delegation: single listener on the nav container */
elLeftNav.addEventListener('click', (e) => {
  const row = e.target.closest('.nav-row');
  if (!row) return;

  const navItem = row.closest('.nav-item');
  const navId = row.dataset.id;
  const page = row.dataset.page;

  /* Toggle expand/collapse if has children */
  if (navItem.querySelector('.nav-children')) {
    navItem.classList.toggle('is-open');
  }

  /* Navigate to page if has one */
  if (page && navId) {
    navigateTo(navId, null, true, true);
  }
});

function setActiveNav(id) {
  /* Remove all active states */
  elLeftNav.querySelectorAll('.nav-row.is-active').forEach(r => r.classList.remove('is-active'));

  /* Set new active */
  const target = elLeftNav.querySelector(`.nav-row[data-id="${id}"]`);
  if (target) {
    target.classList.add('is-active');

    /* Collapse all nav items first, then expand only the active path */
    collapseAllNavItems();

    /* Ensure all ancestor groups are open - this is critical for deep linking */
    let parent = target.closest('.nav-item')?.parentElement?.closest('.nav-item');
    while (parent) {
      parent.classList.add('is-open');
      parent = parent.parentElement?.closest('.nav-item');
    }

    /* Scroll the active nav item into view if it's outside the visible area */
    const sidebarRect = elLeftSidebar.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    
    if (targetRect.top < sidebarRect.top || targetRect.bottom > sidebarRect.bottom) {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
  state.activeNavId = id;
}

/* Collapse all navigation items on load - only active branch will be expanded */
function collapseAllNavItems() {
  elLeftNav.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('is-open');
  });
}

/* Expand only the navigation path to the active item */
function expandActiveNavPath(activeId) {
  if (!activeId) return;

  const activeRow = elLeftNav.querySelector(`.nav-row[data-id="${activeId}"]`);
  if (!activeRow) return;

  // First, collapse everything
  collapseAllNavItems();

  // Then expand only the parent chain for the active item
  let parent = activeRow.closest('.nav-item')?.parentElement?.closest('.nav-item');
  while (parent) {
    parent.classList.add('is-open');
    parent = parent.parentElement?.closest('.nav-item');
  }
}

/* ═══════════════════════════════════════════════════════════════
   PAGE LOADING (AJAX)
   ═══════════════════════════════════════════════════════════════ */

async function loadPage(url) {
  /* Show loading state */
  elContentBody.innerHTML = `
    <div class="content-loading" aria-live="polite">
      <div class="spinner" aria-hidden="true"></div>
      <span>Loading…</span>
    </div>`;

  /* Disconnect any previous scroll spy */
  if (state.scrollSpyObserver) {
    state.scrollSpyObserver.disconnect();
    state.scrollSpyObserver = null;
  }

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();

    /* Parse the HTML fragment */
    const parser  = new DOMParser();
    const doc     = parser.parseFromString(html, 'text/html');
    const fragment = doc.body;

    /* Strip scripts from fragment for safety */
    fragment.querySelectorAll('script').forEach(s => s.remove());

    /* Inject - move all body children (not the <body> element itself) */
    elContentBody.innerHTML = '';
    const transfer = document.createDocumentFragment();
    while (fragment.firstChild) {
      transfer.appendChild(fragment.firstChild);
    }
    elContentBody.appendChild(transfer);

    /* Scroll to top */
    elContentScroll.scrollTop = 0;

    /* Post-load setup */
    ensureHeadingIds();
    buildRightNav();
    setupScrollSpy();

    return true; // Success

  } catch (err) {
    elContentBody.innerHTML = `
      <div class="content-body">
        <div class="callout danger">
          <div class="callout-title">⚠ Error loading page</div>
          <p>Could not load <code>${url}</code>. ${err.message}</p>
          <p>Make sure you are serving this project through a local HTTP server (e.g., VS Code Live Server, or <code>python -m http.server</code>).</p>
        </div>
      </div>`;
    buildRightNav(); /* clear right nav */
    return false; // Failed
  }
}

/* ═══════════════════════════════════════════════════════════════
   ENSURE HEADING IDs
   ═══════════════════════════════════════════════════════════════ */

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function ensureHeadingIds() {
  const headings = elContentBody.querySelectorAll('h1, h2, h3, h4');
  const seen = {};
  headings.forEach(h => {
    if (!h.id) {
      let base = slugify(h.textContent);
      if (!base) base = 'section';
      let id = base;
      let n  = 1;
      while (seen[id]) { id = `${base}-${++n}`; }
      seen[id] = true;
      h.id = id;
    } else {
      seen[h.id] = true;
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   BUILD RIGHT NAV FROM HEADINGS
   ═══════════════════════════════════════════════════════════════ */

function buildRightNav() {
  const headings = [...elContentBody.querySelectorAll('h1, h2, h3, h4')];

  if (headings.length === 0) {
    elRightNav.innerHTML = '<p class="right-nav-empty">No sections on this page.</p>';
    return;
  }

  const list = document.createElement('ul');
  list.className = 'right-nav-list';

  headings.forEach(h => {
    const level = parseInt(h.tagName[1], 10); /* 1-4 */
    const li    = document.createElement('li');
    const a     = document.createElement('a');
    a.href             = '#' + h.id;
    a.className        = 'right-nav-link';
    a.dataset.level    = level;
    a.dataset.target   = h.id;
    a.textContent      = h.textContent;
    a.setAttribute('data-level', level);

    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(null, h.id, true, true);
    });

    li.appendChild(a);
    list.appendChild(li);
  });

  elRightNav.innerHTML = '';
  elRightNav.appendChild(list);
}

/* ═══════════════════════════════════════════════════════════════
   SCROLL SPY  -  IntersectionObserver with content container root
   ═══════════════════════════════════════════════════════════════ */

function setupScrollSpy() {
  const headings = [...elContentBody.querySelectorAll('h1, h2, h3, h4')];
  if (headings.length === 0) return;

  /* Track which heading is currently "in view" at the top */
  const activateHeading = (id) => {
    elRightNav.querySelectorAll('.right-nav-link').forEach(a => {
      const isMatch = a.dataset.target === id;
      a.classList.toggle('is-active', isMatch);
    });

    // Update URL to reflect current section (without pushing to history)
    // Only update if we're not in the middle of a navigation operation
    if (!state.isNavigating && state.activeNavId && id) {
      const newUrl = generateRoute(state.activeNavId, id);
      const currentHash = window.location.hash;
      
      // Only update if the URL actually changed to avoid unnecessary history entries
      if (newUrl && newUrl !== currentHash) {
        history.replaceState({ navId: state.activeNavId, sectionId: id }, '', newUrl);
        state.currentRoute = { navId: state.activeNavId, sectionId: id };
      }
    }
  };

  /* Use IntersectionObserver rooted to the scroll container */
  const observer = new IntersectionObserver((entries) => {
    /* Find the first heading that is intersecting (topmost visible) */
    const intersecting = entries.filter(e => e.isIntersecting);
    if (intersecting.length === 0) return;

    /* Pick the one closest to the top of the viewport */
    intersecting.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    activateHeading(intersecting[0].target.id);
  }, {
    root:       elContentScroll,
    rootMargin: '0px 0px -70% 0px',  /* trigger when heading enters top 30% of scroll area */
    threshold:  0
  });

  headings.forEach(h => observer.observe(h));
  state.scrollSpyObserver = observer;

  /* Activate first heading immediately */
  if (headings[0]) activateHeading(headings[0].id);
}

/* ═══════════════════════════════════════════════════════════════
   RESPONSIVE AUTO-COLLAPSE
   ═══════════════════════════════════════════════════════════════ */

function checkResponsiveCollapse() {
  const vw = window.innerWidth;

  /* Below 1200px — collapse right sidebar if user hasn't explicitly set it */
  if (vw < 1200 && !state.rightCollapsed) {
    collapseRight();
  }

  /* Below 800px — also collapse left sidebar */
  if (vw < 800 && !state.leftCollapsed) {
    collapseLeft();
  }
}

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */

function init() {
  /* Theme */
  initTheme();

  /* Sidebar widths from storage */
  applySidebarWidths();

  /* Build left nav */
  elLeftNav.appendChild(buildNavTree(NAV_DATA));
  collapseAllNavItems();

  /* Restore collapse state from localStorage */
  initCollapseState();

  /* Wire resize handles */
  initResize(elResizeLeft,  'left');
  initResize(elResizeRight, 'right');

  /* Responsive collapse check on load + resize */
  checkResponsiveCollapse();
  window.addEventListener('resize', debounce(checkResponsiveCollapse, 250));

  /* Initialize routing system */
  initRouting();
}

/* Find the first nav item with a page */
function findFirstPage(items) {
  for (const item of items) {
    if (item.page) return item;
    if (item.children) {
      const found = findFirstPage(item.children);
      if (found) return found;
    }
  }
  return null;
}

/* Debounce utility */
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ─── Run ─── */
document.addEventListener('DOMContentLoaded', init);
