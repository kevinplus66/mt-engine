/* ============================================================================
   MT-Engine - Drawer Component
   Mobile filter drawer functionality
   ============================================================================ */

import { hapticFeedback } from '../utils.js';

export function initDrawer() {
    // Initialize drawer event listeners
    const overlay = document.getElementById('drawerOverlay');
    if (overlay) {
        overlay.addEventListener('click', closeFilterDrawer);
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
