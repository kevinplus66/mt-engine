/* ============================================================================
   MT-Engine - Filter Component
   Filter state management and UI updates
   ============================================================================ */

import { CATEGORY_MAP, FILTER_CONFIG } from '../config.js';
import { getCurrentLang } from '../i18n.js';

// Filter state
export const filterState = {
    mode: 'normal',
    categories: [],
    resolution: '',
    video: '',
    audio: '',
    country: '',
    discount: ''
};

export function initFilters() {
    // Initialize mode tabs
    initModeTabs();

    // Initialize category pills (empty initially for normal mode)
    updateCategoryPills(filterState.mode);

    // Initialize filter visibility
    updateFilterVisibility(filterState.mode);
}

function initModeTabs() {
    const tabs = document.querySelectorAll('.tab-btn, .mobile-mode-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const mode = tab.getAttribute('data-mode');
            if (mode) {
                setMode(mode);
            }
        });
    });
}

export function setMode(mode) {
    filterState.mode = mode;
    filterState.categories = [];

    // Update UI
    updateActiveTab(mode);
    updateCategoryPills(mode);
    updateFilterVisibility(mode);
}

function updateActiveTab(mode) {
    // Desktop tabs
    document.querySelectorAll('.tab-btn').forEach(tab => {
        if (tab.getAttribute('data-mode') === mode) {
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
        } else {
            tab.classList.remove('active');
            tab.setAttribute('aria-selected', 'false');
        }
    });

    // Mobile tabs
    document.querySelectorAll('.mobile-mode-tab').forEach(tab => {
        if (tab.getAttribute('data-mode') === mode) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

export function updateCategoryPills(mode) {
    const pills = CATEGORY_MAP[mode] || [];
    const langKey = getCurrentLang() === 'zh' ? 'name_zh' : 'name_en';

    // Desktop pills
    const desktopContainer = document.getElementById('categoryPills');
    if (desktopContainer) {
        desktopContainer.innerHTML = pills.map(pill => `
            <button class="cat-pill" data-categories="${pill.id}">
                ${pill[langKey]}
            </button>
        `).join('');

        // Add click handlers
        desktopContainer.querySelectorAll('.cat-pill').forEach(pill => {
            pill.addEventListener('click', () => toggleCategoryPill(pill));
        });
    }

    // Mobile pills
    const mobileContainer = document.getElementById('mobileCategoryPills');
    if (mobileContainer) {
        mobileContainer.innerHTML = pills.map(pill => `
            <button class="mobile-cat-pill" data-categories="${pill.id}">
                ${pill[langKey]}
            </button>
        `).join('');

        // Add click handlers
        mobileContainer.querySelectorAll('.mobile-cat-pill').forEach(pill => {
            pill.addEventListener('click', () => toggleCategoryPill(pill));
        });
    }
}

function toggleCategoryPill(pill) {
    const categories = pill.getAttribute('data-categories');
    pill.classList.toggle('active');

    if (pill.classList.contains('active')) {
        filterState.categories.push(categories);
    } else {
        const index = filterState.categories.indexOf(categories);
        if (index > -1) {
            filterState.categories.splice(index, 1);
        }
    }

    updateResetButtonState();
}

function updateFilterVisibility(mode) {
    const visibleFilters = FILTER_CONFIG[mode] || [];
    const filterWrappers = {
        'resolution': document.getElementById('resolutionWrapper'),
        'video': document.getElementById('videoWrapper'),
        'audio': document.getElementById('audioWrapper'),
        'country': document.getElementById('countryWrapper'),
        'discount': document.getElementById('discountWrapper')
    };

    Object.keys(filterWrappers).forEach(key => {
        const wrapper = filterWrappers[key];
        if (wrapper) {
            wrapper.style.display = visibleFilters.includes(key) ? 'block' : 'none';
        }
    });
}

export function getActiveFilters() {
    // Helper function to convert comma-separated string to integer array
    const toIntArray = (value) => {
        if (!value) return [];
        if (Array.isArray(value)) return value.map(v => parseInt(v, 10));
        return value.toString().split(',').filter(v => v.trim()).map(v => parseInt(v.trim(), 10));
    };

    return {
        mode: filterState.mode,
        categories: Array.isArray(filterState.categories) ? filterState.categories : toIntArray(filterState.categories.join(',')),
        standards: toIntArray(filterState.resolution),
        videoCodecs: toIntArray(filterState.video),
        audioCodecs: toIntArray(filterState.audio),
        sources: [],  // Not used in current UI
        countries: toIntArray(filterState.country),
        discount: filterState.discount || ''
    };
}

export function resetFilters() {
    // Reset state (keep mode)
    filterState.categories = [];
    filterState.resolution = '';
    filterState.video = '';
    filterState.audio = '';
    filterState.country = '';
    filterState.discount = '';

    // Reset UI
    document.querySelectorAll('.cat-pill, .mobile-cat-pill').forEach(pill => {
        pill.classList.remove('active');
    });

    document.querySelectorAll('.filter-select').forEach(select => {
        select.value = '';
    });

    updateResetButtonState();
}

export function updateResetButtonState() {
    const hasFilters = filterState.categories.length > 0 ||
        filterState.resolution || filterState.video ||
        filterState.audio || filterState.country || filterState.discount;

    const btn = document.getElementById('resetFiltersBtn');
    if (btn) {
        btn.disabled = !hasFilters;
    }

    // Update filter indicator on mobile
    const indicator = document.getElementById('filterToggleBtn');
    if (indicator) {
        if (hasFilters) {
            indicator.classList.add('has-filters');
        } else {
            indicator.classList.remove('has-filters');
        }
    }
}

// Make functions globally available for onclick handlers
window.resetFilters = resetFilters;
