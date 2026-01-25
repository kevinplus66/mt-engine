/* ============================================================================
   MT-Engine - Filter Component
   Filter state management and UI updates
   ============================================================================ */

import { CATEGORY_MAP, FILTER_CONFIG } from '../config.js';
import { getCurrentLang, t } from '../i18n.js';

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

    // Initialize drawer pills for search page
    initDrawerPills();
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

function initDrawerPills() {
    // Initialize drawer filter pills (resolution, video, audio, discount)
    const drawerPillContainers = [
        { id: 'drawerResolutionPills', group: 'resolution', stateKey: 'resolution' },
        { id: 'drawerVideoPills', group: 'video', stateKey: 'video' },
        { id: 'drawerAudioPills', group: 'audio', stateKey: 'audio' },
        { id: 'drawerDiscountPills', group: 'discount', stateKey: 'discount' }
    ];

    drawerPillContainers.forEach(container => {
        const element = document.getElementById(container.id);
        if (!element) return;

        const pills = element.querySelectorAll('.drawer-pill');
        pills.forEach(pill => {
            pill.addEventListener('click', () => {
                const value = pill.getAttribute('data-value') || '';
                const group = pill.getAttribute('data-group');

                // Remove active class from all pills in this group
                pills.forEach(p => p.classList.remove('active'));

                // Add active class to clicked pill
                pill.classList.add('active');

                // Update filter state
                filterState[container.stateKey] = value;

                // Update reset button state
                updateResetButtonState();
            });
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
    updateResetButtonState();
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
    const wasActive = pill.classList.contains('active');

    // Remove active state from all pills (single-select logic)
    document.querySelectorAll('.cat-pill, .mobile-cat-pill').forEach(p => {
        p.classList.remove('active');
    });

    // If it was not active before, activate it; otherwise keep it deselected
    if (!wasActive) {
        pill.classList.add('active');
        filterState.categories = [categories];
    } else {
        filterState.categories = [];
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
    // Reset ALL state including mode
    filterState.mode = 'normal';
    filterState.categories = [];
    filterState.resolution = '';
    filterState.video = '';
    filterState.audio = '';
    filterState.country = '';
    filterState.discount = '';

    // Reset mode tabs UI
    updateActiveTab('normal');
    updateCategoryPills('normal');
    updateFilterVisibility('normal');

    // Reset UI
    document.querySelectorAll('.cat-pill, .mobile-cat-pill').forEach(pill => {
        pill.classList.remove('active');
    });

    document.querySelectorAll('.filter-select').forEach(select => {
        select.value = '';
    });

    // Reset drawer pills to "All" (first pill with data-value="")
    document.querySelectorAll('.drawer-pill').forEach(pill => {
        const value = pill.getAttribute('data-value') || '';
        if (value === '') {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });

    updateResetButtonState();
}

export function updateResetButtonState() {
    const hasFilters = filterState.mode !== 'normal' ||
        filterState.categories.length > 0 ||
        filterState.resolution || filterState.video ||
        filterState.audio || filterState.country || filterState.discount;

    const btn = document.getElementById('resetFiltersBtn');
    if (btn) {
        btn.disabled = !hasFilters;
    }

    // Update filter badge
    const badge = document.getElementById('filterCountBadge');
    if (badge) {
        const count = getFilterCount();
        if (count > 0) {
            badge.textContent = `${count} ${t('filtersActive')}`;
            badge.classList.add('visible');
        } else {
            badge.classList.remove('visible');
        }
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

function getFilterCount() {
    let count = 0;
    if (filterState.mode !== 'normal') count++;
    if (filterState.categories.length > 0) count++;
    if (filterState.resolution) count++;
    if (filterState.video) count++;
    if (filterState.audio) count++;
    if (filterState.country) count++;
    if (filterState.discount) count++;
    return count;
}

// Make functions globally available for onclick handlers
window.resetFilters = resetFilters;
