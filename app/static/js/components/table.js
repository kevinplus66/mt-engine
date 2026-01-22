/* ============================================================================
   MT-Engine - Table Component
   Table rendering, sorting, and expandable row functionality
   ============================================================================ */

import { formatSize, formatDate, escapeHtml } from '../utils.js';
import { t, translateCountry, currentLang } from '../i18n.js';
import { CONFIG, PARENT_CATEGORY_NAMES, CHILD_TO_PARENT } from '../config.js';

// Table state
let currentSort = {
    column: '',
    direction: 'desc'
};

let touchStartX = 0;
let touchStartY = 0;

export function initTable() {
    // Initialize sort buttons
    document.querySelectorAll('[data-sort]').forEach(btn => {
        btn.addEventListener('click', () => {
            const column = btn.getAttribute('data-sort');
            sortTable(column);
        });
    });

    // Initialize mobile swipe for expandable rows
    initMobileSwipe();
}

export function sortTable(column) {
    if (currentSort.column === column) {
        // Toggle direction
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'desc';
    }

    // Update UI - sort icons
    document.querySelectorAll('[data-sort]').forEach(btn => {
        const btnColumn = btn.getAttribute('data-sort');
        const icon = btn.querySelector('.sort-icon');
        if (icon) {
            if (btnColumn === column) {
                icon.textContent = currentSort.direction === 'asc' ? '↑' : '↓';
                icon.style.opacity = '1';
            } else {
                icon.textContent = '↕';
                icon.style.opacity = '0.3';
            }
        }
    });

    // Trigger re-sort (this will be called by page-specific logic)
    return { column, direction: currentSort.direction };
}

export function renderTorrents(torrents, isSearch = true) {
    const tbody = document.querySelector('.table-card tbody');
    if (!tbody) {
        console.warn('Table tbody not found');
        return;
    }

    if (!torrents || torrents.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem;">
                    ${t('emptyState')}
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = torrents.map(torrent =>
        createTorrentRow(torrent, isSearch)
    ).join('');

    // Attach event listeners
    attachRowEventListeners(tbody);
}

// Append new torrents without re-rendering entire table (for pagination/loadMore)
export function appendTorrents(newTorrents, isSearch = true) {
    const tbody = document.querySelector('.table-card tbody');
    if (!tbody) {
        console.warn('Table tbody not found');
        return;
    }

    if (!newTorrents || newTorrents.length === 0) {
        return;
    }

    // Create temporary container
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newTorrents.map(torrent =>
        createTorrentRow(torrent, isSearch)
    ).join('');

    // Append new rows
    while (tempDiv.firstChild) {
        tbody.appendChild(tempDiv.firstChild);
    }

    // Attach event listeners to new rows only
    const newRows = Array.from(tbody.children).slice(-newTorrents.length);
    newRows.forEach(row => {
        const expandBtn = row.querySelector('.expand-toggle');
        if (expandBtn) {
            expandBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleRowExpansion(row);
            });
        }
    });
}

// Helper function to attach event listeners
function attachRowEventListeners(container) {
    container.querySelectorAll('.expand-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const row = btn.closest('tr');
            toggleRowExpansion(row);
        });
    });
}

function createTorrentRow(torrent, isSearch) {
    // Normalize field names between seeder and search APIs
    const size = torrent.size_num || torrent.size || 0;
    const detailUrl = torrent.details_link || torrent.detail_url || '#';
    const categoryId = torrent.cat_id || (torrent.category ? parseInt(torrent.category, 10) : null);
    const addedDate = torrent.added || torrent.created_date;
    const addedTimestamp = torrent.added_timestamp || (torrent.created_date ? new Date(torrent.created_date).getTime() / 1000 : 0);

    const mainRow = `
        <tr class="torrent-row" data-id="${torrent.id}">
            <td class="name-cell">
                <div class="torrent-name">
                    <button class="expand-toggle" aria-label="${t('expand_details')}">▼</button>
                    <span class="torrent-link">${escapeHtml(torrent.name)}</span>
                </div>
                <div class="torrent-descr">${escapeHtml(torrent.small_descr || '')}</div>
                <div class="torrent-tags">
                    ${createTorrentTags(torrent, categoryId)}
                </div>
                <div class="mobile-meta-zone">
                    <div class="mobile-meta-item">
                        <span class="value">${torrent.size_display || formatSize(size)}</span>
                    </div>
                    <div class="mobile-meta-item peer-display">
                        <span class="seeders">${torrent.seeders || 0}</span>
                        <span class="peer-sep">/</span>
                        <span class="leechers">${torrent.leechers || 0}</span>
                    </div>
                    <div class="mobile-meta-item">
                        <span class="value">${formatDate(addedDate)}</span>
                    </div>
                </div>
            </td>
            <td class="size-cell" data-sort-value="${size}">
                ${torrent.size_display || formatSize(size)}
            </td>
            <td class="peer-cell">
                <div class="peer-info">
                    <span class="seeders">${torrent.seeders || 0}</span>
                    <span class="peer-sep">/</span>
                    <span class="leechers">${torrent.leechers || 0}</span>
                </div>
            </td>
            <td class="category-cell">
                ${categoryId ? getCategoryLabel(categoryId) : '-'}
            </td>
            <td class="date-cell" data-sort-value="${addedTimestamp}">
                ${formatDate(addedDate)}
            </td>
            <td class="action-cell">
                <button class="btn btn--download" onclick="downloadTorrent(${torrent.id}, this, ${isSearch})"
                    ${torrent.downloaded || torrent.user_status === 'seeding' || torrent.user_status === 'leeching' ? 'data-downloaded="true"' : ''}>
                    <span class="btn-icon">${torrent.downloaded || torrent.user_status === 'seeding' || torrent.user_status === 'leeching' ? '✓' : '↓'}</span>
                    <span class="btn-text">${torrent.downloaded || torrent.user_status === 'seeding' || torrent.user_status === 'leeching' ? t('downloaded') : t('download')}</span>
                </button>
                <a href="${escapeHtml(detailUrl)}" target="_blank" rel="noopener noreferrer" class="detail-link" title="${t('view_details')}">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3h-2v2H4V4h2V2z"/>
                        <path d="M9 2v2h2.59L6.29 9.29l1.41 1.41L13 5.41V8h2V2H9z"/>
                    </svg>
                </a>
            </td>
        </tr>
    `;

    const detailRow = createDetailRow(torrent);

    return mainRow + detailRow;
}

function getCategoryLabel(catId) {
    // Convert to number if string
    const categoryId = typeof catId === 'string' ? parseInt(catId, 10) : catId;
    // Use CHILD_TO_PARENT mapping, fallback to checking if it's a parent category itself
    const parentId = CHILD_TO_PARENT[categoryId] || categoryId;
    const catName = PARENT_CATEGORY_NAMES[parentId];
    if (catName) {
        const langKey = currentLang === 'zh' ? 'zh' : 'en';
        return escapeHtml(catName[langKey]);
    }
    return '-';
}

function createTorrentTags(torrent, categoryId) {
    const tags = [];

    // Category tag
    if (categoryId) {
        const parentId = CHILD_TO_PARENT[categoryId] || categoryId;
        const catName = PARENT_CATEGORY_NAMES[parentId];
        if (catName) {
            const langKey = currentLang === 'zh' ? 'zh' : 'en';
            tags.push(`<span class="tag tag--meta">${catName[langKey]}</span>`);
        }
    }

    // Discount tag - handle both formats
    const discountLabel = torrent.discount_label || torrent.discount;
    if (discountLabel) {
        const displayLabel = typeof discountLabel === 'object' ?
            (discountLabel[currentLang === 'zh' ? 'zh' : 'en'] || discountLabel.zh) :
            discountLabel;
        if (displayLabel && displayLabel !== '1.0X') {
            tags.push(`<span class="tag tag--discount">${escapeHtml(displayLabel)}</span>`);
        }
    }

    // Label tags - handle both formats
    const labels = torrent.labels || (torrent.quality_metadata && torrent.quality_metadata.labels_new);
    if (labels && labels.length > 0) {
        labels.forEach(label => {
            tags.push(`<span class="tag tag--label">${escapeHtml(label)}</span>`);
        });
    }

    return tags.join('');
}

function createDetailRow(torrent) {
    // Handle both quality and quality_metadata formats
    const quality = torrent.quality || torrent.quality_metadata || {};

    return `
        <tr class="detail-row" data-id="${torrent.id}">
            <td colspan="6">
                <div class="detail-content">
                    <div class="quality-tags-inline">
                        ${createQualityTag('视频', quality.video_codec || quality.video, 'tech')}
                        ${createQualityTag('音频', quality.audio_codec || quality.audio, 'tech')}
                        ${createQualityTag('编码', quality.codec, 'tech')}
                        ${createQualityTag('分辨率', quality.standard || quality.resolution, 'tech')}
                        ${createQualityTag('来源', quality.source, 'meta')}
                        ${createQualityTag('国家', quality.country ? translateCountry(quality.country) : null, 'meta')}
                    </div>
                    ${torrent.num_files ? `
                        <div class="file-info" style="margin-top: 8px; font-size: 12px;">
                            <strong>${t('files')}:</strong> ${torrent.num_files}
                        </div>
                    ` : ''}
                </div>
            </td>
        </tr>
    `;
}

function createQualityTag(label, value, type) {
    if (!value) return '';

    return `
        <div class="quality-tag-group">
            <span class="quality-tag-label">${label}</span>
            <span class="tag tag--${type}">${escapeHtml(value)}</span>
        </div>
    `;
}

// Deprecated: Keep for backward compatibility
function createQualityBox(label, value, type) {
    if (!value) return '';

    const tagClass = type === 'video' || type === 'audio' || type === 'codec' || type === 'resolution' ? 'tech' : 'meta';

    return `
        <div class="viz-box">
            <div class="viz-label">${label}</div>
            <div class="viz-value">
                <span class="tag tag--${tagClass}">${escapeHtml(value)}</span>
            </div>
        </div>
    `;
}

export function toggleRowExpansion(row) {
    const detailRow = row.nextElementSibling;
    const toggle = row.querySelector('.expand-toggle');

    if (!detailRow || !detailRow.classList.contains('detail-row')) return;

    const isExpanded = row.classList.contains('expanded');

    if (isExpanded) {
        row.classList.remove('expanded');
        detailRow.classList.remove('expanded');
        if (toggle) toggle.textContent = '▼';
        if (toggle) toggle.setAttribute('aria-label', t('expand_details'));
    } else {
        row.classList.add('expanded');
        detailRow.classList.add('expanded');
        if (toggle) toggle.textContent = '▲';
        if (toggle) toggle.setAttribute('aria-label', t('collapse_details'));
    }
}

function initMobileSwipe() {
    const tbody = document.querySelector('.table-card tbody');
    if (!tbody) return;

    tbody.addEventListener('touchstart', (e) => {
        const row = e.target.closest('.torrent-row');
        if (!row) return;

        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    tbody.addEventListener('touchend', (e) => {
        const row = e.target.closest('.torrent-row');
        if (!row) return;

        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;

        // Only trigger if horizontal swipe is dominant
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            toggleRowExpansion(row);
        }
    }, { passive: true });
}

export function showLoadingSkeleton(rowCount = 5) {
    const tbody = document.querySelector('.table-card tbody');
    if (!tbody) return;

    const skeletonRows = Array(rowCount).fill(null).map(() => `
        <tr class="skeleton-row">
            <td><div class="skeleton skeleton--text"></div></td>
            <td><div class="skeleton skeleton--text"></div></td>
            <td><div class="skeleton skeleton--text"></div></td>
            <td><div class="skeleton skeleton--text"></div></td>
            <td><div class="skeleton skeleton--text"></div></td>
            <td><div class="skeleton skeleton--button"></div></td>
        </tr>
    `).join('');

    tbody.innerHTML = skeletonRows;
}

export function getCurrentSort() {
    return currentSort;
}

export function resetSort() {
    currentSort = {
        column: '',
        direction: 'desc'
    };

    // Reset UI
    document.querySelectorAll('[data-sort]').forEach(btn => {
        const icon = btn.querySelector('.sort-icon');
        if (icon) {
            icon.textContent = '↕';
            icon.style.opacity = '0.3';
        }
    });
}
