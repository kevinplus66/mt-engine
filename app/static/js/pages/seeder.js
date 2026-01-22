/* ============================================================================
   MT-Engine - Seeder Page (Free Hunter)
   Seeder page initialization and filtering logic
   ============================================================================ */

import { initTheme, toggleTheme } from '../components/theme.js';
import { initLanguage, toggleLanguage } from '../components/language.js';
import { showToast } from '../components/toast.js';
import { initDrawer, openFilterDrawer, closeFilterDrawer } from '../components/drawer.js';
import { refreshTorrents, toggleAutoDelete as apiToggleAutoDelete, getTorrents } from '../api.js';
import { initTable, renderTorrents } from '../components/table.js';
import { t, currentLang, setCurrentPage } from '../i18n.js';
import { hapticFeedback, debounce, throttle } from '../utils.js';
import { CONFIG } from '../config.js';

// Page state
let allTorrents = [];
let filterState = {
    size: 'all',
    seeder: 'all',
    remaining: 'all',
    status: 'all',
    mode: 'all',
    search: ''
};

let drawerState = {
    size: 'all',
    seeder: 'all',
    remaining: 'all',
    status: 'all',
    mode: 'all'
};

let sortState = {
    column: '',
    direction: 'desc'
};

let autoRefreshInterval = null;
const REFRESH_INTERVAL = 60000; // 1 minute

export function initSeederPage() {
    // Set current page for title
    setCurrentPage('seeder');

    // Initialize all components
    initTheme();
    initLanguage();
    initDrawer();
    initTable();

    // Load initial data
    try {
        const scriptTag = document.getElementById('initial-torrents');
        if (scriptTag) {
            allTorrents = JSON.parse(scriptTag.textContent);
        }
    } catch (e) {
        console.error('Failed to parse initial data:', e);
    }

    loadAutoDeleteStatus();
    loadFiltersFromLocalStorage();

    // Setup event listeners
    setupEventListeners();

    // Start auto-refresh
    startAutoRefresh();

    // Apply initial filters
    applyFilters();

    console.log('Seeder page initialized');
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
            // Re-apply filters to update UI text
            applyFilters();
        });
    }

    // Search input (desktop)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                filterState.search = searchInput.value;
                applyFilters();
            }
        });
        searchInput.addEventListener('input', debounce((e) => {
            filterState.search = e.target.value;
            applyFilters();
        }, 300));
    }

    // Search input (mobile)
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    if (mobileSearchInput) {
        mobileSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (searchInput) searchInput.value = mobileSearchInput.value;
                filterState.search = mobileSearchInput.value;
                applyFilters();
            }
        });
    }

    // Remaining time filter (dropdown)
    const remainingFilter = document.getElementById('remainingFilter');
    if (remainingFilter) {
        remainingFilter.addEventListener('change', (e) => {
            filterState.remaining = e.target.value;
            applyFilters();
        });
    }

    // Mode filter (dropdown)
    const modeFilter = document.getElementById('modeFilter');
    if (modeFilter) {
        modeFilter.addEventListener('change', (e) => {
            filterState.mode = e.target.value;
            applyFilters();
        });
    }

    // Status filter tabs (Level 1)
    document.querySelectorAll('.status-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.getAttribute('data-status');
            filterByStatus(status, btn);
        });
    });

    // Mobile status tabs
    document.querySelectorAll('.mobile-status-tabs .mobile-mode-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.getAttribute('data-status');
            // Update desktop tabs
            document.querySelectorAll('.status-tab').forEach(t => {
                t.classList.toggle('active', t.getAttribute('data-status') === status);
                t.setAttribute('aria-selected', t.getAttribute('data-status') === status);
            });
            // Update mobile tabs
            document.querySelectorAll('.mobile-status-tabs .mobile-mode-tab').forEach(t => {
                t.classList.toggle('active', t.getAttribute('data-status') === status);
            });
            filterState.status = status;
            applyFilters();
        });
    });

    // Size filter pills (Level 2)
    document.querySelectorAll('.size-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const value = pill.getAttribute('data-value');
            document.querySelectorAll('.size-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            filterState.size = value;
            applyFilters();
        });
    });

    // Seeder filter pills (Level 2)
    document.querySelectorAll('.seeder-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const value = pill.getAttribute('data-value');
            document.querySelectorAll('.seeder-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            filterState.seeder = value;
            applyFilters();
        });
    });

    // Reset button
    const resetBtn = document.getElementById('resetFiltersBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetAllFilters);
    }

    // Refresh buttons
    const refreshBtn = document.getElementById('refreshBtn');
    const manualRefreshBtn = document.getElementById('manualRefreshBtn');

    const handleRefresh = async (btn) => {
        if (!btn) return;
        const originalText = btn.innerHTML;
        btn.disabled = true;
        // Optional: btn.classList.add('loading');
        
        try {
            await refreshTorrents();
            const data = await getTorrents();
            if (data && data.torrents) {
                allTorrents = data.torrents;
                applyFilters();
                showToast(t('refreshSuccess') || '刷新成功');
            }
        } catch (e) {
            console.error('Refresh failed:', e);
            showToast(t('refreshError') || '刷新失败');
        } finally {
            btn.disabled = false;
        }
    };

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => handleRefresh(refreshBtn));
    }

    if (manualRefreshBtn) {
        manualRefreshBtn.addEventListener('click', () => handleRefresh(manualRefreshBtn));
    }

    // Drawer pills
    document.querySelectorAll('.drawer-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const group = pill.getAttribute('data-group');
            const value = pill.getAttribute('data-value');
            toggleDrawerPill(group, value, pill);
        });
    });

    // Auto-delete toggle
    const autoDeleteToggle = document.getElementById('autoDeleteToggle');
    if (autoDeleteToggle) {
        autoDeleteToggle.addEventListener('change', () => handleToggleAutoDelete('autoDeleteToggle'));
    }

    const drawerAutoDeleteToggle = document.getElementById('drawerAutoDeleteToggle');
    if (drawerAutoDeleteToggle) {
        drawerAutoDeleteToggle.addEventListener('change', () => handleToggleAutoDelete('drawerAutoDeleteToggle'));
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Skip if typing in input
        if (e.target.tagName === 'INPUT') {
            if (e.key === 'Escape') {
                e.target.blur();
            }
            return;
        }

        // Focus search with '/'
        if (e.key === '/') {
            e.preventDefault();
            const input = window.innerWidth > 768 ? searchInput : mobileSearchInput;
            if (input) input.focus();
        }

        // Toggle theme with 't'
        if (e.key === 't' || e.key === 'T') {
            e.preventDefault();
            toggleTheme();
        }

        // Clear filters with 'c'
        if (e.key === 'c' || e.key === 'C') {
            e.preventDefault();
            resetAllFilters();
        }

        // Close drawer with Escape
        if (e.key === 'Escape') {
            closeFilterDrawer();
        }
    });

    // Back to top button (throttled for performance)
    window.addEventListener('scroll', throttle(() => {
        const btn = document.getElementById('backToTop');
        if (btn) {
            if (window.scrollY > 300) {
                btn.classList.add('visible');
            } else {
                btn.classList.remove('visible');
            }
        }
    }, 100));
}

function filterByStatus(status, btn) {
    filterState.status = status;
    // Update desktop tabs
    document.querySelectorAll('.status-tab').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    // Sync mobile tabs
    document.querySelectorAll('.mobile-status-tabs .mobile-mode-tab').forEach(t => {
        t.classList.toggle('active', t.getAttribute('data-status') === status);
    });
    applyFilters();
}

function filterByMode(mode, btn) {
    filterState.mode = mode;
    document.querySelectorAll('.mode-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    applyFilters();
}

function applyFilters() {
    const searchTerm = filterState.search.toLowerCase();
    const GB = 1024 * 1024 * 1024;

    const filtered = allTorrents.filter(torrent => {
        const size = torrent.size || 0;
        const seeders = torrent.seeders || 0;
        // Handle remaining time safely
        const remaining = torrent.remaining ? (typeof torrent.remaining === 'object' ? (torrent.remaining.hours || 0) : parseFloat(torrent.remaining)) : 0;
        const name = (torrent.name || '').toLowerCase();
        const status = torrent.user_status || 'none';
        const mode = torrent.mode || 'normal';

        // Search filter
        if (searchTerm && !name.includes(searchTerm)) return false;

        // Status filter
        if (filterState.status !== 'all' && status !== filterState.status) return false;

        // Mode filter
        if (filterState.mode !== 'all' && mode !== filterState.mode) return false;

        // Size filter
        if (filterState.size !== 'all') {
            switch (filterState.size) {
                case 'small': if (size >= 10 * GB) return false; break;
                case 'medium': if (size < 10 * GB || size >= 50 * GB) return false; break;
                case 'large': if (size < 50 * GB || size >= 100 * GB) return false; break;
                case 'xlarge': if (size < 100 * GB) return false; break;
            }
        }

        // Seeder filter
        if (filterState.seeder !== 'all') {
            switch (filterState.seeder) {
                case 'hot': if (seeders <= 10) return false; break;
                case 'normal': if (seeders < 5 || seeders > 10) return false; break;
                case 'rare': if (seeders < 1 || seeders >= 5) return false; break;
                case 'dead': if (seeders !== 0) return false; break;
            }
        }

        // Remaining time filter
        if (filterState.remaining !== 'all') {
            switch (filterState.remaining) {
                case 'critical': if (remaining >= 1) return false; break;
                case 'danger': if (remaining < 1 || remaining >= 2) return false; break;
                case 'warning': if (remaining < 2 || remaining >= 6) return false; break;
                case 'safe': if (remaining < 6 || remaining >= 24) return false; break;
                case 'plenty': if (remaining < 24) return false; break;
            }
        }

        return true;
    });

    renderTorrents(filtered, false);

    // Update visible count
    const filteredCount = document.getElementById('filteredCount');
    if (filteredCount) {
        filteredCount.textContent = filtered.length;
    }
    
    // Update total count
    const totalCount = document.getElementById('totalCount');
    if (totalCount) {
        totalCount.textContent = allTorrents.length;
    }

    updateFilterIndicators();
    saveFiltersToLocalStorage();
}

function updateFilterIndicators() {
    const count = getActiveFilterCount();
    const badge = document.getElementById('filterCountBadge');
    const dot = document.querySelector('.filter-indicator');
    const btn = document.getElementById('filterToggleBtn');

    if (count > 0) {
        if (badge) {
            badge.textContent = `${count} ${t('filtersActive')}`;
            badge.classList.add('visible');
        }
        if (dot) dot.style.display = 'block';
        if (btn) btn.classList.add('has-filters');
    } else {
        if (badge) badge.classList.remove('visible');
        if (dot) dot.style.display = 'none';
        if (btn) btn.classList.remove('has-filters');
    }

    const resetBtn = document.getElementById('resetFiltersBtn');
    if (resetBtn) {
        resetBtn.disabled = count === 0;
    }
}

function getActiveFilterCount() {
    let count = 0;
    if (filterState.size !== 'all') count++;
    if (filterState.seeder !== 'all') count++;
    if (filterState.remaining !== 'all') count++;
    if (filterState.status !== 'all') count++;
    if (filterState.mode !== 'all') count++;
    if (filterState.search.trim() !== '') count++;
    return count;
}

function resetAllFilters() {
    filterState = {
        size: 'all',
        seeder: 'all',
        remaining: 'all',
        status: 'all',
        mode: 'all',
        search: ''
    };

    // Reset UI
    const remainingFilter = document.getElementById('remainingFilter');
    const modeFilter = document.getElementById('modeFilter');
    const searchInput = document.getElementById('searchInput');
    const mobileSearchInput = document.getElementById('mobileSearchInput');

    if (remainingFilter) remainingFilter.value = 'all';
    if (modeFilter) modeFilter.value = 'all';
    if (searchInput) searchInput.value = '';
    if (mobileSearchInput) mobileSearchInput.value = '';

    // Reset status tabs
    document.querySelectorAll('.status-tab').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-status') === 'all');
        b.setAttribute('aria-selected', b.getAttribute('data-status') === 'all');
    });

    // Reset mobile status tabs
    document.querySelectorAll('.mobile-status-tabs .mobile-mode-tab').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-status') === 'all');
    });

    // Reset size pills
    document.querySelectorAll('.size-pill').forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-value') === 'all');
    });

    // Reset seeder pills
    document.querySelectorAll('.seeder-pill').forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-value') === 'all');
    });

    // Reset drawer state
    drawerState = {
        size: 'all',
        seeder: 'all',
        remaining: 'all',
        status: 'all',
        mode: 'all'
    };

    document.querySelectorAll('.drawer-pill').forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-value') === 'all');
    });

    applyFilters();
}

function toggleDrawerPill(group, value, pill) {
    // Remove active from other pills in same group
    document.querySelectorAll(`.drawer-pill[data-group="${group}"]`).forEach(p => {
        p.classList.remove('active');
    });

    pill.classList.add('active');
    drawerState[group] = value;
}

function applyDrawerFiltersAndClose() {
    filterState.size = drawerState.size;
    filterState.seeder = drawerState.seeder;
    filterState.remaining = drawerState.remaining;
    filterState.status = drawerState.status;
    filterState.mode = drawerState.mode;

    // Sync mobile search to desktop
    const mobileSearch = document.getElementById('mobileSearchInput');
    const desktopSearch = document.getElementById('searchInput');
    if (mobileSearch && desktopSearch) {
        desktopSearch.value = mobileSearch.value;
        filterState.search = mobileSearch.value;
    }

    // Update desktop UI
    const remainingFilter = document.getElementById('remainingFilter');
    const modeFilter = document.getElementById('modeFilter');

    if (remainingFilter) remainingFilter.value = filterState.remaining;
    if (modeFilter) modeFilter.value = filterState.mode;

    // Update status tabs
    document.querySelectorAll('.status-tab').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-status') === filterState.status);
        b.setAttribute('aria-selected', b.getAttribute('data-status') === filterState.status);
    });

    // Update mobile status tabs
    document.querySelectorAll('.mobile-status-tabs .mobile-mode-tab').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-status') === filterState.status);
    });

    // Update size pills
    document.querySelectorAll('.size-pill').forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-value') === filterState.size);
    });

    // Update seeder pills
    document.querySelectorAll('.seeder-pill').forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-value') === filterState.seeder);
    });

    applyFilters();
    closeFilterDrawer();
}

function saveFiltersToLocalStorage() {
    try {
        localStorage.setItem('mt-free-hunter-filters', JSON.stringify(filterState));
    } catch (e) {
        console.error('Failed to save filters:', e);
    }
}

function loadFiltersFromLocalStorage() {
    try {
        const saved = localStorage.getItem('mt-free-hunter-filters');
        if (saved) {
            const savedFilters = JSON.parse(saved);
            filterState = { ...filterState, ...savedFilters };

            // Apply to UI
            const remainingFilter = document.getElementById('remainingFilter');
            const modeFilter = document.getElementById('modeFilter');
            const searchInput = document.getElementById('searchInput');
            const mobileSearchInput = document.getElementById('mobileSearchInput');

            if (remainingFilter) remainingFilter.value = filterState.remaining;
            if (modeFilter) modeFilter.value = filterState.mode;
            if (searchInput) searchInput.value = filterState.search;
            if (mobileSearchInput) mobileSearchInput.value = filterState.search;

            // Restore status tabs
            document.querySelectorAll('.status-tab').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-status') === filterState.status);
                b.setAttribute('aria-selected', b.getAttribute('data-status') === filterState.status);
            });

            // Restore mobile status tabs
            document.querySelectorAll('.mobile-status-tabs .mobile-mode-tab').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-status') === filterState.status);
            });

            // Restore size pills
            document.querySelectorAll('.size-pill').forEach(p => {
                p.classList.toggle('active', p.getAttribute('data-value') === filterState.size);
            });

            // Restore seeder pills
            document.querySelectorAll('.seeder-pill').forEach(p => {
                p.classList.toggle('active', p.getAttribute('data-value') === filterState.seeder);
            });

            // Sync drawer state
            drawerState = { ...filterState };
            document.querySelectorAll('.drawer-pill').forEach(p => {
                const group = p.getAttribute('data-group');
                const value = p.getAttribute('data-value');
                p.classList.toggle('active', drawerState[group] === value);
            });
        }
    } catch (e) {
        console.error('Failed to load filters:', e);
    }
}

async function loadAutoDeleteStatus() {
    try {
        const response = await fetch('/api/auto-delete/status');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();

        const desktopToggle = document.getElementById('autoDeleteToggle');
        const drawerToggle = document.getElementById('drawerAutoDeleteToggle');

        if (desktopToggle) {
            desktopToggle.checked = result.enabled || false;
            desktopToggle.disabled = !result.qbittorrent_configured;
        }
        if (drawerToggle) {
            drawerToggle.checked = result.enabled || false;
            drawerToggle.disabled = !result.qbittorrent_configured;
        }
    } catch (e) {
        console.error('Failed to load auto-delete status:', e);
    }
}

async function handleToggleAutoDelete(toggleId) {
    const toggle = document.getElementById(toggleId);
    if (!toggle) return;

    const originalState = !toggle.checked;
    hapticFeedback();

    try {
        const result = await apiToggleAutoDelete(toggle.checked);

        if (result.success) {
            // Update both toggles to keep them in sync
            const desktopToggle = document.getElementById('autoDeleteToggle');
            const drawerToggle = document.getElementById('drawerAutoDeleteToggle');

            if (desktopToggle) desktopToggle.checked = result.enabled;
            if (drawerToggle) drawerToggle.checked = result.enabled;

            showToast(result.enabled ? t('autoDeleteEnabled') : t('autoDeleteDisabled'));
        } else {
            toggle.checked = originalState;
            showToast(result.message || t('autoDeleteError'));
        }
    } catch (e) {
        toggle.checked = originalState;
        showToast(t('autoDeleteError'));
    }
}

export function startAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }

    autoRefreshInterval = setInterval(async () => {
        try {
            // Poll for latest data (silent refresh)
            const data = await getTorrents();
            if (data && data.torrents) {
                allTorrents = data.torrents;
                applyFilters();
            }
        } catch (e) {
            console.error('Auto refresh failed:', e);
        }
    }, REFRESH_INTERVAL);
}

export function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    hapticFeedback();
}

// Make functions globally available for onclick handlers
window.openFilterDrawer = openFilterDrawer;
window.closeFilterDrawer = closeFilterDrawer;
window.applyDrawerFilters = applyDrawerFiltersAndClose;
window.resetDrawerFilters = () => {
    resetAllFilters();
    closeFilterDrawer();
};
window.toggleTheme = toggleTheme;
window.toggleLanguage = toggleLanguage;
window.scrollToTop = scrollToTop;
window.sortTable = (column) => {
    // Sorting logic would go here
    console.log('Sort by:', column);
};
