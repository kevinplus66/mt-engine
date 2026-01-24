/* ============================================================================
   MT-Engine - Drawer Component
   Mobile filter drawer functionality
   ============================================================================ */

import { hapticFeedback } from '../utils.js';

export function initDrawer() {
    // Initialize drawer event listeners
    const overlay = document.getElementById('drawerOverlay');
    const filterToggleBtn = document.getElementById('filterToggleBtn');
    const drawerClose = document.querySelector('.drawer-close');
    const drawerApplyBtn = document.querySelector('.drawer-apply-btn');
    const drawerResetBtn = document.querySelector('.drawer-reset-btn');

    if (overlay) {
        overlay.addEventListener('click', closeFilterDrawer);
    }

    // Open drawer button
    if (filterToggleBtn) {
        filterToggleBtn.addEventListener('click', openFilterDrawer);
    }

    // Close drawer button
    if (drawerClose) {
        drawerClose.addEventListener('click', closeFilterDrawer);
    }

    // Apply filters button
    if (drawerApplyBtn) {
        drawerApplyBtn.addEventListener('click', () => {
            if (window.applyDrawerFilters) {
                window.applyDrawerFilters();
            }
            closeFilterDrawer();
        });
    }

    // Reset filters button
    if (drawerResetBtn) {
        drawerResetBtn.addEventListener('click', () => {
            if (window.resetDrawerFilters) {
                window.resetDrawerFilters();
            }
        });
    }
}

export function openFilterDrawer() {
    hapticFeedback();
    const drawer = document.getElementById('filterDrawer');
    const overlay = document.getElementById('drawerOverlay');

    if (drawer && overlay) {
        drawer.classList.add('active');
        overlay.classList.add('active');
        document.body.classList.add('drawer-open');
    }
}

export function closeFilterDrawer() {
    hapticFeedback();
    const drawer = document.getElementById('filterDrawer');
    const overlay = document.getElementById('drawerOverlay');

    if (drawer && overlay) {
        drawer.classList.remove('active');
        overlay.classList.remove('active');
        document.body.classList.remove('drawer-open');
    }
}

export function applyDrawerFilters() {
    // This will be implemented by the page-specific logic
    closeFilterDrawer();
}

export function resetDrawerFilters() {
    // This will be implemented by the page-specific logic
}

// Make functions globally available for onclick handlers
window.openFilterDrawer = openFilterDrawer;
window.closeFilterDrawer = closeFilterDrawer;
window.applyDrawerFilters = applyDrawerFilters;
window.resetDrawerFilters = resetDrawerFilters;
