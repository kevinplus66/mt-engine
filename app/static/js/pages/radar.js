/* ============================================================================
   MT-Engine - RADAR Page
   Search page initialization and main logic
   ============================================================================ */

import { initTheme, toggleTheme } from '../components/theme.js';
import { initLanguage, toggleLanguage } from '../components/language.js';
import { showToast } from '../components/toast.js';
import { initDrawer, openFilterDrawer, closeFilterDrawer, applyDrawerFilters as applyFilters } from '../components/drawer.js';
import { initFilters, setMode, filterState, getActiveFilters, resetFilters, updateResetButtonState, updateCategoryPills } from '../components/filter.js';
import { initTable, renderTorrents, appendTorrents, sortTable, showLoadingSkeleton } from '../components/table.js';
import { searchTorrents } from '../api.js';
import { t, updatePageLanguage, currentLang, setCurrentPage } from '../i18n.js';
import { debounce, hapticFeedback } from '../utils.js';

// Page state
let radarState = {
    keyword: '',
    page: 1,
    hasMore: false,
    loading: false,
    results: []
};

let sortState = {
    column: '',
    direction: 'desc'
};

let lastSortTime = 0;
const SORT_THROTTLE_MS = 1000;

export function initRadarPage() {
    // Set current page for title
    setCurrentPage('radar');

    // Initialize all components
    initTheme();
    initLanguage();
    initDrawer();
    initFilters();
    initTable();

    // Setup event listeners
    setupEventListeners();

    // Update stats if available
    updateStats();

    // Check URL parameters for initial search
    checkUrlParams();

    console.log('Search page initialized');
}

function setupEventListeners() {
    // Theme toggle
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }

    // Language toggle
    const langBtn = document.getElementById('langToggle');
    if (langBtn) {
        langBtn.addEventListener('click', () => {
            toggleLanguage();
            // Re-render category pills with new language
            const filters = getActiveFilters();
            updateCategoryPills(filters.mode);
            // Re-render table if we have results
            if (radarState.results.length > 0) {
                renderTorrents(radarState.results, true);
            }
        });
    }

    // Desktop search button
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const input = document.getElementById('searchInput');
            if (input) {
                radarState.keyword = input.value.trim();
                executeRadar();
            }
        });
    }

    // Desktop search input (Enter key)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                radarState.keyword = searchInput.value.trim();
                executeRadar();
            }
        });
    }

    // Mobile search button
    const mobileSearchBtn = document.getElementById('mobileSearchBtn');
    if (mobileSearchBtn) {
        mobileSearchBtn.addEventListener('click', () => {
            const input = document.getElementById('mobileSearchInput');
            if (input) {
                radarState.keyword = input.value.trim();
                executeRadar();
            }
        });
    }

    // Mobile search input (Enter key)
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    if (mobileSearchInput) {
        mobileSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                radarState.keyword = mobileSearchInput.value.trim();
                executeRadar();
            }
        });
    }

    // Reset filters button
    const resetBtn = document.getElementById('resetFiltersBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            resetFilters();
            // Re-execute search if we have results
            if (radarState.results.length > 0) {
                executeRadar();
            }
        });
    }

    // Filter select changes
    document.querySelectorAll('.filter-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const filterType = e.target.id;

            // Update filter state based on select type (directly modify exported filterState)
            if (filterType === 'resolutionSelect') {
                filterState.resolution = e.target.value;
            } else if (filterType === 'videoSelect') {
                filterState.video = e.target.value;
            } else if (filterType === 'audioSelect') {
                filterState.audio = e.target.value;
            } else if (filterType === 'countrySelect') {
                filterState.country = e.target.value;
            } else if (filterType === 'discountSelect') {
                filterState.discount = e.target.value;
            }

            updateResetButtonState();

            // Re-execute search if we have results
            if (radarState.results.length > 0) {
                executeRadar();
            }
        });
    });

    // Load more button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMore);
    }

    // Infinite scroll
    window.addEventListener('scroll', debounce(() => {
        if (radarState.hasMore && !radarState.loading) {
            const scrollPosition = window.innerHeight + window.scrollY;
            const threshold = document.documentElement.scrollHeight - 500;

            if (scrollPosition >= threshold) {
                loadMore();
            }
        }
    }, 200));
}

export async function executeRadar() {
    if (radarState.loading) return;

    const filters = getActiveFilters();
    const keyword = radarState.keyword;

    // Validate search - require either keyword or any filter
    const hasAnyFilter =
        (filters.categories && filters.categories.length > 0) ||
        (filters.standards && filters.standards.length > 0) ||
        (filters.videoCodecs && filters.videoCodecs.length > 0) ||
        (filters.audioCodecs && filters.audioCodecs.length > 0) ||
        (filters.countries && filters.countries.length > 0) ||
        filters.discount;

    if (!keyword && !hasAnyFilter) {
        showToast(t('enter_keyword'));
        return;
    }

    // Reset to page 1
    radarState.page = 1;
    radarState.loading = true;

    // Show loading skeleton
    showLoadingSkeleton();

    // Hide load more button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.style.display = 'none';
    }

    try {
        const params = {
            keyword: keyword,
            mode: filters.mode,
            categories: filters.categories,
            standards: filters.standards,
            videoCodecs: filters.videoCodecs,
            audioCodecs: filters.audioCodecs,
            sources: filters.sources,
            countries: filters.countries,
            discount: filters.discount,
            sortField: 'CREATED_DATE',
            sortDirection: 'DESC',
            pageNumber: 1,
            pageSize: 50
        };

        const result = await searchTorrents(params);

        if (result.success) {
            radarState.results = result.data || [];
            const currentCount = (result.pageNumber || 1) * (result.pageSize || 50);
            radarState.hasMore = currentCount < (result.total || 0);

            // Sort results if column is selected
            if (sortState.column && radarState.results.length > 0) {
                radarState.results.sort((a, b) => {
                    let aVal, bVal;
                    switch (sortState.column) {
                        case 'name':
                            aVal = a.name || '';
                            bVal = b.name || '';
                            break;
                        case 'size':
                            aVal = a.size_num || a.size || 0;
                            bVal = b.size_num || b.size || 0;
                            break;
                        case 'seeders':
                            aVal = a.seeders || 0;
                            bVal = b.seeders || 0;
                            break;
                        case 'leechers':
                            aVal = a.leechers || 0;
                            bVal = b.leechers || 0;
                            break;
                        case 'category':
                            aVal = a.cat_id || a.category || 0;
                            bVal = b.cat_id || b.category || 0;
                            break;
                        case 'createdDate':
                            aVal = a.added_timestamp || (a.created_date ? new Date(a.created_date).getTime() / 1000 : 0);
                            bVal = b.added_timestamp || (b.created_date ? new Date(b.created_date).getTime() / 1000 : 0);
                            break;
                        default:
                            return 0;
                    }
                    if (typeof aVal === 'string') {
                        return sortState.direction === 'asc'
                            ? aVal.localeCompare(bVal)
                            : bVal.localeCompare(aVal);
                    }
                    return sortState.direction === 'asc' ? aVal - bVal : bVal - aVal;
                });
            }

            // Hide initial state, show table or empty state
            const initialState = document.getElementById('initialState');
            const emptyState = document.getElementById('emptyState');

            if (radarState.results.length > 0) {
                // Show results
                if (initialState) initialState.style.display = 'none';
                if (emptyState) emptyState.style.display = 'none';
                renderTorrents(radarState.results, true);
            } else {
                // Show empty state
                if (initialState) initialState.style.display = 'none';
                if (emptyState) emptyState.style.display = 'block';
                renderTorrents([], true);
            }

            // Show load more if needed
            if (radarState.hasMore && loadMoreBtn) {
                loadMoreBtn.style.display = 'block';
            }

            // Update result count
            const resultCount = document.getElementById('resultCount');
            if (resultCount) {
                const count = radarState.results.length;
                resultCount.textContent = t('search_results').replace('{count}', count);
            }

            // Close mobile drawer if open
            closeFilterDrawer();
        } else {
            showToast(result.error || t('searchFailed'));
            const initialState = document.getElementById('initialState');
            const emptyState = document.getElementById('emptyState');
            if (initialState) initialState.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            renderTorrents([], true);
        }
    } catch (error) {
        console.error('Search error:', error);
        showToast(t('searchFailed'));
        renderTorrents([], true);
    } finally {
        radarState.loading = false;
    }
}

export async function loadMore() {
    if (radarState.loading || !radarState.hasMore) return;

    const filters = getActiveFilters();
    radarState.page++;
    radarState.loading = true;

    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = t('loadingMore');
    }

    try {
        const params = {
            keyword: radarState.keyword,
            mode: filters.mode,
            categories: filters.categories,
            standards: filters.standards,
            videoCodecs: filters.videoCodecs,
            audioCodecs: filters.audioCodecs,
            sources: filters.sources,
            countries: filters.countries,
            discount: filters.discount,
            sortField: 'CREATED_DATE',
            sortDirection: 'DESC',
            pageNumber: radarState.page,
            pageSize: 50
        };

        const result = await searchTorrents(params);

        if (result.success) {
            const newTorrents = result.data || [];
            radarState.results = [...radarState.results, ...newTorrents];
            const currentCount = (result.pageNumber || radarState.page) * (result.pageSize || 50);
            radarState.hasMore = currentCount < (result.total || 0);

            // Append new items instead of re-rendering entire table
            appendTorrents(newTorrents, true);

            // Update result count
            const resultCount = document.getElementById('resultCount');
            if (resultCount) {
                const count = radarState.results.length;
                resultCount.textContent = t('search_results').replace('{count}', count);
            }

            if (!radarState.hasMore && loadMoreBtn) {
                loadMoreBtn.style.display = 'none';
            }
        } else {
            showToast(result.error || t('load_more_failed'));
            radarState.page--; // Revert page increment
        }
    } catch (error) {
        console.error('Load more error:', error);
        showToast(t('load_more_failed'));
        radarState.page--; // Revert page increment
    } finally {
        radarState.loading = false;
        if (loadMoreBtn) {
            loadMoreBtn.disabled = false;
            loadMoreBtn.textContent = t('loadMore');
        }
    }
}

function updateStats() {
    // This would be populated from backend if stats are available
    const statsContainer = document.getElementById('navStats');
    if (statsContainer) {
        // Stats will be rendered by the backend template
    }
}

function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const keyword = urlParams.get('keyword');

    if (keyword) {
        const searchInput = document.getElementById('searchInput');
        const mobileSearchInput = document.getElementById('mobileSearchInput');

        if (searchInput) searchInput.value = keyword;
        if (mobileSearchInput) mobileSearchInput.value = keyword;

        radarState.keyword = keyword;
        executeRadar();
    }
}

// Make drawer functions globally available for onclick handlers
window.openFilterDrawer = openFilterDrawer;
window.closeFilterDrawer = closeFilterDrawer;
window.applyDrawerFilters = () => {
    executeRadar();
    closeFilterDrawer();
};
window.resetDrawerFilters = () => {
    resetFilters();
    executeRadar();
};

// Make functions globally available
window.toggleTheme = toggleTheme;
window.toggleLanguage = toggleLanguage;

// Sort existing results locally and re-render (no API call)
function sortAndRenderResults() {
    if (sortState.column && radarState.results.length > 0) {
        radarState.results.sort((a, b) => {
            let aVal, bVal;
            switch (sortState.column) {
                case 'name':
                    aVal = a.name || '';
                    bVal = b.name || '';
                    break;
                case 'size':
                    aVal = a.size_num || a.size || 0;
                    bVal = b.size_num || b.size || 0;
                    break;
                case 'seeders':
                    aVal = a.seeders || 0;
                    bVal = b.seeders || 0;
                    break;
                case 'leechers':
                    aVal = a.leechers || 0;
                    bVal = b.leechers || 0;
                    break;
                case 'category':
                    aVal = a.cat_id || a.category || 0;
                    bVal = b.cat_id || b.category || 0;
                    break;
                case 'createdDate':
                    aVal = a.added_timestamp || (a.created_date ? new Date(a.created_date).getTime() / 1000 : 0);
                    bVal = b.added_timestamp || (b.created_date ? new Date(b.created_date).getTime() / 1000 : 0);
                    break;
                default:
                    return 0;
            }
            if (typeof aVal === 'string') {
                return sortState.direction === 'asc'
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            }
            return sortState.direction === 'asc' ? aVal - bVal : bVal - aVal;
        });
    }
    renderTorrents(radarState.results, true);
}

window.sortTable = (column) => {
    // Throttle check to prevent rapid API calls
    const now = Date.now();
    if (now - lastSortTime < SORT_THROTTLE_MS) {
        return; // Ignore rapid clicks
    }
    lastSortTime = now;

    // Special handling for peers column (cycles: seeders desc -> seeders asc -> leechers desc -> leechers asc)
    if (column === 'seeders') {
        if (sortState.column === 'seeders' && sortState.direction === 'desc') {
            sortState.direction = 'asc';
        } else if (sortState.column === 'seeders' && sortState.direction === 'asc') {
            sortState.column = 'leechers';
            sortState.direction = 'desc';
        } else if (sortState.column === 'leechers' && sortState.direction === 'desc') {
            sortState.direction = 'asc';
        } else if (sortState.column === 'leechers' && sortState.direction === 'asc') {
            sortState.column = 'seeders';
            sortState.direction = 'desc';
        } else {
            sortState.column = 'seeders';
            sortState.direction = 'desc';
        }
    } else {
        // Normal column handling
        if (sortState.column === column) {
            sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
            sortState.column = column;
            sortState.direction = 'desc';
        }
    }

    // Update sort icons
    document.querySelectorAll('[data-sort]').forEach(btn => {
        const icon = btn.querySelector('.sort-icon');
        if (icon) {
            // For peers column, check both seeders and leechers
            const btnColumn = btn.getAttribute('data-sort');
            if (btnColumn === 'seeders' && (sortState.column === 'seeders' || sortState.column === 'leechers')) {
                icon.textContent = sortState.direction === 'asc' ? '↑' : '↓';
                icon.style.opacity = '1';
            } else if (btnColumn === column) {
                icon.textContent = sortState.direction === 'asc' ? '↑' : '↓';
                icon.style.opacity = '1';
            } else {
                icon.textContent = '↕';
                icon.style.opacity = '0.3';
            }
        }
    });

    // If we have results, sort locally and re-render (NO API call)
    if (radarState.results.length > 0) {
        sortAndRenderResults();
    }
    // If no results, do nothing (user needs to search first)
};
