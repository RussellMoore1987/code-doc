/**
 * app.js  -  Documentation App
 * Vanilla JS: navigation tree, Ajax content loading,
 * right-nav generation, scroll spy, sidebar resize & collapse,
 * light/dark theme toggle, copy-to-clipboard for code blocks.
 */

/* ═══════════════════════════════════════════════════════════════
   NAVIGATION DATA  -  4 levels deep
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
            label: 'Step 1 - Configure',
            children: [
              {
                id: 'step1-env',
                label: 'Environment Setup',
                page: 'pages/environment-setup.html'
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
            label: 'Step 2 - Build & Run',
            page: 'pages/step2-build-run.html'
          }
        ]
      }
    ]
  },
  {
    id: 'advanced',
    label: 'Advanced Topics',
    children: [
      { id: 'config',   label: 'Configuration', page: 'pages/configuration.html' },
      { id: 'plugins',  label: 'Plugins',        page: 'pages/plugins.html'      },
      { id: 'perf',     label: 'Performance',    page: 'pages/performance.html' }
    ]
  },
  {
    id: 'reference',
    label: 'Reference',
    children: [
      { id: 'api-ref',  label: 'API Reference',  page: 'pages/api-reference.html' },
      { id: 'cli-ref',  label: 'CLI Reference',  page: 'pages/cli-reference.html' },
      { id: 'faq',      label: 'FAQ',            page: 'pages/faq.html'      }
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
  isNavigating:    false, // Prevent recursion during navigation
  abortController: null   // For cleanup of event listeners
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

// Search DOM References
const elSearchContainer = document.getElementById('search-container');
const elSearchToggle = document.getElementById('search-toggle');
const elSearchInputWrapper = document.getElementById('search-input-wrapper');
const elSearchInput = document.getElementById('search-input');
const elSearchClose = document.getElementById('search-close');
const elSearchResults = document.getElementById('search-results');
const elSearchErrorMessage = document.getElementById('search-error-message');
const elSearchNavControls = document.getElementById('search-nav-controls');
const elSearchMatchInfo = document.getElementById('search-match-info');
const elSearchPrevBtn = document.getElementById('search-prev-btn');
const elSearchNextBtn = document.getElementById('search-next-btn');
const elSearchClearBtn = document.getElementById('search-clear-btn');

/* ═══════════════════════════════════════════════════════════════
   SEARCH FUNCTIONALITY
   ═══════════════════════════════════════════════════════════════ */

const searchState = {
  isOpen: false,
  index: [],
  currentQuery: '',
  selectedResult: -1,
  results: [],
  hasValidationError: false,
  // Page highlighting state
  currentHighlights: [],
  currentMatchIndex: -1
};

/**
 * Build search index by loading and parsing all pages
 */
async function buildSearchIndex() {
  searchState.index = [];
  
  try {
    // Get all unique pages from NAV_DATA
    const pages = new Set();
    function extractPages(items) {
      for (const item of items) {
        if (item.page) {
          pages.add(item.page);
        }
        if (item.children) {
          extractPages(item.children);
        }
      }
    }
    extractPages(NAV_DATA);
    
    if (pages.size === 0) {
      console.warn('No pages found in NAV_DATA for indexing');
      return;
    }
    
    // Load and index each page
    const promises = Array.from(pages).map(async (pageUrl) => {
      try {
        const response = await fetch(pageUrl);
        if (!response.ok) {
          console.warn(`Failed to fetch ${pageUrl}: ${response.status} ${response.statusText}`);
          return null;
        }
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Extract title (first h1)
        const titleEl = doc.querySelector('h1');
        const title = titleEl ? titleEl.textContent.trim() : 'Untitled';
        
        // Extract all headings and sections for indexing
        const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const sections = [];
        
        headings.forEach((heading, index) => {
          const id = heading.id || `section-${index}`;
          const level = parseInt(heading.tagName.charAt(1));
          const text = heading.textContent.trim();
          
          if (!text) return; // Skip empty headings
          
          // Get text content of section (until next heading of same or higher level)
          let content = '';
          let nextEl = heading.nextElementSibling;
          while (nextEl && content.length < 500) {
            const tagName = nextEl.tagName.toLowerCase();
            if (tagName.match(/^h[1-6]$/)) {
              const nextLevel = parseInt(tagName.charAt(1));
              if (nextLevel <= level) break;
            }
            if (nextEl.innerHTML && nextEl.innerHTML.trim()) {
              // Use innerHTML to capture all content, then strip HTML properly later
              content += nextEl.innerHTML.trim() + ' ';
            }
            nextEl = nextEl.nextElementSibling;
          }
          
          sections.push({
            id,
            title: text,
            content: content.trim().substring(0, 500), // Limit content length
            level
          });
        });
        
        // Return page data for index
        return {
          url: pageUrl,
          title,
          sections,
          // Get nav item info for this page
          navInfo: findNavItemByPage(pageUrl)
        };
        
      } catch (error) {
        console.warn(`Failed to index page ${pageUrl}:`, error);
        return null;
      }
    });
    
    // Wait for all pages to be processed
    const results = await Promise.all(promises);
    
    // Filter out failed pages and add to index
    searchState.index = results.filter(page => page !== null);
  } catch (error) {
    console.error('Failed to build search index:', error);
  }
}

/**
 * Find navigation item by page URL
 */
function findNavItemByPage(pageUrl, items = NAV_DATA) {
  for (const item of items) {
    if (item.page === pageUrl) {
      return item;
    }
    if (item.children) {
      const found = findNavItemByPage(pageUrl, item.children);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Perform search query with validation
 */
function performSearch(query) {
  // Hide any existing error messages
  if (elSearchErrorMessage) {
    elSearchErrorMessage.classList.remove('visible');
  }
  
  if (!query.trim()) {
    searchState.results = [];
    searchState.hasValidationError = false;
    return;
  }
  
  // Validate search length
  if (query.length > 25) {
    searchState.results = [];
    searchState.hasValidationError = true;
    showSearchError('Search text is too long. Please reduce to 25 characters or fewer.');
    return;
  }
  
  // Clear validation error flag if we get here
  searchState.hasValidationError = false;
  
  query = query.toLowerCase().trim();
  searchState.currentQuery = query;
  searchState.results = [];
  
  const pageQueryIndex = {};
  // Search through index
  for (const page of searchState.index) {
    pageQueryIndex[page.url] = -1;

    // Search in page title
    if (page.title.toLowerCase().includes(query)) {
      searchState.results.push({
        type: 'page',
        page: page,
        section: null,
        title: page.title,
        snippet: getSnippet(page.title, query),
        navId: page.navInfo ? page.navInfo.id : null,
        instanceIndex: pageQueryIndex[page.url]++
      });
    }
    
    // Search in sections
    for (const section of page.sections) {
      const titleMatch = section.title.toLowerCase().includes(query);
      const contentMatch = section.content.toLowerCase().includes(query);
      
      if (titleMatch || contentMatch) {
        const matchText = titleMatch ? section.title : section.content;
        searchState.results.push({
          type: 'section',
          page: page,
          section: section,
          title: section.title,
          snippet: getSnippet(matchText, query),
          navId: page.navInfo ? page.navInfo.id : null,
          sectionId: section.id,
          instanceIndex: pageQueryIndex[page.url]++
        });
      }
    }
  }
  
  // Sort results by relevance (title matches first, then content matches)
  searchState.results.sort((a, b) => {
    const aIsTitle = a.type === 'page' || a.title.toLowerCase().includes(query);
    const bIsTitle = b.type === 'page' || b.title.toLowerCase().includes(query);
    
    if (aIsTitle && !bIsTitle) return -1;
    if (!aIsTitle && bIsTitle) return 1;
    return 0;
  });
  
  // Limit results
  searchState.results = searchState.results.slice(0, 10);
}

/**
 * Strip HTML tags and preserve readable spacing
 */
function stripHtml(text) {
  if (!text) return '';
  
  // Create a temporary element to use browser's HTML parsing
  const temp = document.createElement('div');
  temp.innerHTML = text;
  
  // Get text content and normalize whitespace
  let cleanText = temp.textContent || temp.innerText || '';
  
  // Replace multiple whitespace with single space and trim
  cleanText = cleanText.replace(/\s+/g, ' ').trim();
  
  return cleanText;
}

/**
 * Generate snippet with highlighted query terms
 */
function getSnippet(text, query, maxLength = 150) {
  // Strip HTML first to get clean text
  const cleanText = stripHtml(text);
  
  const queryIndex = cleanText.toLowerCase().indexOf(query.toLowerCase());
  if (queryIndex === -1) {
    return cleanText.length > maxLength ? cleanText.substring(0, maxLength) + '...' : cleanText;
  }
  
  // Try to center the query in the snippet
  const start = Math.max(0, queryIndex - Math.floor((maxLength - query.length) / 2));
  const end = Math.min(cleanText.length, start + maxLength);
  
  let snippet = cleanText.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < cleanText.length) snippet = snippet + '...';
  
  // Highlight query terms (case insensitive)
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return snippet.replace(regex, '<mark>$1</mark>');
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Show search error message
 */
function showSearchError(message) {
  if (!elSearchErrorMessage) return;
  
  elSearchErrorMessage.textContent = message;
  elSearchErrorMessage.classList.add('visible');
  elSearchResults.classList.remove('visible');
}

/**
 * Hide search error message
 */
function hideSearchError() {
  if (!elSearchErrorMessage) return;
  
  elSearchErrorMessage.classList.remove('visible');
}

/**
 * Render search results
 */
function renderSearchResults() {
  // Only hide error messages if there's no validation error
  if (!searchState.hasValidationError) {
    hideSearchError(); // Clear any error messages
  }
  
  if (!searchState.currentQuery.trim()) {
    elSearchResults.classList.remove('visible');
    return;
  }
  
  // If there's a validation error, don't show results
  if (searchState.hasValidationError) {
    elSearchResults.classList.remove('visible');
    return;
  }
  
  if (searchState.results.length === 0) {
    elSearchResults.innerHTML = `
      <div class="search-no-results">
        No results found for "${escapeHtml(searchState.currentQuery)}"
      </div>
    `;
    elSearchResults.classList.add('visible');
    return;
  }

  const resultsHTML = searchState.results.map((result, index) => {
    const pageName = result.page.navInfo ? result.page.navInfo.label : result.page.title;
    const isHighlighted = index === searchState.selectedResult ? ' highlighted' : '';
    const textOnly = stripHtmlExceptMark(result.snippet);
    
    return `
      <div class="search-result-item${isHighlighted}" data-index="${index}" data-instance-index="${result.instanceIndex}" role="option">
        <div class="search-result-title">${escapeHtml(result.title)}</div>
        <div class="search-result-page">${escapeHtml(pageName)}</div>
        <div class="search-result-snippet">${textOnly}</div>
      </div>
    `;
  }).join('');
  
  elSearchResults.innerHTML = resultsHTML;
  elSearchResults.classList.add('visible');
}

function stripHtmlExceptMark(html) {
  const div = document.createElement('div');
  div.innerHTML = html;

  function clean(node) {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.tagName !== 'MARK') {
          // Replace the element with its children (unwrap it)
          child.replaceWith(...child.childNodes);
        } else {
          // Keep <mark>, but clean inside it too
          clean(child);
        }
      }
    });
  }

  clean(div);
  return div.innerHTML;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* ═══════════════════════════════════════════════════════════════
   PAGE HIGHLIGHTING & NAVIGATION
   ═══════════════════════════════════════════════════════════════ */

/**
 * Clear all existing highlights on the page
 */
function clearPageHighlights() {
  const highlights = document.querySelectorAll('.search-highlight');
  highlights.forEach(highlight => {
    const parent = highlight.parentNode;
    parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
    parent.normalize(); // Merge adjacent text nodes
  });
  
  searchState.currentHighlights = [];
  searchState.currentMatchIndex = -1;
  
  // Hide navigation controls
  if (elSearchNavControls) {
    elSearchNavControls.classList.remove('visible');
  }
}

/**
 * Highlight search terms on the current page
 */
function highlightSearchTermsOnPage(query, instanceIndex) {
  if (!query || !query.trim()) return;
  
  // Clear existing highlights first
  clearPageHighlights();
  
  const searchTerms = query.toLowerCase().trim();
  const walker = document.createTreeWalker(
    elContentBody,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip if parent is already a highlight or is a script tag
        if (node.parentNode.classList && node.parentNode.classList.contains('search-highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        if (node.parentNode.tagName === 'SCRIPT' || node.parentNode.tagName === 'STYLE') {
          return NodeFilter.FILTER_REJECT;
        }
        // Only accept nodes that contain the search term
        return node.textContent.toLowerCase().includes(searchTerms) 
          ? NodeFilter.FILTER_ACCEPT 
          : NodeFilter.FILTER_REJECT;
      }
    }
  );
  
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  
  // Process text nodes to add highlights
  textNodes.forEach(textNode => {
    const text = textNode.textContent;
    const regex = new RegExp(`(${escapeRegex(searchTerms)})`, 'gi');
    
    if (regex.test(text)) {
      const highlightedHtml = text.replace(regex, '<span class="search-highlight">$1</span>');
      
      // Create a temporary container to parse the HTML
      const temp = document.createElement('div');
      temp.innerHTML = highlightedHtml;
      
      // Replace the text node with the highlighted content
      const fragment = document.createDocumentFragment();
      while (temp.firstChild) {
        if (temp.firstChild.classList && temp.firstChild.classList.contains('search-highlight')) {
          searchState.currentHighlights.push(temp.firstChild);
        }
        fragment.appendChild(temp.firstChild);
      }
      
      textNode.parentNode.replaceChild(fragment, textNode);
    }
  });
  
  // Update highlights array with the actual DOM elements
  searchState.currentHighlights = Array.from(document.querySelectorAll('.search-highlight'));
  
  if (searchState.currentHighlights.length > 0) {
    searchState.currentMatchIndex = instanceIndex;
    showSearchNavigation();
    scrollToHighlight(instanceIndex);
  }
}

/**
 * Update search navigation positioning based on sidebar state
 */
function updateSearchNavPosition() {
  if (!elSearchNavControls) return;
  
  // The positioning is now handled via CSS classes based on sidebar state
  // This function ensures the controls remain visible and properly positioned
  
  const rightSidebarCollapsed = state.rightCollapsed || elRightSidebar.classList.contains('collapsed');
  
  if (rightSidebarCollapsed) {
    elSearchNavControls.classList.add('sidebar-collapsed');
  } else {
    elSearchNavControls.classList.remove('sidebar-collapsed');
  }
}

/**
 * Show search navigation controls
 */
function showSearchNavigation() {
  if (!elSearchNavControls || searchState.currentHighlights.length === 0) return;
  
  updateSearchMatchInfo();
  updateSearchNavPosition(); // Ensure proper positioning
  elSearchNavControls.classList.add('visible');
}

/**
 * Update the match info and button states
 */
function updateSearchMatchInfo() {
  if (!elSearchMatchInfo) return;
  
  const total = searchState.currentHighlights.length;
  const current = searchState.currentMatchIndex + 1;
  
  elSearchMatchInfo.textContent = total > 0 ? `${current} of ${total} matches` : 'No matches';
  
  // Update button states
  if (elSearchPrevBtn) {
    elSearchPrevBtn.disabled = total === 0 || searchState.currentMatchIndex === 0;
  }
  if (elSearchNextBtn) {
    elSearchNextBtn.disabled = total === 0 || searchState.currentMatchIndex >= total - 1;
  }
}

/**
 * Navigate to the next highlight
 */
function navigateToNextHighlight() {
  if (searchState.currentHighlights.length === 0) return;
  
  searchState.currentMatchIndex = Math.min(
    searchState.currentMatchIndex + 1,
    searchState.currentHighlights.length - 1
  );
  
  scrollToHighlight(searchState.currentMatchIndex);
  updateSearchMatchInfo();
}

/**
 * Navigate to the previous highlight
 */
function navigateToPreviousHighlight() {
  if (searchState.currentHighlights.length === 0) return;
  
  searchState.currentMatchIndex = Math.max(searchState.currentMatchIndex - 1, 0);
  
  scrollToHighlight(searchState.currentMatchIndex);
  updateSearchMatchInfo();
}

/**
 * Scroll to a specific highlight
 */
function scrollToHighlight(index) {
  if (!searchState.currentHighlights[index]) return;
  
  // Remove active class from all highlights
  searchState.currentHighlights.forEach(highlight => {
    highlight.classList.remove('active');
  });
  
  // Add active class to current highlight
  const activeHighlight = searchState.currentHighlights[index];
  activeHighlight.classList.add('active');
  
  // Scroll to the highlight
  activeHighlight.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'nearest'
  });
}

/**
 * Handle search result selection
 */
function selectSearchResult(index) {
  const result = searchState.results[index];
  if (!result) return;
  
  // Store the search query for highlighting on the page
  const query = searchState.currentQuery;
  
  // Close search
  closeSearch();
  
  // Navigate using the existing navigation system
  if (result.navId) {
    navigateTo(result.navId, result.sectionId).then(() => {
      // Small delay to ensure page is loaded before highlighting
      setTimeout(() => highlightSearchTermsOnPage(query, result.instanceIndex), 200);
    });
  } else {
    console.warn('Could not navigate to result - no nav ID found');
  }
}

/**
 * Open search interface
 */
function openSearch() {
  if (searchState.isOpen) return;
  
  searchState.isOpen = true;
  searchState.selectedResult = -1;
  
  elSearchInputWrapper.classList.add('expanded');
  elSearchResults.classList.remove('visible');
  
  // Focus input after animation
  setTimeout(() => {
    elSearchInput.focus();
  }, 100);
}

/**
 * Close search interface
 */
function closeSearch() {
  if (!searchState.isOpen) return;
  
  searchState.isOpen = false;
  searchState.selectedResult = -1;
  searchState.currentQuery = '';
  searchState.hasValidationError = false;
  
  elSearchInputWrapper.classList.remove('expanded', 'focused');
  elSearchResults.classList.remove('visible');
  hideSearchError(); // Clear any error messages
  elSearchInput.value = '';
  
  // Return focus to search button
  elSearchToggle.focus();
}

/**
 * Initialize search functionality
 */
function initSearch() {
  // Verify all search elements exist
  if (!elSearchToggle || !elSearchInputWrapper || !elSearchInput || 
      !elSearchClose || !elSearchResults || !elSearchContainer) {
    console.warn('Search elements not found - search functionality disabled');
    return;
  }
  
  // Build search index on load (asynchronously to not block page loading)
  setTimeout(() => buildSearchIndex(), 100);
  
  // Search toggle button
  elSearchToggle.addEventListener('click', (e) => {
    e.preventDefault();
    openSearch();
  });
  
  // Close button
  elSearchClose.addEventListener('click', (e) => {
    e.preventDefault();
    closeSearch();
  });
  
  // Input events with validation
  elSearchInput.addEventListener('input', debounce((e) => {
    const query = e.target.value;
    performSearch(query);
    renderSearchResults();
    searchState.selectedResult = -1;
  }, 300)); // Debounce search for better performance
  
  // Input focus/blur
  elSearchInput.addEventListener('focus', () => {
    elSearchInputWrapper.classList.add('focused');
  });
  
  elSearchInput.addEventListener('blur', () => {
    elSearchInputWrapper.classList.remove('focused');
  });
  
  // Keyboard navigation
  elSearchInput.addEventListener('keydown', (e) => {
    const { key } = e;
    const resultsCount = searchState.results.length;
    
    if (key === 'Escape') {
      e.preventDefault();
      closeSearch();
    } else if (key === 'ArrowDown') {
      e.preventDefault();
      searchState.selectedResult = Math.min(searchState.selectedResult + 1, resultsCount - 1);
      renderSearchResults();
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      searchState.selectedResult = Math.max(searchState.selectedResult - 1, -1);
      renderSearchResults();
    } else if (key === 'Enter') {
      e.preventDefault();
      if (searchState.selectedResult >= 0) {
        selectSearchResult(searchState.selectedResult);
      } else if (searchState.results.length > 0) {
        selectSearchResult(0);
      }
    }
  });
  
  // Click on results
  elSearchResults.addEventListener('click', (e) => {
    const resultItem = e.target.closest('.search-result-item');
    if (resultItem) {
      console.log(resultItem);
      
      const index = parseInt(resultItem.dataset.index);
      selectSearchResult(index); // starts here
    }
  });
  
  // Click outside to close
  document.addEventListener('click', (e) => {
    if (searchState.isOpen && !elSearchContainer.contains(e.target)) {
      closeSearch();
    }
  }, {
    signal: state.abortController.signal
  });
  
  // Global keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K to open search
    if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!searchState.isOpen) {
        openSearch();
      }
    }
    
    // Escape key to close search globally
    if (e.key === 'Escape' && searchState.isOpen) {
      closeSearch();
    }
    
    // Additional keyboard shortcuts for page navigation
    if (searchState.currentHighlights.length > 0 && !searchState.isOpen) {
      if (e.key === 'F3' || (e.key === 'g' && e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          navigateToPreviousHighlight();
        } else {
          navigateToNextHighlight();
        }
      }
    }
  }, {
    signal: state.abortController.signal
  });
  
  // Search navigation controls
  if (elSearchPrevBtn) {
    elSearchPrevBtn.addEventListener('click', () => {
      navigateToPreviousHighlight();
    });
  }
  
  if (elSearchNextBtn) {
    elSearchNextBtn.addEventListener('click', () => {
      navigateToNextHighlight();
    });
  }
  
  if (elSearchClearBtn) {
    elSearchClearBtn.addEventListener('click', () => {
      clearPageHighlights();
    });
  }
}

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
  window.addEventListener('popstate', handlePopState, {
    signal: state.abortController.signal
  });
  
  // Also handle hashchange as backup
  window.addEventListener('hashchange', (event) => {
    if (!state.isNavigating) {
      const route = parseRoute();
      navigateTo(route.navId, route.sectionId, false, false);
    }
  }, {
    signal: state.abortController.signal
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
  updateSearchNavPosition(); // Update search nav positioning
}

function expandLeft() {
  state.leftCollapsed = false;
  elLeftSidebar.classList.remove('is-collapsed');
  elResizeLeft.classList.remove('is-hidden');
  elStripLeft.classList.remove('is-visible');
  elStripLeft.setAttribute('aria-hidden', 'true');
  localStorage.removeItem(STORAGE_KEY_LEFT_C);
  updateSearchNavPosition(); // Update search nav positioning
}

function collapseRight() {
  state.rightCollapsed = true;
  elRightSidebar.classList.add('is-collapsed');
  elResizeRight.classList.add('is-hidden');
  elStripRight.classList.add('is-visible');
  elStripRight.setAttribute('aria-hidden', 'false');
  localStorage.setItem(STORAGE_KEY_RIGHT_C, '1');
  updateSearchNavPosition(); // Update search nav positioning
}

function expandRight() {
  state.rightCollapsed = false;
  elRightSidebar.classList.remove('is-collapsed');
  elResizeRight.classList.remove('is-hidden');
  elStripRight.classList.remove('is-visible');
  elStripRight.setAttribute('aria-hidden', 'true');
  localStorage.removeItem(STORAGE_KEY_RIGHT_C);
  updateSearchNavPosition(); // Update search nav positioning
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
      updateSearchNavPosition(); // Update search nav positioning after resize
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
      updateSearchNavPosition(); // Update search nav positioning after keyboard resize
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
    setupCopyButtons();
    clearPageHighlights(); // Clear any previous search highlights

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

  /* Below 1200px - collapse right sidebar if user hasn't explicitly set it */
  if (vw < 1200 && !state.rightCollapsed) {
    collapseRight();
  }

  /* Below 800px - also collapse left sidebar */
  if (vw < 800 && !state.leftCollapsed) {
    collapseLeft();
  }
  
  // Update search navigation position on resize
  updateSearchNavPosition();
}

/* ═══════════════════════════════════════════════════════════════
   COPY TO CLIPBOARD FUNCTIONALITY
   ═══════════════════════════════════════════════════════════════ */

function setupCopyButtons() {
  /* Find all pre > code blocks and add copy buttons */
  const codeBlocks = document.querySelectorAll('.content-body pre code');
  
  codeBlocks.forEach(codeElement => {
    const preElement = codeElement.parentElement;
    
    /* Skip if button already exists */
    if (preElement.querySelector('.copy-btn')) {
      return;
    }
    
    /* Create copy button */
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.setAttribute('aria-label', 'Copy code to clipboard');
    copyBtn.setAttribute('title', 'Copy code to clipboard');
    
    /* Add click handler */
    copyBtn.addEventListener('click', () => copyCodeToClipboard(codeElement, copyBtn));
    
    /* Insert button into pre element */
    preElement.appendChild(copyBtn);
  });
}

async function copyCodeToClipboard(codeElement, buttonElement) {
  const codeText = codeElement.textContent;
  
  try {
    /* Try modern Clipboard API first */
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(codeText);
    } else {
      /* Fallback for older browsers or non-secure contexts */
      copyTextFallback(codeText);
    }
    
    /* Show success feedback */
    showCopyFeedback(buttonElement, true);
    
  } catch (err) {
    console.warn('Copy to clipboard failed:', err);
    /* Try fallback method */
    try {
      copyTextFallback(codeText);
      showCopyFeedback(buttonElement, true);
    } catch (fallbackErr) {
      console.error('All copy methods failed:', fallbackErr);
      showCopyFeedback(buttonElement, false);
    }
  }
}

function copyTextFallback(text) {
  /* Create temporary textarea for fallback copy */
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  
  /* Select and copy */
  textarea.select();
  textarea.setSelectionRange(0, 99999); /* For mobile devices */
  
  const successful = document.execCommand('copy');
  document.body.removeChild(textarea);
  
  if (!successful) {
    throw new Error('document.execCommand copy failed');
  }
}

function showCopyFeedback(buttonElement, success) {
  const originalText = buttonElement.textContent;
  
  if (success) {
    buttonElement.textContent = 'Copied!';
    buttonElement.classList.add('copied');
    
    /* Reset after 2 seconds */
    setTimeout(() => {
      buttonElement.textContent = originalText;
      buttonElement.classList.remove('copied');
    }, 2000);
  } else {
    buttonElement.textContent = 'Failed';
    
    /* Reset after 2 seconds */
    setTimeout(() => {
      buttonElement.textContent = originalText;
    }, 2000);
  }
}

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */

function init() {
  /* Initialize AbortController for managed event listeners */
  state.abortController = new AbortController();
  
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
  window.debouncedResize = debounce(checkResponsiveCollapse, 250);
  window.addEventListener('resize', window.debouncedResize, {
    signal: state.abortController.signal
  });

  /* Initialize routing system */
  initRouting();
  
  /* Initialize search functionality */
  initSearch();
  
  /* Setup copy buttons for any pre-existing code blocks */
  setupCopyButtons();
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

/* Debounce utility with cleanup support */
function debounce(fn, delay) {
  let timer;
  const debouncedFn = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  
  // Add cleanup method
  debouncedFn.cancel = () => {
    clearTimeout(timer);
    timer = null;
  };
  
  return debouncedFn;
}

/* ═══════════════════════════════════════════════════════════════
   MEMORY MANAGEMENT & CLEANUP
   ═══════════════════════════════════════════════════════════════ */

/**
 * Clean up all observers, timers, and state to prevent memory leaks
 */
function cleanup() {
  try {
    // Disconnect IntersectionObserver
    if (state.scrollSpyObserver) {
      state.scrollSpyObserver.disconnect();
      state.scrollSpyObserver = null;
    }
    
    // Abort all managed event listeners
    if (state.abortController) {
      state.abortController.abort();
      state.abortController = null;
    }
    
    // Clear search state and cache
    searchState.index = [];
    searchState.currentHighlights = [];
    searchState.results = [];
    searchState.currentQuery = '';
    
    // Clear any pending highlights
    clearPageHighlights();
    
    // Cancel any pending debounced functions
    if (window.debouncedResize && window.debouncedResize.cancel) {
      window.debouncedResize.cancel();
    }
    
    console.log('App cleanup completed');
    
  } catch (error) {
    console.warn('Error during cleanup:', error);
  }
}

/* ─── Run ─── */
document.addEventListener('DOMContentLoaded', init);

// Cleanup on page unload to prevent memory leaks
window.addEventListener('beforeunload', cleanup);

// Also cleanup on page hide (for back/forward cache)
window.addEventListener('pagehide', cleanup);
