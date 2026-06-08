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
    id: 'frontend-development',
    label: 'Frontend Development',
    children: [
      { id: 'custom-themes',    label: 'Custom Themes',        page: 'pages/custom-themes.html'    },
      { id: 'widget-system',    label: 'Widget System',        page: 'pages/widget-system.html'    },
      { id: 'template-engine',  label: 'Template Engine',      page: 'pages/template-engine.html'  },
      { id: 'internationalization', label: 'Internationalization', page: 'pages/internationalization.html' }
    ]
  },
  {
    id: 'backend-development',
    label: 'Backend Development',
    children: [
      { id: 'request-validation',  label: 'Request Validation',   page: 'pages/request-validation.html'  },
      { id: 'response-formatting', label: 'Response Formatting',  page: 'pages/response-formatting.html' },
      { id: 'session-management',  label: 'Session Management',   page: 'pages/session-management.html'  },
      { id: 'file-upload-handling', label: 'File Upload Handling', page: 'pages/file-upload-handling.html' },
      { id: 'background-jobs',     label: 'Background Jobs',      page: 'pages/background-jobs.html'     }
    ]
  },
  {
    id: 'performance',
    label: 'Performance & Optimization',
    children: [
      { id: 'perf',               label: 'Performance Basics',    page: 'pages/performance.html'        },
      { id: 'caching-strategies', label: 'Caching Strategies',    page: 'pages/caching-strategies.html' },
      { id: 'rate-limiting',      label: 'Rate Limiting',         page: 'pages/rate-limiting.html'      }
    ]
  },
  {
    id: 'advanced',
    label: 'Advanced Topics',
    children: [
      { id: 'config',   label: 'Configuration',   page: 'pages/configuration.html' },
      { id: 'plugins',  label: 'Plugins',         page: 'pages/plugins.html'      },
      { id: 'microservices-architecture', label: 'Microservices Architecture', page: 'pages/microservices-architecture.html' },
      { id: 'api-versioning',     label: 'API Versioning',       page: 'pages/api-versioning.html'     }
    ]
  },
  {
    id: 'real-time',
    label: 'Real-Time Features',
    children: [
      { id: 'websocket-communication', label: 'WebSocket Communication', page: 'pages/websocket-communication.html' },
      { id: 'real-time-analytics',     label: 'Real-Time Analytics',     page: 'pages/real-time-analytics.html'     }
    ]
  },
  {
    id: 'media-processing',
    label: 'Media & Document Processing',
    children: [
      { id: 'image-processing',   label: 'Image Processing',     page: 'pages/image-processing.html'   },
      { id: 'pdf-generation',     label: 'PDF Generation',       page: 'pages/pdf-generation.html'     },
      { id: 'email-notifications', label: 'Email Notifications', page: 'pages/email-notifications.html' }
    ]
  },
  {
    id: 'reference',
    label: 'Reference',
    children: [
      { id: 'image-galleries', label: 'Image Galleries', page: 'pages/image-galleries.html' },
      { id: 'api-ref',  label: 'API Reference',  page: 'pages/api-reference.html' },
      { id: 'cli-ref',  label: 'CLI Reference',  page: 'pages/cli-reference.html' },
      { id: 'faq',      label: 'FAQ',            page: 'pages/faq.html'      }
    ]
  },
  {
    id: 'core-concepts',
    label: 'Core Concepts',
    children: [
      { id: 'data-models',      label: 'Data Models & Schema',  page: 'pages/data-models.html'      },
      { id: 'event-system',     label: 'Event System',          page: 'pages/event-system.html'     },
      { id: 'middleware',       label: 'Middleware Pipeline',   page: 'pages/middleware.html'       },
      { id: 'state-management', label: 'State Management',      page: 'pages/state-management.html' },
      { id: 'lifecycle-hooks',  label: 'Lifecycle Hooks',       page: 'pages/lifecycle-hooks.html'  }
    ]
  },
  {
    id: 'security',
    label: 'Security',
    children: [
      { id: 'authentication',          label: 'Authentication',          page: 'pages/authentication.html'          },
      { id: 'authorization',           label: 'Authorization',           page: 'pages/authorization.html'           },
      { id: 'api-security',            label: 'API Security',            page: 'pages/api-security.html'            },
      { id: 'content-security-policy', label: 'Content Security Policy', page: 'pages/content-security-policy.html' },
      { id: 'secrets-management',      label: 'Secrets Management',      page: 'pages/secrets-management.html'      },
      { id: 'data-encryption',         label: 'Data Encryption',         page: 'pages/data-encryption.html'         }
    ]
  },
  {
    id: 'testing-monitoring',
    label: 'Testing & Monitoring',
    children: [
      { id: 'testing-strategies',  label: 'Testing Strategies',   page: 'pages/testing-strategies.html'  },
      { id: 'monitoring-systems',  label: 'Monitoring Systems',   page: 'pages/monitoring-systems.html'  }
    ]
  },
  {
    id: 'deployment',
    label: 'Deployment',
    children: [
      { id: 'docker',           label: 'Docker Containerization',   page: 'pages/docker.html'           },
      { id: 'ci-cd',            label: 'CI/CD Integration',         page: 'pages/ci-cd.html'            },
      { id: 'cloud-deployment', label: 'Cloud Deployment',          page: 'pages/cloud-deployment.html' },
      { id: 'env-variables',    label: 'Environment Variables',     page: 'pages/env-variables.html'    },
      { id: 'health-checks',    label: 'Health Checks & Monitoring',page: 'pages/health-checks.html'   },
      { id: 'deployment-automation', label: 'Deployment Automation', page: 'pages/deployment-automation.html' }
    ]
  },
  {
    id: 'integrations',
    label: 'Integrations',
    children: [
      { id: 'webhooks',             label: 'Webhooks',             page: 'pages/webhooks.html'             },
      { id: 'rest-clients',         label: 'REST Clients',         page: 'pages/rest-clients.html'         },
      { id: 'oauth2',               label: 'OAuth 2.0',            page: 'pages/oauth2.html'               },
      { id: 'database-connections', label: 'Database Connections', page: 'pages/database-connections.html' },
      { id: 'message-queues',       label: 'Message Queues',       page: 'pages/message-queues.html'       },
      { id: 'machine-learning-integration', label: 'Machine Learning Integration', page: 'pages/machine-learning-integration.html' },
      { id: 'blockchain-integration', label: 'Blockchain Integration', page: 'pages/blockchain-integration.html' }
    ]
  },
  {
    id: 'troubleshooting',
    label: 'Troubleshooting',
    children: [
      { id: 'debug-mode',    label: 'Debug Mode',            page: 'pages/debug-mode.html'    },
      { id: 'error-codes',   label: 'Error Codes Reference', page: 'pages/error-codes.html'   },
      { id: 'common-issues', label: 'Common Issues',         page: 'pages/common-issues.html' },
      { id: 'logging-guide', label: 'Logging Guide',         page: 'pages/logging-guide.html' },
      { id: 'support',       label: 'Support & Resources',   page: 'pages/support.html'       }
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
const elSearchResultCount = document.getElementById('search-result-count');
const elSearchErrorMessage = document.getElementById('search-error-message');
const elSearchNavControls = document.getElementById('search-nav-controls');
const elSearchMatchInfo = document.getElementById('search-match-info');
const elSearchPrevBtn = document.getElementById('search-prev-btn');
const elSearchNextBtn = document.getElementById('search-next-btn');
const elSearchClearBtn = document.getElementById('search-clear-btn');

/* Image Modal DOM refs */
const elImageModal            = document.getElementById('image-modal');
const elImageModalImg         = document.getElementById('image-modal-img');
const elImageModalCaption     = document.getElementById('image-modal-caption');
const elImageModalSectionLink = document.getElementById('image-modal-section-link');
const elImageModalViewLink    = document.getElementById('image-modal-view-link');
const elImageModalClose       = document.getElementById('image-modal-close');
const elImageModalPrev        = document.getElementById('image-modal-prev');
const elImageModalNext        = document.getElementById('image-modal-next');
const elImageModalCounter     = document.getElementById('image-modal-counter');

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

const tagState = {
  index: [],        // [{tag, pageTitle, pageUrl, navId, sectionTitle, sectionId, snippet, tagElIndex}]
  isViewOpen: false,
  currentTag: null
};

/**
 * Build search index by loading and parsing all pages
 */
async function buildSearchIndex() {
  searchState.index = [];
  tagState.index = [];
  
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
          
          if (!text) return; // Skip empty headings, ex <h1></h1>
          
          // Get text content of section (until next heading of same or higher level)
          let content = '';
          let nextEl = heading.nextElementSibling;
          while (nextEl) {
            const tagName = nextEl.tagName.toLowerCase();
            if (tagName.match(/^h[1-6]$/)) {
              break; // Stop at next heading
            }

            if (nextEl?.textContent?.trim()) {
              // Use textContent to safely extract text content
              content += nextEl.textContent.trim() + ' ';
            }
            nextEl = nextEl.nextElementSibling;
          }
          
          sections.push({
            id,
            title: text,
            content: content.trim(), // Limit content length
            level
          });
        });
        
        // Extract tag data from [data-tags] elements — reuse this same fetch
        const tagEntries = [];
        const tagEls = Array.from(doc.querySelectorAll('[data-tags]'));
        const headingsWithIds = Array.from(doc.querySelectorAll('h1[id], h2[id], h3[id], h4[id]'));
        tagEls.forEach((el, tagElIdx) => {
          const raw = el.dataset.tags || '';
          const tags = raw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
          if (!tags.length) return;

          // Check if the tagged element is a heading or is nested inside one
          const HEADING_TAGS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
          const containingHeading = HEADING_TAGS.includes(el.tagName)
            ? el
            : el.closest('h1,h2,h3,h4,h5,h6');

          let sectionTitle, sectionId, snippet;

          if (containingHeading) {
            // Tag is on or inside a heading - use the section content that follows
            sectionTitle = containingHeading.textContent.trim();
            sectionId    = containingHeading.id || null;
            let sectionContent = '';
            let nextEl = containingHeading.nextElementSibling;
            while (nextEl) {
              if (/^h[1-6]$/i.test(nextEl.tagName)) break;
              if (nextEl.textContent?.trim()) sectionContent += nextEl.textContent.trim() + ' ';
              nextEl = nextEl.nextElementSibling;
            }
            snippet = sectionContent.trim() || sectionTitle;
          } else {
            // Find nearest preceding heading with an id
            let nearestHeading = null;
            for (const h of headingsWithIds) {
              if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
                nearestHeading = h;
              }
            }
            sectionTitle = nearestHeading ? nearestHeading.textContent.trim() : title;
            sectionId    = nearestHeading ? nearestHeading.id               : null;
            snippet      = (el.textContent || '').replace(/\s+/g, ' ').trim();
          }

          if (snippet.length > 200) snippet = snippet.substring(0, 200) + '...';

          tags.forEach(tag => {
            tagEntries.push({
              tag,
              pageTitle: title,
              pageUrl,
              navId: findNavItemByPage(pageUrl)?.id ?? null,
              sectionTitle,
              sectionId,
              snippet,
              tagElIndex: tagElIdx
            });
          });
        });

        // Return page data for index
        return {
          url: pageUrl,
          title,
          sections,
          // Get nav item info for this page
          navInfo: findNavItemByPage(pageUrl),
          tagEntries
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
    tagState.index = results.filter(page => page !== null).flatMap(page => page.tagEntries || []);
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

function hasError(message) {
  searchState.results = [];
  searchState.hasValidationError = true;
  showSearchError(message);
}

/**
 * Perform search query with comprehensive validation
 */
function performSearch(query) {
  query = query.trim();
  
  // Hide any existing error messages
  if (elSearchErrorMessage) {
    elSearchErrorMessage.classList.remove('visible');
  }
  
  if (!query) {
    searchState.results = [];
    searchState.hasValidationError = false;
    searchState.currentQuery = ''; // Reset current query
    return;
  }
  
  // Validate input type and length
  if (typeof query !== 'string') {
    hasError('Invalid search input');
    return;
  }
  
  // Validate search length
  if (query.length > 25) {
    hasError('Search text is too long. Please reduce to 25 characters or fewer.');
    return;
  }  
  
  // Check for potentially malicious patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /data:text\/html/i,
    /on\w+\s*=/i, // onload=, onclick=, etc.
    /\beval\s*\(/i,
    /\bexec\s*\(/i
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(query)) {
      console.log('query***', query);
      hasError('Search query contains invalid characters');
      return;
    }
  }
  
  // Clear validation error flag if we get here
  searchState.hasValidationError = false;
  
  query = query.toLowerCase();
  searchState.currentQuery = query;
  searchState.results = [];
  
  const pageQueryIndex = {};
  // Search through index
  for (const page of searchState.index) {
    pageQueryIndex[page.url] = 0; // cumulative highlight offset for this page

    // Search in sections
    for (const section of page.sections) {
      const titleMatch = section.title.toLowerCase().includes(query);
      const contentMatch = section.content.toLowerCase().includes(query);
      
      if (titleMatch || contentMatch) {
        const matchCount = countQueryInstances(`${section.title} ${section.content}`, query);
        const matchText = titleMatch ? section.title : section.content;
        const normalizedCount = Math.max(matchCount, 1);
        searchState.results.push({
          type: 'section',
          page: page,
          section: section,
          title: section.title,
          snippet: getSnippet(matchText, query),
          matchCount: normalizedCount,
          navId: page.navInfo ? page.navInfo.id : null,
          sectionId: section.id,
          instanceIndex: pageQueryIndex[page.url] // first highlight index for this section
        });
        pageQueryIndex[page.url] += normalizedCount; // advance by actual match count
      }
    }
  }
}

/**
 * Safely strip HTML tags and preserve readable spacing
 * Uses DOMPurify-like approach for security
 */
function stripHtml(text) {
  if (!text) return '';
  
  // Input validation
  if (typeof text !== 'string') return '';
  
  // Create a temporary element in a safe way
  const temp = document.createElement('div');
  
  // Set textContent first to avoid any script execution
  temp.textContent = text;
  
  // Get the safely parsed content
  let cleanText = temp.textContent || '';
  
  // Replace multiple whitespace with single space and trim
  cleanText = cleanText.replaceAll(/\s+/g, ' ').trim();
  
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
 * Count case-insensitive query occurrences in section text.
 */
function countQueryInstances(text, query) {
  if (!text || !query) return 0;

  const regex = new RegExp(escapeRegex(query), 'gi');
  const matches = text.match(regex);
  return matches ? matches.length : 0;
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
    hideResultCount();
    return;
  }
  
  // If there's a validation error, don't show results
  if (searchState.hasValidationError) {
    elSearchResults.classList.remove('visible');
    hideResultCount();
    return;
  }
  
  if (searchState.results.length === 0) {
    elSearchResults.innerHTML = `
      <div class="search-no-results">
        No results found for "${escapeHtml(searchState.currentQuery)}"
      </div>
    `;
    elSearchResults.classList.add('visible');
    hideResultCount();
    return;
  }

  // if you would like more results for the user, you can up the number or comment out this if statement
  if (searchState.results.length > 250) {
    elSearchResults.innerHTML = `
      <div class="search-no-results">
        Too many results (${searchState.results.length}) for "${escapeHtml(searchState.currentQuery)}". Please refine your search.
      </div>
    `;
    elSearchResults.classList.add('visible');
    hideResultCount();
    return
  }

  const resultsHTML = searchState.results.map((result, index) => {
    const pageName = result.page.navInfo ? result.page.navInfo.label : result.page.title;
    const isHighlighted = index === searchState.selectedResult ? ' highlighted' : '';
    const hasInstanceCount = result.matchCount > 1;
    const instanceCountClass = hasInstanceCount ? ' has-instance-count' : '';
    const instanceCountBadge = hasInstanceCount
      ? `<span class="search-result-instance-count" data-tooltip="${result.matchCount} matches in this section" aria-label="${result.matchCount} matches in this section">${result.matchCount}</span>`
      : '';
    const textOnly = stripHtmlExceptMark(result.snippet);
    
    return `
      <div class="search-result-item${isHighlighted}${instanceCountClass}" data-index="${index}" data-instance-index="${result.instanceIndex}" role="option">
        ${instanceCountBadge}
        <div class="result-page">${escapeHtml(pageName)}</div>
        <div class="result-section">${escapeHtml(result.title)}</div>
        <div class="result-snippet">${textOnly}</div>
      </div>
    `;
  }).join('');
  
  elSearchResults.innerHTML = resultsHTML;
  elSearchResults.classList.add('visible');
  showResultCount(searchState.results.length, searchState.results.length);
  setupTooltipsIn(elSearchResults);
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

/**
 * Show result count
 */
function showResultCount(showing, total) {
  if (!elSearchResultCount) return;
  
  elSearchResultCount.textContent = `Showing ${showing} of ${total} results`;
  elSearchResultCount.style.bottom = `-${elSearchResults.offsetHeight + 30}px`; // make it show up in the right place
  elSearchResultCount.classList.add('visible');
}

/**
 * Hide result count
 */
function hideResultCount() {
  if (!elSearchResultCount) return;
  
  elSearchResultCount.classList.remove('visible');
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
      // Split on matches and build DOM nodes - never use innerHTML here,
      // because textContent of <pre><code> nodes contains decoded characters
      // (e.g. "<img>") that would be re-parsed as real HTML if set via innerHTML.
      const parts = text.split(new RegExp(`(${escapeRegex(searchTerms)})`, 'gi'));
      const fragment = document.createDocumentFragment();

      parts.forEach(part => {
        if (part.toLowerCase() === searchTerms.toLowerCase()) {
          const span = document.createElement('span');
          span.className = 'search-highlight';
          span.textContent = part;
          fragment.appendChild(span);
        } else if (part) {
          fragment.appendChild(document.createTextNode(part));
        }
      });

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
  hideResultCount(); // Clear result count
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
      !elSearchClose || !elSearchResults || !elSearchResultCount || !elSearchContainer) {
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
function parseRoute(url = globalThis.location.hash) {
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
      if (newUrl !== globalThis.location.hash) {
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
      // Wait for content to render, then use rAF so layout is fully painted
      // before we measure positions. Scroll the container directly instead of
      // scrollIntoView() which only scrolls relative to the viewport.
      setTimeout(() => {
        requestAnimationFrame(() => {
          const target = elContentBody.querySelector(`#${CSS.escape(sectionId)}`);
          if (target) {
            const containerTop  = elContentScroll.getBoundingClientRect().top;
            const targetTop     = target.getBoundingClientRect().top;
            const scrollOffset  = targetTop - containerTop + elContentScroll.scrollTop;
            elContentScroll.scrollTo({
              top: scrollOffset,
              behavior: smooth ? 'smooth' : 'auto'
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
        });
      }, 100);
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
  globalThis.addEventListener('popstate', handlePopState, {
    signal: state.abortController.signal
  });
  
  // Also handle hashchange as backup
  globalThis.addEventListener('hashchange', (event) => {
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
  elHtml.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY_THEME, theme);
}

function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY_THEME);
  const prefersDark = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

elThemeToggle.addEventListener('click', () => {
  const current = elHtml.dataset.theme;
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
  /* Close image modal if open when navigating to a new page */
  closeImageModal();

  /* Close tag results view if open when navigating to a new page */
  if (tagState.isViewOpen) closeTagView();

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
    setupGallerySystems(); // Enhance gallery layouts before wiring modal triggers
    setupImageModal();     // Wire up .image-modal images on the new page
    setupContentSectionLinks(); // Wire smooth-scroll for in-content a[data-target] links
    setupTagIndicators();             // Wire tag indicator icons on [data-tags] elements (before tooltip scan)
    setupTooltipsIn(elContentBody); // Wire any tooltips in the newly loaded content
    renderTagBadgesInSidebar();       // Show page tags in the right sidebar

    return true; // Success

  } catch (err) {
    // Safely escape the URL and error message
    const safeUrl = escapeHtml(url);
    const safeError = escapeHtml(err.message);
    
    elContentBody.innerHTML = `
      <div class="content-body">
        <div class="callout danger">
          <div class="callout-title">⚠ Error loading page</div>
          <p>Could not load <code>${safeUrl}</code>. ${safeError}</p>
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
    a.dataset.target   = h.id;
    a.textContent      = h.textContent;
    a.dataset.level    = level;

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
   TAG SYSTEM
   ═══════════════════════════════════════════════════════════════ */

const TAG_SVG = `<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M1.5 1.5h4.086a.5.5 0 0 1 .354.146l4.5 4.5a.5.5 0 0 1 0 .708l-4.086 4.086a.5.5 0 0 1-.708 0l-4.5-4.5A.5.5 0 0 1 1 6.086V2a.5.5 0 0 1 .5-.5z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="3.5" cy="3.5" r="0.8" fill="currentColor"/></svg>`;

/**
 * Render tag badges in the right sidebar for the current page.
 * Called after every page load.
 */
function renderTagBadgesInSidebar() {
  const existing = document.getElementById('right-tags');
  if (existing) existing.remove();

  const tagEls = elContentBody.querySelectorAll('[data-tags]');
  if (!tagEls.length) return;

  const uniqueTags = new Set();
  tagEls.forEach(el => {
    const raw = el.dataset.tags || '';
    raw.split(',').forEach(t => {
      const tag = t.trim().toLowerCase();
      if (tag) uniqueTags.add(tag);
    });
  });
  if (!uniqueTags.size) return;

  const section = document.createElement('div');
  section.id = 'right-tags';
  section.className = 'right-tags';

  const header = document.createElement('div');
  header.className = 'right-tags-header';
  header.textContent = 'Tags';
  section.appendChild(header);

  const list = document.createElement('div');
  list.className = 'right-tags-list';

  uniqueTags.forEach(tag => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tag-badge';
    btn.dataset.tag = tag;
    btn.setAttribute('aria-label', `View all content tagged: ${tag}`);
    btn.innerHTML = `${TAG_SVG}<span>${escapeHtml(tag)}</span>`;
    btn.addEventListener('click', () => openTagView(tag));
    list.appendChild(btn);
  });

  section.appendChild(list);
  elRightSidebar.appendChild(section);
}

/**
 * Insert tag indicator icon groups into all [data-tags] elements in current content.
 * Called after every page load.
 */
function setupTagIndicators() {
  const tagEls = elContentBody.querySelectorAll('[data-tags]');
  tagEls.forEach((el, idx) => {
    el.dataset.tagElIndex = idx;
    if (el.querySelector('.tag-indicator-group')) return; // already wired

    const raw = el.dataset.tags || '';
    const tags = raw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (!tags.length) return;

    // Ensure the element can contain an absolutely-positioned child
    if (globalThis.getComputedStyle(el).position === 'static') {
      el.classList.add('has-tag-indicators');
    }

    const group = document.createElement('div');
    group.className = 'tag-indicator-group';
    group.setAttribute('aria-hidden', 'true');

    tags.forEach(tag => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tag-indicator-btn';
      btn.dataset.tag = tag;
      btn.setAttribute('aria-label', `View tag: ${tag}`);
      btn.dataset.tooltip = `#${tag}`;
      btn.innerHTML = TAG_SVG;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openTagView(tag);
      });
      group.appendChild(btn);
    });

    el.insertBefore(group, el.firstChild);
  });
}

/**
 * Open the Tag Results View for the given tag.
 * Hides the normal page content and right-nav, shows the results panel.
 */
function openTagView(tag) {
  const results = tagState.index.filter(e => e.tag === tag);

  tagState.isViewOpen = true;
  tagState.currentTag = tag;

  // Hide the right-nav page outline and tag badges
  elRightNav.classList.add('tag-view-hidden');
  const rightTagsEl = document.getElementById('right-tags');
  if (rightTagsEl) rightTagsEl.style.display = 'none';

  // Hide the normal page content
  elContentBody.style.display = 'none';

  // Build and inject the results panel
  const tagView = document.createElement('div');
  tagView.id = 'tag-results-view';
  tagView.className = 'tag-results-view';
  tagView.innerHTML = buildTagResultsHTML(tag, results);
  elContentScroll.appendChild(tagView);

  elContentScroll.scrollTop = 0;

  // Wire close button
  const closeBtn = tagView.querySelector('#tag-results-close');
  if (closeBtn) closeBtn.addEventListener('click', closeTagView);

  // Wire result item navigation via event delegation
  tagView.addEventListener('click', e => {
    const item = e.target.closest('.tag-result-item');
    if (item) navigateToTaggedElement(item.dataset.navId, Number.parseInt(item.dataset.tagElIndex, 10));
  });

  tagView.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const item = e.target.closest('.tag-result-item');
      if (item) {
        e.preventDefault();
        navigateToTaggedElement(item.dataset.navId, Number.parseInt(item.dataset.tagElIndex, 10));
      }
    }
  });
}

/**
 * Build the inner HTML string for the Tag Results View.
 */
function buildTagResultsHTML(tag, results) {
  const TAG_SVG_LG = `<svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true"><path d="M1.5 1.5h4.086a.5.5 0 0 1 .354.146l4.5 4.5a.5.5 0 0 1 0 .708l-4.086 4.086a.5.5 0 0 1-.708 0l-4.5-4.5A.5.5 0 0 1 1 6.086V2a.5.5 0 0 1 .5-.5z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="3.5" cy="3.5" r="0.9" fill="currentColor"/></svg>`;
  const countText = results.length === 0 ? 'No results'
    : results.length === 1 ? '1 result'
    : `${results.length} results`;

  const itemsHTML = results.length === 0
    ? '<div class="tag-results-empty">No indexed content found for this tag. The index may still be loading.</div>'
    : results.map(r => `
        <div class="tag-result-item" data-nav-id="${escapeHtml(r.navId || '')}" data-tag-el-index="${r.tagElIndex}" role="button" tabindex="0">
          <div class="result-page">${escapeHtml(r.pageTitle)}</div>
          <div class="result-section">${escapeHtml(r.sectionTitle || '')}</div>
          <div class="result-snippet">${escapeHtml(r.snippet)}</div>
        </div>`).join('');

  return `
    <div class="tag-results-header">
      <div class="tag-results-title">${TAG_SVG_LG}<span>Tag: <strong>${escapeHtml(tag)}</strong></span></div>
      <span class="tag-results-count">${escapeHtml(countText)}</span>
      <button type="button" id="tag-results-close" class="btn-icon" aria-label="Close tag results" title="Close tag results">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    <div class="tag-results-list">${itemsHTML}</div>`;
}

/**
 * Close the Tag Results View and restore the normal page state.
 */
function closeTagView() {
  if (!tagState.isViewOpen) return;
  tagState.isViewOpen = false;
  tagState.currentTag = null;

  elRightNav.classList.remove('tag-view-hidden');
  const rightTagsEl = document.getElementById('right-tags');
  if (rightTagsEl) rightTagsEl.style.display = '';
  elContentBody.style.display = '';

  const tagView = document.getElementById('tag-results-view');
  if (tagView) tagView.remove();
}

/**
 * Navigate to a specific tagged element on a (possibly different) page,
 * then scroll to it and flash-highlight it.
 */
async function navigateToTaggedElement(navId, tagElIndex) {
  closeTagView();

  if (navId) {
    await navigateTo(navId, null, true, true);
  }

  // After navigation / same-page restore, scroll to the tagged element
  setTimeout(() => {
    const tagEls = elContentBody.querySelectorAll('[data-tags]');
    const target = tagEls[tagElIndex];
    if (!target) return;

    const containerTop  = elContentScroll.getBoundingClientRect().top;
    const targetTop     = target.getBoundingClientRect().top;
    const scrollOffset  = targetTop - containerTop + elContentScroll.scrollTop - 80;
    elContentScroll.scrollTo({ top: Math.max(0, scrollOffset), behavior: 'smooth' });

    // Flash highlight
    target.classList.add('tag-highlight');
    target.addEventListener('animationend', () => target.classList.remove('tag-highlight'), { once: true });
  }, 300);
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
      const currentHash = globalThis.location.hash;
      
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
    if (navigator.clipboard && globalThis.isSecureContext) {
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
  
  try {
    // Use the deprecated method as a last resort
    const successful = document.execCommand('copy');
    textarea.remove(); // Use modern remove() method
    
    if (!successful) {
      throw new Error('execCommand copy failed');
    }
  } catch (err) {
    textarea.remove(); // Ensure cleanup even on error
    throw new Error('Fallback copy method failed: ' + err.message);
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
   IMAGE MODAL
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   GALLERY SYSTEMS
   ═══════════════════════════════════════════════════════════════ */

function setGalleryImageAttrs(img) {
  if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
  if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
}

/**
 * Wire smooth-scroll navigation for in-content links that use data-target
 * to reference a heading id on the same page (e.g. <a data-target="some-id">).
 */
function setupContentSectionLinks() {
  /* Same-page section scroll: a[data-target] */
  elContentBody.querySelectorAll('a[data-target]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(null, a.dataset.target, true, true);
    });
  });

  /* Cross-page doc links: a[data-nav]
   * Usage:  <a href="#navId" data-nav="navId">Label</a>
   *         <a href="#navId#sectionId" data-nav="navId" data-section="sectionId">Label</a>
   *
   * Loads the target page via AJAX, opens the correct left-nav menu,
   * and (optionally) scrolls to data-section within that page.
   */
  elContentBody.querySelectorAll('a[data-nav]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const navId     = a.dataset.nav     || null;
      const sectionId = a.dataset.section || null;
      navigateTo(navId, sectionId, true, true);
    });
  });
}

function setupGallerySystems() {
  setupFlexGalleries();
  setupCoverGalleries();
  setupThumbnailGalleries();
}

function setupFlexGalleries() {
  const galleries = elContentBody.querySelectorAll('.flex-img-gallery');
  galleries.forEach((gallery) => {
    if (gallery.dataset.galleryFlexInit === 'true') return;
    gallery.dataset.galleryFlexInit = 'true';

    const imgs = gallery.querySelectorAll('img');
    imgs.forEach((img) => {
      img.classList.add('image-modal');
      setGalleryImageAttrs(img);

      const explicit = img.dataset.full || img.dataset.modalSrc;
      if (explicit) {
        img.dataset.modalSrc = explicit;
      }
    });
  });
}

function setupCoverGalleries() {
  const galleries = elContentBody.querySelectorAll('.cover-img-gallery');
  galleries.forEach((gallery) => {
    if (gallery.dataset.galleryCoverInit === 'true') return;
    gallery.dataset.galleryCoverInit = 'true';
    gallery.classList.add('is-enhanced');

    const imgs = Array.from(gallery.querySelectorAll('img'));
    imgs.forEach((img) => {
      if (img.closest('.cover-img-item')) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'cover-img-item';

      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'cover-img-tile image-modal-trigger';

      const alt = img.alt || '';
      const modalSrc = img.dataset.full || img.dataset.modalSrc || img.getAttribute('src') || img.src;

      if (modalSrc) tile.dataset.modalSrc = modalSrc;
      if (alt) tile.dataset.modalAlt = alt;

      tile.setAttribute('aria-label', alt ? `View image: ${alt}` : 'View image');
      tile.dataset.coverSrc = img.getAttribute('src') || img.currentSrc || img.src;
      if (tile.dataset.coverSrc) {
        tile.style.setProperty('--cover-src', `url("${tile.dataset.coverSrc}")`);
      }

      img.classList.add('cover-img-source');
      img.setAttribute('aria-hidden', 'true');
      setGalleryImageAttrs(img);

      const parent = img.parentNode;
      if (!parent) return;

      wrapper.appendChild(tile);
      parent.insertBefore(wrapper, img);
      wrapper.appendChild(img);
    });

    hydrateCoverTiles(gallery);
  });
}

function hydrateCoverTiles(gallery) {
  const tiles = gallery.querySelectorAll('.cover-img-tile');
  if (!tiles.length) return;

  if (!('IntersectionObserver' in window)) {
    tiles.forEach((tile) => {
      if (tile.dataset.coverSrc && !tile.style.getPropertyValue('--cover-src')) {
        tile.style.setProperty('--cover-src', `url("${tile.dataset.coverSrc}")`);
      }
    });
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const tile = entry.target;
      if (tile.dataset.coverSrc && !tile.style.getPropertyValue('--cover-src')) {
        tile.style.setProperty('--cover-src', `url("${tile.dataset.coverSrc}")`);
      }
      obs.unobserve(tile);
    });
  }, { root: elContentScroll, rootMargin: '100px 0px' });

  tiles.forEach((tile) => observer.observe(tile));
}

function setupThumbnailGalleries() {
  const galleries = elContentBody.querySelectorAll('.thumbnail-img-gallery');
  galleries.forEach((gallery) => {
    if (gallery.dataset.galleryThumbInit === 'true') return;
    gallery.dataset.galleryThumbInit = 'true';

    const imgs = gallery.querySelectorAll('img');
    imgs.forEach((img) => {
      img.classList.add('image-modal');
      setGalleryImageAttrs(img);

      const explicit = img.dataset.full || img.dataset.modalSrc;
      if (explicit) {
        img.dataset.modalSrc = explicit;
        return;
      }

      const derived = deriveLargeImageSrc(img.getAttribute('src') || img.src);
      if (!derived || derived === img.getAttribute('src') || derived === img.src) return;

      // Set optimistically - modal will fall back via onerror if the _big file doesn't exist.
      img.dataset.modalSrc = derived;
    });
  });
}

function deriveLargeImageSrc(src) {
  if (!src) return '';
  if (src.includes('_big.')) return src;

  const match = src.match(/(\.[a-zA-Z0-9]+)(\?.*)?$/);
  if (!match) return src;

  const ext = match[1];
  const query = match[2] || '';
  const base = src.slice(0, match.index);
  return `${base}_big${ext}${query}`;
}

const imageModalState = {
  images: [],       // [{ src, alt, sectionId, sectionTitle }]
  currentIndex: -1,
  lastFocused: null,
  isOpen: false,
};

/**
 * Find the nearest preceding heading with an id for the given element.
 */
function findNearestSection(el) {
  const headings = Array.from(elContentBody.querySelectorAll('h1[id], h2[id], h3[id], h4[id]'));
  if (!headings.length) return null;
  let nearest = null;
  for (const h of headings) {
    // DOCUMENT_POSITION_FOLLOWING (4) means el comes after h in document order
    if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
      nearest = h;
    }
  }
  return nearest;
}

/**
 * Scan current page content for img.image-modal elements,
 * store their metadata, and wire click / keyboard handlers.
 * Safe to call on every page load - resets state each time.
 */
function setupImageModal() {
  imageModalState.images = [];

  const elements = Array.from(
    elContentBody.querySelectorAll('img.image-modal, .image-modal-trigger')
  );
  let modalIndex = 0;

  elements.forEach((el) => {
    const section      = findNearestSection(el);
    const sectionId    = section ? section.id                : null;
    const sectionTitle = section ? section.textContent.trim() : null;

    const isImage = el.tagName === 'IMG';
    const alt = isImage ? (el.alt || '') : (el.dataset.modalAlt || el.getAttribute('aria-label') || '');

    // Resolve src lazily (at open time) so async _big probes in thumbnail galleries
    // have time to set data-modal-src before the user clicks.
    const eagerSrc = isImage ? (el.dataset.modalSrc || el.getAttribute('src') || el.src) : (el.dataset.modalSrc || '');
    if (!eagerSrc) return;

    const index = modalIndex++;
    // Store the trigger element for all gallery types so "View in page" can scroll back to it.
    imageModalState.images.push({ el, src: eagerSrc, alt, sectionId, sectionTitle });

    if (isImage) {
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `View image${alt ? ': ' + alt : ''}`);
    } else if (el.tagName !== 'BUTTON' && el.tagName !== 'A') {
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      if (!el.getAttribute('aria-label')) {
        el.setAttribute('aria-label', alt ? `View image: ${alt}` : 'View image');
      }
    }

    el.addEventListener('click', () => openImageModal(index));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openImageModal(index);
      }
    });
  });
}

/**
 * Open the modal at the given index.
 */
function openImageModal(index) {
  if (!elImageModal || !imageModalState.images.length) return;

  imageModalState.lastFocused = document.activeElement;
  imageModalState.isOpen = true;

  elImageModal.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';

  showImageAt(index);
  elImageModalClose.focus();

  elImageModal.addEventListener('keydown', trapModalFocus);
  document.addEventListener('keydown', handleModalKeydown);
}

/**
 * Close the modal and restore focus to the triggering element.
 */
function closeImageModal() {
  if (!elImageModal || !imageModalState.isOpen) return;

  imageModalState.isOpen = false;
  elImageModal.setAttribute('hidden', '');
  document.body.style.overflow = '';

  elImageModal.removeEventListener('keydown', trapModalFocus);
  document.removeEventListener('keydown', handleModalKeydown);

  if (imageModalState.lastFocused && typeof imageModalState.lastFocused.focus === 'function') {
    imageModalState.lastFocused.focus();
  }
  imageModalState.lastFocused = null;
}

/**
 * Populate the modal with the image at the given index.
 */
function showImageAt(index) {
  const total = imageModalState.images.length;
  if (index < 0 || index >= total) return;

  imageModalState.currentIndex = index;
  const entry = imageModalState.images[index];

  // Re-read data-modal-src from the element at click time (set during gallery setup).
  const src = (entry.el && (entry.el.dataset.modalSrc || entry.el.getAttribute('src') || entry.el.src)) || entry.src;
  const fallbackSrc = (entry.el && (entry.el.getAttribute('src') || entry.el.src)) || entry.src;

  elImageModalImg.onerror = null;
  elImageModalImg.src = src;
  elImageModalImg.alt = entry.alt;

  // If the _big file doesn't exist, fall back to the original thumbnail src silently.
  if (src !== fallbackSrc) {
    elImageModalImg.onerror = () => {
      elImageModalImg.onerror = null;
      elImageModalImg.src = fallbackSrc;
    };
  }

  elImageModalCaption.textContent = entry.alt;

  if (entry.sectionId && entry.sectionTitle) {
    elImageModalSectionLink.textContent = `\u2191 Back to section: ${entry.sectionTitle}`;
    elImageModalSectionLink.dataset.sectionId = entry.sectionId;
    elImageModalSectionLink.hidden = false;
  } else {
    elImageModalSectionLink.hidden = true;
  }

  if (elImageModalViewLink) {
    if (entry.el) {
      elImageModalViewLink.dataset.imageIndex = index;
      elImageModalViewLink.hidden = false;
    } else {
      elImageModalViewLink.hidden = true;
    }
  }

  elImageModalCounter.textContent = total > 1 ? `${index + 1} / ${total}` : '';
  elImageModalPrev.disabled = index <= 0;
  elImageModalNext.disabled = index >= total - 1;
}

/**
 * Focus trap - keep keyboard focus inside the open modal.
 */
function trapModalFocus(e) {
  if (e.key !== 'Tab') return;

  const focusable = Array.from(
    elImageModal.querySelectorAll('button:not([disabled]), a:not([hidden])')
  );
  if (!focusable.length) return;

  const first = focusable[0];
  const last  = focusable.at(-1);

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/**
 * Keyboard shortcuts while the modal is open.
 * Escape closes; ArrowLeft/ArrowRight navigate images.
 */
function handleModalKeydown(e) {
  if (!imageModalState.isOpen) return;
  switch (e.key) {
    case 'Escape':
      e.preventDefault();
      closeImageModal();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      if (imageModalState.currentIndex > 0) showImageAt(imageModalState.currentIndex - 1);
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (imageModalState.currentIndex < imageModalState.images.length - 1) showImageAt(imageModalState.currentIndex + 1);
      break;
  }
}

/**
 * Close the modal, scroll the trigger element into view, and flash-highlight it.
 */
function scrollToImageElement(el) {
  closeImageModal();
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // Remove any stale highlight from a previous call
  elContentBody.querySelectorAll('.image-locate-highlight').forEach((e) => {
    e.classList.remove('image-locate-highlight');
  });
  // Short delay lets the scroll settle before the animation starts
  setTimeout(() => {
    el.classList.add('image-locate-highlight');
    el.addEventListener('animationend', () => el.classList.remove('image-locate-highlight'), { once: true });
  }, 200);
}

/**
 * Wire static modal controls once at app startup.
 */
function initImageModal() {
  if (!elImageModal) return;

  elImageModalClose.addEventListener('click', closeImageModal);

  elImageModalPrev.addEventListener('click', () => {
    showImageAt(imageModalState.currentIndex - 1);
  });

  elImageModalNext.addEventListener('click', () => {
    showImageAt(imageModalState.currentIndex + 1);
  });

  /* Backdrop click - click directly on overlay (not its children) closes modal */
  elImageModal.addEventListener('click', (e) => {
    if (e.target === elImageModal) closeImageModal();
  });

  /* Section link - close modal then scroll to section using existing navigation */
  elImageModalSectionLink.addEventListener('click', (e) => {
    e.preventDefault();
    const sectionId = elImageModalSectionLink.dataset.sectionId;
    if (sectionId) {
      closeImageModal();
      navigateTo(state.activeNavId, sectionId, true, true);
    }
  });

  /* View-in-page link - close modal, scroll to the image element, flash-highlight it */
  if (elImageModalViewLink) {
    elImageModalViewLink.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = parseInt(elImageModalViewLink.dataset.imageIndex, 10);
      const entry = imageModalState.images[idx];
      if (entry && entry.el) scrollToImageElement(entry.el);
    });
  }
}

/* ═══════════════════════════════════════════════════════════════
   TOOLTIP SYSTEM
   Attach data-tooltip="…" (and optionally data-tooltip-position)
   to any element to get a smart, accessible tooltip.
   ═══════════════════════════════════════════════════════════════ */

const TOOLTIP_GAP = 8; // px between anchor and tooltip box

/* All 8 placement names and their opposites (used for flip fallback) */
const TOOLTIP_OPPOSITES = {
  'top':          'bottom',
  'top-left':     'bottom-left',
  'top-right':    'bottom-right',
  'bottom':       'top',
  'bottom-left':  'top-left',
  'bottom-right': 'top-right',
  'left':         'right',
  'right':        'left'
};

/* Ordered fallback chain for each preferred position */
const TOOLTIP_FALLBACKS = {
  'top':          ['top',          'bottom',       'right',  'left'],
  'top-left':     ['top-left',     'bottom-left',  'top',    'bottom'],
  'top-right':    ['top-right',    'bottom-right', 'top',    'bottom'],
  'bottom':       ['bottom',       'top',          'right',  'left'],
  'bottom-left':  ['bottom-left',  'top-left',     'bottom', 'top'],
  'bottom-right': ['bottom-right', 'top-right',    'bottom', 'top'],
  'left':         ['left',         'right',        'top',    'bottom'],
  'right':        ['right',        'left',         'top',    'bottom']
};

let tooltipEl = null;      // single shared <div id="app-tooltip">
let tooltipTarget = null;  // currently hovered / focused element
let tooltipHideTimer = null;

/**
 * Create the singleton tooltip element and append it to <body>.
 * Called once from initTooltips().
 */
function createTooltipElement() {
  const el = document.createElement('div');
  el.id = 'app-tooltip';
  el.setAttribute('role', 'tooltip');
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  return el;
}

/**
 * Compute { left, top } (px, viewport-relative) for a given placement.
 * Returns null if the box would overflow off-screen.
 */
function computeTooltipPosition(anchorRect, ttRect, placement) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const g  = TOOLTIP_GAP;
  let left, top;

  switch (placement) {
    case 'top':
      left = anchorRect.left + anchorRect.width / 2 - ttRect.width / 2;
      top  = anchorRect.top  - ttRect.height - g;
      break;
    case 'top-left':
      left = anchorRect.left;
      top  = anchorRect.top  - ttRect.height - g;
      break;
    case 'top-right':
      left = anchorRect.right - ttRect.width;
      top  = anchorRect.top  - ttRect.height - g;
      break;
    case 'bottom':
      left = anchorRect.left + anchorRect.width / 2 - ttRect.width / 2;
      top  = anchorRect.bottom + g;
      break;
    case 'bottom-left':
      left = anchorRect.left;
      top  = anchorRect.bottom + g;
      break;
    case 'bottom-right':
      left = anchorRect.right - ttRect.width;
      top  = anchorRect.bottom + g;
      break;
    case 'left':
      left = anchorRect.left  - ttRect.width - g;
      top  = anchorRect.top   + anchorRect.height / 2 - ttRect.height / 2;
      break;
    case 'right':
      left = anchorRect.right + g;
      top  = anchorRect.top   + anchorRect.height / 2 - ttRect.height / 2;
      break;
    default:
      return null;
  }

  // Check if this placement fits inside the viewport
  if (left < 0 || top < 0 || left + ttRect.width > vw || top + ttRect.height > vh) {
    return null; // Overflows - caller will try next fallback
  }

  return { left, top };
}

/**
 * Show the tooltip for the given anchor element.
 */
function showTooltip(anchor) {
  clearTimeout(tooltipHideTimer);

  // data-tooltip-template="id" lets authors write real HTML inside a <template> element.
  // Fall back to data-tooltip for plain-text tooltips.
  const templateId = anchor.dataset.tooltipTemplate;
  let text;
  if (templateId) {
    const tmpl = document.getElementById(templateId);
    text = tmpl ? tmpl.innerHTML : '';
  } else {
    text = anchor.dataset.tooltip;
  }
  if (!text) return;

  tooltipTarget = anchor;

  // Populate and initially hide to measure size.
  // innerHTML is intentional - tooltip content is authored in HTML source,
  // not supplied by end users, so the trust level matches the rest of the page.
  tooltipEl.innerHTML = text;
  tooltipEl.className = '';           // clear previous placement class
  tooltipEl.style.left = '-9999px';
  tooltipEl.style.top  = '-9999px';
  tooltipEl.removeAttribute('aria-hidden');
  // Make it "rendered but invisible" so we can measure it
  tooltipEl.style.visibility = 'hidden';
  tooltipEl.style.display    = '';

  const preferred = (anchor.dataset.tooltipPosition || 'top')
    .toLowerCase().trim().replace(/\s+/g, '-');
  const fallbacks = TOOLTIP_FALLBACKS[preferred] || TOOLTIP_FALLBACKS['top'];

  const anchorRect = anchor.getBoundingClientRect();

  // Force a layout pass so getBoundingClientRect is accurate
  tooltipEl.style.maxWidth = '260px';
  const ttRect = tooltipEl.getBoundingClientRect();

  let chosenPlacement = fallbacks[fallbacks.length - 1]; // last-resort fallback
  let chosenPos       = null;

  for (const placement of fallbacks) {
    const pos = computeTooltipPosition(anchorRect, ttRect, placement);
    if (pos) {
      chosenPlacement = placement;
      chosenPos       = pos;
      break;
    }
  }

  // If every fallback overflows (tiny viewport), clamp to screen edges
  if (!chosenPos) {
    chosenPos = computeTooltipPosition(anchorRect, ttRect, chosenPlacement) || { left: 4, top: 4 };
    chosenPos.left = Math.max(4, Math.min(chosenPos.left, window.innerWidth  - ttRect.width  - 4));
    chosenPos.top  = Math.max(4, Math.min(chosenPos.top,  window.innerHeight - ttRect.height - 4));
  }

  // Apply placement class (controls the arrow direction)
  tooltipEl.classList.add('tt-' + chosenPlacement);
  tooltipEl.style.left       = chosenPos.left + 'px';
  tooltipEl.style.top        = chosenPos.top  + 'px';
  tooltipEl.style.visibility = '';

  // Trigger transition
  requestAnimationFrame(() => {
    if (tooltipTarget === anchor) {
      tooltipEl.classList.add('is-visible');
    }
  });

  // Link anchor to tooltip for screen readers
  anchor.setAttribute('aria-describedby', 'app-tooltip');
}

/**
 * Hide the tooltip immediately or after an optional delay.
 */
function hideTooltip(delay = 0) {
  clearTimeout(tooltipHideTimer);
  tooltipHideTimer = setTimeout(() => {
    if (tooltipEl) {
      tooltipEl.classList.remove('is-visible');
      tooltipEl.setAttribute('aria-hidden', 'true');
    }
    if (tooltipTarget) {
      tooltipTarget.removeAttribute('aria-describedby');
      tooltipTarget = null;
    }
  }, delay);
}

/**
 * Wire tooltip events on a single element.
 * Uses event delegation for elements added after init via setupTooltipsIn().
 */
function wireTooltipElement(el) {
  el.addEventListener('mouseenter', () => showTooltip(el));
  el.addEventListener('mouseleave', () => hideTooltip(120));
  el.addEventListener('focus',      () => showTooltip(el));
  el.addEventListener('blur',       () => hideTooltip(120));

  // Hide on touch-tap elsewhere (mobile)
  el.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    showTooltip(el);
  }, { passive: true });
}

/**
 * Scan a container (or the whole document) and wire any un-wired tooltip elements.
 * Safe to call multiple times - skips already-wired elements.
 */
function setupTooltipsIn(root = document) {
  root.querySelectorAll(
    '[data-tooltip]:not([data-tooltip-wired]), [data-tooltip-template]:not([data-tooltip-wired])'
  ).forEach((el) => {
    el.dataset.tooltipWired = 'true';
    wireTooltipElement(el);
  });
}

/**
 * One-time global setup: create the tooltip DOM, wire static UI,
 * and add global hide-on-scroll / resize / Escape listeners.
 */
function initTooltips() {
  tooltipEl = createTooltipElement();

  // Keep tooltip open while the mouse is over it (so links etc. can be clicked).
  tooltipEl.addEventListener('mouseenter', () => clearTimeout(tooltipHideTimer));
  tooltipEl.addEventListener('mouseleave', () => hideTooltip(80));

  // Wire tooltips on static page chrome (header, sidebars, etc.)
  setupTooltipsIn(document);

  // Hide on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && tooltipTarget) hideTooltip();
  }, { signal: state.abortController.signal });

  // Hide on scroll or resize (position would be stale)
  const hideImmediate = () => hideTooltip();
  window.addEventListener('scroll',  hideImmediate, { passive: true, signal: state.abortController.signal });
  window.addEventListener('resize',  hideImmediate, { passive: true, signal: state.abortController.signal });
  elContentScroll.addEventListener('scroll', hideImmediate, { passive: true, signal: state.abortController.signal });

  // Hide on tap anywhere else (touch devices)
  document.addEventListener('touchstart', () => hideTooltip(), { passive: true, signal: state.abortController.signal });
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

  /* Initialize image modal controls (wired once; content scanned per page load) */
  initImageModal();

  /* Initialize tooltip system (static chrome wired once; content re-scanned per load) */
  initTooltips();
  
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
