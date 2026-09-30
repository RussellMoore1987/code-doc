// Portfolio JavaScript for DevDocs

// @versioning
// * update JS with versioning to prevent caching issues. look for '?v=' in index.html

/* ============================================================
   PORTFOLIO - PROJECT TAG FILTER
   Lightweight, page-local enhancement for pages/portfolio/projects.html.
   Reuses the existing [data-tags] values already authored on each
   project's figure (the same attribute the sitewide tag system reads)
   instead of introducing a second, parallel tagging scheme.
   BEGIN
============================================================ */

(function () {

'use strict';

const GALLERY_SELECTOR = '.pf-project-gallery';
const FILTER_BAR_ID     = 'pf-project-filters';

/** Pull the unique, sorted set of tags off every tagged figure in the gallery. */
function collectProjectTags(gallery) {
    const tags = new Set();
    gallery.querySelectorAll('[data-tags]').forEach((el) => {
        (el.dataset.tags || '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .forEach((t) => tags.add(t));
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
}

function applyFilter(gallery, bar, tag) {
    bar.querySelectorAll('.pf-filter-chip').forEach((chip) => {
        chip.classList.toggle('is-active', chip.dataset.filter === tag);
        chip.setAttribute('aria-pressed', chip.dataset.filter === tag ? 'true' : 'false');
    });

    gallery.querySelectorAll(':scope > figure[data-tags]').forEach((figure) => {
        if (tag === 'all') {
            figure.hidden = false;
            return;
        }
        const figureTags = (figure.dataset.tags || '').toLowerCase();
        figure.hidden = !figureTags.split(',').map((t) => t.trim()).includes(tag.toLowerCase());
    });
}

function buildFilterBar(gallery) {
    if (document.getElementById(FILTER_BAR_ID)) return;

    const tags = collectProjectTags(gallery);
    if (!tags.length) return;

    const bar = document.createElement('div');
    bar.id = FILTER_BAR_ID;
    bar.className = 'pf-chip-row';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Filter projects by tag');

    const makeChip = (label, value, active) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'pf-chip pf-filter-chip' + (active ? ' is-active' : '');
        chip.dataset.filter = value;
        chip.textContent = label;
        chip.setAttribute('aria-pressed', active ? 'true' : 'false');
        chip.addEventListener('click', () => applyFilter(gallery, bar, value));
        return chip;
    };

    bar.appendChild(makeChip('All Projects', 'all', true));
    tags.forEach((tag) => bar.appendChild(makeChip(tag, tag, false)));

    gallery.before(bar);
}

/** Called whenever pages/portfolio/projects.html is the active page. */
function pfProjectsSetup() {
    const gallery = document.querySelector(GALLERY_SELECTOR);
    if (!gallery) return;
    buildFilterBar(gallery);
}

/** Watches for AJAX navigation into the Projects page (same pattern as custom.js). */
function pfInit() {
    const contentBody = document.getElementById('content-body');
    if (!contentBody) return;

    if (contentBody.querySelector(GALLERY_SELECTOR)) {
        pfProjectsSetup();
    }

    const observer = new MutationObserver(() => {
        if (contentBody.querySelector(GALLERY_SELECTOR) && !document.getElementById(FILTER_BAR_ID)) {
            pfProjectsSetup();
        }
    });

    observer.observe(contentBody, { childList: true });
}

if (document.readyState !== 'loading') {
    pfInit();
} else {
    document.addEventListener('DOMContentLoaded', pfInit);
}

})(); // end IIFE

/* ============================================================
   PORTFOLIO - PROJECT TAG FILTER
   END
============================================================ */
