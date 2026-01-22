/* ============================================================================
   MT-Engine - Utility Functions
   Helper functions for common operations
   ============================================================================ */

import { t } from './i18n.js';

// ============ Debounce ============
export function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

// ============ Throttle ============
export function throttle(fn, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ============ Format File Size ============
export function formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============ Format Date ============
export function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return t('today');
    if (days === 1) return t('yesterday');
    if (days < 7) return `${days} ${t('daysAgo')}`;
    if (days < 30) return `${Math.floor(days / 7)} ${t('weeksAgo')}`;
    if (days < 365) return `${Math.floor(days / 30)} ${t('monthsAgo')}`;
    return `${Math.floor(days / 365)} ${t('yearsAgo')}`;
}

// ============ Format Date (Full) ============
export function formatDateFull(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// ============ Escape HTML ============
export function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// ============ Haptic Feedback ============
export function hapticFeedback(duration = 30) {
    if ('vibrate' in navigator) {
        navigator.vibrate(duration);
    }
}

// ============ Scroll to Top ============
export function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// ============ Get Query Parameter ============
export function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// ============ Set Query Parameter ============
export function setQueryParam(param, value) {
    const url = new URL(window.location);
    if (value) {
        url.searchParams.set(param, value);
    } else {
        url.searchParams.delete(param);
    }
    window.history.replaceState({}, '', url);
}

// ============ Parse JSON Safely ============
export function parseJSON(str, defaultValue = null) {
    try {
        return JSON.parse(str);
    } catch (e) {
        console.error('JSON parse error:', e);
        return defaultValue;
    }
}

// ============ Wait (Promise-based delay) ============
export function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ Copy to Clipboard ============
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Failed to copy:', err);
        return false;
    }
}

// ============ Get Element by ID (with error handling) ============
export function getElementById(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with id "${id}" not found`);
    }
    return element;
}

// ============ Query Selector (with error handling) ============
export function querySelector(selector) {
    const element = document.querySelector(selector);
    if (!element) {
        console.warn(`Element with selector "${selector}" not found`);
    }
    return element;
}

// ============ Query Selector All ============
export function querySelectorAll(selector) {
    return document.querySelectorAll(selector);
}

// ============ Add Event Listener (with cleanup) ============
export function addEventListener(element, event, handler, options) {
    if (!element) return null;
    element.addEventListener(event, handler, options);
    return () => element.removeEventListener(event, handler, options);
}

// ============ Truncate String ============
export function truncate(str, maxLength) {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
}

// ============ Is Mobile Device ============
export function isMobile() {
    return window.innerWidth <= 768;
}

// ============ Is Touch Device ============
export function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
