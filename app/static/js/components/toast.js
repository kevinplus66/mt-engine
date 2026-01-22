/* ============================================================================
   MT-Engine - Toast Component
   Toast notification display functionality
   ============================================================================ */

import { CONFIG } from '../config.js';

let toastTimeout = null;

export function showToast(message, duration = CONFIG.TOAST_DURATION) {
    const toast = document.getElementById('toast');
    if (!toast) {
        console.warn('Toast element not found');
        return;
    }

    // Clear any existing timeout
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    // Set message and show toast
    toast.textContent = message;
    toast.classList.add('active');

    // Hide after duration
    toastTimeout = setTimeout(() => {
        toast.classList.remove('active');
    }, duration);
}

export function hideToast() {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.classList.remove('active');
    }
    if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
    }
}
