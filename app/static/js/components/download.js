/* ============================================================================
   MT-Engine - Download Component
   Download button functionality and state management
   ============================================================================ */

import { downloadTorrent as apiDownloadTorrent } from '../api.js';
import { showToast } from './toast.js';
import { t } from '../i18n.js';
import { hapticFeedback } from '../utils.js';

export async function downloadTorrent(id, btn, isSearch = true) {
    if (!btn || btn.disabled) return;

    // Haptic feedback
    hapticFeedback();

    // Check if already downloaded
    if (btn.hasAttribute('data-downloaded')) {
        showToast(t('already_downloaded'));
        return;
    }

    // Set loading state
    btn.disabled = true;
    btn.classList.add('btn--loading');
    const icon = btn.querySelector('.btn-icon');
    const text = btn.querySelector('.btn-text');
    const originalIcon = icon ? icon.textContent : '';
    const originalText = text ? text.textContent : '';

    if (icon) icon.textContent = '⋯';
    if (text) text.textContent = t('downloading');

    try {
        const result = await apiDownloadTorrent(id, isSearch);

        if (result.success) {
            markAsDownloaded(btn);
            showToast(result.message || t('downloadSuccess'));
        } else {
            // Restore button state on failure
            btn.disabled = false;
            btn.classList.remove('btn--loading');
            if (icon) icon.textContent = originalIcon;
            if (text) text.textContent = originalText;
            showToast(result.error || t('downloadFailed'));
        }
    } catch (error) {
        console.error('Download error:', error);
        btn.disabled = false;
        btn.classList.remove('btn--loading');
        if (icon) icon.textContent = originalIcon;
        if (text) text.textContent = originalText;
        showToast(t('download_failed'));
    }
}

export function markAsDownloaded(btn) {
    if (!btn) return;

    btn.disabled = false;
    btn.classList.remove('btn--loading');
    btn.classList.add('btn--downloaded');
    btn.setAttribute('data-downloaded', 'true');

    const icon = btn.querySelector('.btn-icon');
    const text = btn.querySelector('.btn-text');

    if (icon) icon.textContent = '✓';
    if (text) text.textContent = t('downloaded');
}

export function resetDownloadButton(btn) {
    if (!btn) return;

    btn.disabled = false;
    btn.classList.remove('btn--loading', 'btn--downloaded');
    btn.removeAttribute('data-downloaded');

    const icon = btn.querySelector('.btn-icon');
    const text = btn.querySelector('.btn-text');

    if (icon) icon.textContent = '↓';
    if (text) text.textContent = t('download');
}

// Make functions globally available for onclick handlers
window.downloadTorrent = downloadTorrent;
