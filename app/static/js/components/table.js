/* ============================================================================
   MT-Engine - Table Component
   Table rendering, sorting, and expandable row functionality
   ============================================================================ */

import { formatSize, formatDate, escapeHtml } from '../utils.js';
import { t, translateCountry, currentLang } from '../i18n.js';
import { CONFIG, PARENT_CATEGORY_NAMES, CHILD_TO_PARENT } from '../config.js';
import { downloadTorrent } from './download.js';

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
            if (window.sortTable) {
                window.sortTable(column);
            }
        });
    });

    // Initialize event delegation on tbody
    const tbody = document.querySelector('.table-card tbody');
    if (tbody) {
        tbody.addEventListener('click', handleTableClick);
    }
}

function handleTableClick(e) {
    const target = e.target;
    
    // Handle Expand Toggle
    const expandBtn = target.closest('.expand-toggle');
    if (expandBtn) {
        e.stopPropagation();
        const row = expandBtn.closest('tr');
        toggleRowExpansion(row);
        return;
    }

    // Handle Download Button
    const downloadBtn = target.closest('.btn--download');
    if (downloadBtn) {
        e.stopPropagation();
        // Prevent double clicks or clicking disabled buttons
        if (downloadBtn.disabled || downloadBtn.hasAttribute('data-downloaded')) return;

        const row = downloadBtn.closest('tr');
        const torrentId = row.dataset.id;

        // Determine if we are on search page or seeder page based on URL
        // Search page is at root (/), Free Hunter page is at /seeder
        const isSearch = !window.location.pathname.includes('/seeder');

        // Call the download function
        downloadTorrent(torrentId, downloadBtn, isSearch);
        return;
    }
    
    // Handle Row Click (for expansion, excluding interactive elements)
    const row = target.closest('tr');
    if (row && !target.closest('a') && !target.closest('button')) {
        if (!row.classList.contains('detail-row')) {
            toggleRowExpansion(row);
        }
    }
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

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement('tbody'); // Use tbody as container to parse TRs correctly
    
    tempDiv.innerHTML = newTorrents.map(torrent =>
        createTorrentRow(torrent, isSearch)
    ).join('');

    while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
    }

    tbody.appendChild(fragment);
}

function createTorrentRow(torrent, isSearch) {
    // Normalize field names between seeder and search APIs
    const size = torrent.size_num || torrent.size || 0;
    const detailUrl = torrent.details_link || torrent.detail_url || '#';
    const categoryId = torrent.cat_id || (torrent.category ? parseInt(torrent.category, 10) : null);
    const addedDate = torrent.added || torrent.created_date;
    const addedTimestamp = torrent.added_timestamp || (torrent.created_date ? new Date(torrent.created_date).getTime() / 1000 : 0);

    // Columns 4 and 5 content based on page type
    let col4Content, col5Content;
    let col4Class = 'category-cell', col5Class = 'date-cell';
    let col4Sort = '', col5Sort = '';

    if (isSearch) {
        // Search Page: Category & Date
        col4Content = categoryId ? getCategoryLabel(categoryId) : '-';
        col5Content = formatDate(addedDate);
        col5Sort = `data-sort-value="${addedTimestamp}"`;
    } else {
        // Seeder Page: Remaining Time & Status
        col4Class = 'remaining-cell';
        col5Class = 'status-cell';
        
        // Remaining Time
        if (torrent.remaining && typeof torrent.remaining === 'object') {
            const displayTime = currentLang === 'zh' ? torrent.remaining.display : (torrent.remaining.display_en || torrent.remaining.display);
            const colorClass = torrent.remaining.color || 'safe'; // Default to safe if missing
            col4Content = `
                <span class="remaining-time status-${colorClass}">
                    <span class="status-dot ${colorClass}"></span>
                    <span class="remaining-display">${escapeHtml(displayTime)}</span>
                </span>
            `;
            col4Sort = `data-sort-value="${torrent.remaining.hours || 9999}"`;
        } else {
            col4Content = '-';
        }

        // Status Badge
        let statusText = t('statusNotDownloaded') || '未下载';
        let statusClass = 'badge-none';
        
        if (torrent.user_status === 'seeding') {
            statusText = t('statusSeeding') || '做种中';
            statusClass = 'badge-seeding';
        } else if (torrent.user_status === 'leeching') {
            statusText = t('statusLeeching') || '下载中';
            statusClass = 'badge-leeching';
        }
        
        col5Content = `<span class="badge ${statusClass}">${statusText}</span>`;
    }

    const mainRow = `
        <tr class="torrent-row" data-id="${torrent.id}"
            data-name="${escapeHtml(torrent.name)}"
            data-size="${size}"
            data-seeders="${torrent.seeders || 0}"
            data-leechers="${torrent.leechers || 0}"
            data-remaining="${torrent.remaining ? (torrent.remaining.hours || 0) : 0}"
            data-status="${torrent.user_status || 'none'}"
            data-mode="${torrent.mode || 'normal'}">
            <td class="name-cell">
                <div class="torrent-name">
                    <button class="expand-toggle" aria-label="${t('expand_details')}">▶</button>
                    <span class="torrent-link">${escapeHtml(torrent.name)}</span>
                </div>
                <div class="torrent-descr">${escapeHtml(torrent.small_descr || '')}</div>
                <div class="torrent-tags"></div>
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
                        <span class="value">${isSearch ? formatDate(addedDate) : (torrent.remaining && torrent.remaining.display ? escapeHtml(torrent.remaining.display) : '-')}</span>
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
            <td class="${col4Class}" ${col4Sort}>
                ${col4Content}
            </td>
            <td class="${col5Class}" ${col5Sort}>
                ${col5Content}
            </td>
            <td class="action-cell">
                <div class="actions-wrapper">
                    <button class="btn btn--download download-btn"
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
                </div>
            </td>
        </tr>
    `;

    const detailRow = createDetailRow(torrent, categoryId);

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

function createDetailRow(torrent, categoryId) {
    const pills = [];

    // Category pill
    if (categoryId) {
        const parentId = CHILD_TO_PARENT[categoryId] || categoryId;
        const catName = PARENT_CATEGORY_NAMES[parentId];
        if (catName) {
            const langKey = currentLang === 'zh' ? 'zh' : 'en';
            pills.push(`<span class="tag tag--meta">${escapeHtml(catName[langKey])}</span>`);
        }
    }

    // Discount pill
    const discountLabel = torrent.discount_label || torrent.discount;
    if (discountLabel) {
        const displayLabel = typeof discountLabel === 'object' ?
            (discountLabel[currentLang === 'zh' ? 'zh' : 'en'] || discountLabel.zh) :
            discountLabel;
        if (displayLabel && displayLabel !== '1.0X') {
            pills.push(`<span class="tag tag--discount">${escapeHtml(displayLabel)}</span>`);
        }
    }

    // Label pills (中字, HDR, DoVi, etc.)
    const labels = torrent.labels || (torrent.quality_metadata && torrent.quality_metadata.labels_new);
    if (labels && labels.length > 0) {
        labels.forEach(label => {
            pills.push(`<span class="tag tag--label">${escapeHtml(label)}</span>`);
        });
    }

    // Handle both quality and quality_metadata formats
    const quality = torrent.quality || torrent.quality_metadata || {};

    // Resolution/Standard
    const resolution = quality.standard || quality.resolution;
    if (resolution) {
        pills.push(`<span class="tag tag--tech">${escapeHtml(resolution)}</span>`);
    }

    // Video codec
    const videoCodec = quality.video_codec || quality.video;
    if (videoCodec) {
        pills.push(`<span class="tag tag--tech">${escapeHtml(videoCodec)}</span>`);
    }

    // Audio codec
    const audioCodec = quality.audio_codec || quality.audio;
    if (audioCodec) {
        pills.push(`<span class="tag tag--tech">${escapeHtml(audioCodec)}</span>`);
    }

    // Codec
    if (quality.codec) {
        pills.push(`<span class="tag tag--tech">${escapeHtml(quality.codec)}</span>`);
    }

    // Source
    if (quality.source) {
        pills.push(`<span class="tag tag--meta">${escapeHtml(quality.source)}</span>`);
    }

    // Country
    if (quality.country) {
        pills.push(`<span class="tag tag--meta">${escapeHtml(translateCountry(quality.country))}</span>`);
    }

    return `
        <tr class="detail-row" data-id="${torrent.id}">
            <td colspan="6">
                <div class="detail-content">
                    <div class="quality-tags-inline">
                        ${pills.join('')}
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

    // If expanding, first close all other expanded rows
    if (!isExpanded) {
        const tbody = row.closest('tbody');
        if (tbody) {
            tbody.querySelectorAll('tr.expanded').forEach(expandedRow => {
                const expandedDetailRow = expandedRow.nextElementSibling;
                const expandedToggle = expandedRow.querySelector('.expand-toggle');

                expandedRow.classList.remove('expanded');
                if (expandedDetailRow && expandedDetailRow.classList.contains('detail-row')) {
                    expandedDetailRow.classList.remove('expanded');
                }
                if (expandedToggle) {
                    expandedToggle.textContent = '▶';
                    expandedToggle.setAttribute('aria-label', t('expand_details'));
                }
            });
        }
    }

    // Toggle current row
    if (isExpanded) {
        row.classList.remove('expanded');
        detailRow.classList.remove('expanded');
        if (toggle) toggle.textContent = '▶';
        if (toggle) toggle.setAttribute('aria-label', t('expand_details'));
    } else {
        row.classList.add('expanded');
        detailRow.classList.add('expanded');
        if (toggle) toggle.textContent = '▼';
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
