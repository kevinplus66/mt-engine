/**
 * Torrent Table Component
 * Displays MT-Engine torrents with expandable rows and actions
 */

// State
const TorrentState = {
    torrents: [],
    filters: {
        tag: null,
        status: null
    },
    sort: {
        column: 'added_on',
        direction: 'desc'
    },
    isLoading: false,
    autoRefreshInterval: 30000, // 30 seconds
    refreshTimer: null
};

// Sort torrents array
function sortTorrentsArray() {
    const { column, direction } = TorrentState.sort;

    TorrentState.torrents.sort((a, b) => {
        let valA, valB;
        switch (column) {
            case 'name': valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); break;
            case 'size': valA = a.size; valB = b.size; break;
            case 'progress': valA = a.progress; valB = b.progress; break;
            case 'health': valA = a.health.score; valB = b.health.score; break;
            case 'ratio': valA = parseFloat(a.ratio) || 0; valB = parseFloat(b.ratio) || 0; break;
            case 'speed': valA = a.upload_speed + a.download_speed; valB = b.upload_speed + b.download_speed; break;
            case 'added_on': valA = a.added_on; valB = b.added_on; break;
            default: return 0;
        }

        if (typeof valA === 'string') {
            return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return direction === 'asc' ? valA - valB : valB - valA;
    });
}

// Handle sort (called from panel.js)
function handleSort(column, direction) {
    TorrentState.sort.column = column;
    TorrentState.sort.direction = direction;
    sortTorrentsArray();
    renderTorrentTable();
}

// Initialize torrent table
async function initTorrentTable() {
    console.log('Initializing torrent table...');

    // Initial load
    await fetchTorrents();

    // Bind events
    bindFilterEvents();

    // Start auto-refresh
    startTorrentAutoRefresh();

    console.log('Torrent table initialized');
}

// Fetch torrents from API
async function fetchTorrents() {
    if (TorrentState.isLoading) return;

    TorrentState.isLoading = true;
    showLoadingState();

    try {
        const params = new URLSearchParams();
        if (TorrentState.filters.tag) {
            params.append('tag', TorrentState.filters.tag);
        }
        if (TorrentState.filters.status) {
            params.append('status', TorrentState.filters.status);
        }

        const response = await fetch(`/api/panel/torrents?${params}`);
        const data = await response.json();

        if (data.error) {
            showErrorState(data.error);
            return;
        }

        TorrentState.torrents = data.torrents || [];

        // Apply current sort
        sortTorrentsArray();

        if (TorrentState.torrents.length === 0) {
            showEmptyState();
        } else {
            renderTorrentTable();
        }

        updateTorrentCount(data.filtered_count);

    } catch (error) {
        console.error('Failed to fetch torrents:', error);
        showErrorState('网络错误，请稍后重试');
    } finally {
        TorrentState.isLoading = false;
    }
}

// Start auto-refresh
function startTorrentAutoRefresh() {
    if (TorrentState.refreshTimer) {
        clearInterval(TorrentState.refreshTimer);
    }

    TorrentState.refreshTimer = setInterval(() => {
        console.log('Auto-refreshing torrents...');
        fetchTorrents();
    }, TorrentState.autoRefreshInterval);

    console.log('Torrent auto-refresh started (30s interval)');
}

// Stop auto-refresh
function stopTorrentAutoRefresh() {
    if (TorrentState.refreshTimer) {
        clearInterval(TorrentState.refreshTimer);
        TorrentState.refreshTimer = null;
    }
}

// Render torrent table (desktop)
function renderTorrentTable() {
    const container = document.getElementById('torrent-table-container');
    if (!container) return;

    // Desktop table
    const tableHtml = `
        <table class="torrent-table">
            <thead>
                <tr>
                    <th data-sort="name">标题 <span class="sort-icon">↕</span></th>
                    <th data-sort="size">大小 <span class="sort-icon">↕</span></th>
                    <th data-sort="progress">进度 <span class="sort-icon">↕</span></th>
                    <th data-sort="health">健康度 <span class="sort-icon">↕</span></th>
                    <th>状态</th>
                    <th>标签</th>
                    <th data-sort="ratio">分享率 <span class="sort-icon">↕</span></th>
                    <th data-sort="speed">速度 <span class="sort-icon">↕</span></th>
                    <th data-sort="added_on">添加时间 <span class="sort-icon">↕</span></th>
                </tr>
            </thead>
            <tbody>
                ${TorrentState.torrents.map(t => renderTorrentRow(t)).join('')}
            </tbody>
        </table>
    `;

    // Mobile cards
    const cardsHtml = `
        <div class="torrent-cards">
            ${TorrentState.torrents.map(t => renderTorrentCard(t)).join('')}
        </div>
    `;

    container.innerHTML = `
        <div class="torrent-table-container">
            ${tableHtml}
        </div>
        ${cardsHtml}
    `;

    // Bind event delegation
    bindTableEvents();
}

// Render single torrent row
function renderTorrentRow(torrent) {
    const progress = Math.round(torrent.progress * 100);

    const mainRow = `
        <tr class="torrent-row" data-hash="${torrent.hash}">
            <td>
                <div class="torrent-name">
                    <button class="expand-toggle" aria-label="展开详情">▶</button>
                    <span class="torrent-link" title="${escapeHtml(torrent.name)}">${escapeHtml(torrent.name)}</span>
                </div>
            </td>
            <td>${torrent.size_display}</td>
            <td>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                <div class="progress-text">${progress}%</div>
            </td>
            <td>
                <div class="health-status">
                    <span class="health-dot ${torrent.health.status}"></span>
                    <span>${torrent.health.score}%</span>
                </div>
                ${torrent.health.reason ? `<div style="font-size: 10px; color: var(--nt-text-tertiary);">${torrent.health.reason}</div>` : ''}
            </td>
            <td>${formatStatus(torrent.status)}</td>
            <td>${torrent.tags.map(t => `<span class="tag-pill">${t}</span>`).join(' ')}</td>
            <td>${torrent.ratio}</td>
            <td>
                <div class="speed-display">
                    <div class="speed-up">↑ ${formatSpeed(torrent.upload_speed)}</div>
                    <div class="speed-down">↓ ${formatSpeed(torrent.download_speed)}</div>
                </div>
            </td>
            <td>${formatRelativeTime(torrent.added_on)}</td>
        </tr>
    `;

    const detailRow = renderDetailRow(torrent);

    return mainRow + detailRow;
}

// Render detail row with actions
function renderDetailRow(torrent) {
    // Build metadata display
    const metadata = [];

    metadata.push(`上传: ${formatSize(torrent.uploaded)}`);
    metadata.push(`下载: ${formatSize(torrent.downloaded)}`);

    if (torrent.eta && torrent.eta < 8640000) {
        const hours = Math.floor(torrent.eta / 3600);
        const minutes = Math.floor((torrent.eta % 3600) / 60);
        if (hours > 0) {
            metadata.push(`剩余时间: ${hours}小时${minutes}分钟`);
        } else {
            metadata.push(`剩余时间: ${minutes}分钟`);
        }
    }

    return `
        <tr class="detail-row" data-hash="${torrent.hash}">
            <td colspan="9">
                <div class="detail-content">
                    <div class="detail-info">
                        ${metadata.map(m => `<div style="font-size: 12px;">${m}</div>`).join('')}
                    </div>
                    <div class="detail-actions">
                        ${torrent.mteam_id ? `
                            <a href="https://kp.m-team.cc/detail/${torrent.mteam_id}"
                               target="_blank"
                               rel="noopener noreferrer"
                               class="btn"
                               title="在M-Team查看">
                                <span class="btn-text">打开MT</span>
                            </a>
                        ` : ''}
                        <button class="btn btn--delete" data-hash="${torrent.hash}">
                            <span class="btn-text">删除</span>
                        </button>
                    </div>
                </div>
            </td>
        </tr>
    `;
}

// Render torrent card (mobile)
function renderTorrentCard(torrent) {
    const progress = Math.round(torrent.progress * 100);

    return `
        <div class="torrent-card" data-hash="${torrent.hash}">
            <div class="torrent-card-header">
                <div class="torrent-card-name">${escapeHtml(torrent.name)}</div>
                <span class="torrent-card-tag">${torrent.tags[0] || ''}</span>
            </div>
            <div class="torrent-card-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                <div class="progress-text">${progress}%</div>
            </div>
            <div class="torrent-card-stats">
                <span>${torrent.size_display}</span>
                <span>·</span>
                <span>分享率 ${torrent.ratio}</span>
                <span>·</span>
                <span class="speed-up">↑ ${formatSpeed(torrent.upload_speed)}</span>
                <span class="speed-down">↓ ${formatSpeed(torrent.download_speed)}</span>
            </div>
            <div class="torrent-card-stats">
                <div class="health-status">
                    <span class="health-dot ${torrent.health.status}"></span>
                    <span>${torrent.health.status === 'healthy' ? '健康' : torrent.health.reason} ${torrent.health.score}%</span>
                </div>
            </div>
            <div class="torrent-card-footer">
                <span>${formatRelativeTime(torrent.added_on)}</span>
                <span>${formatStatus(torrent.status)}</span>
            </div>
        </div>
    `;
}

// Bind table event delegation
function bindTableEvents() {
    const tbody = document.querySelector('.torrent-table tbody');
    if (!tbody) return;

    tbody.addEventListener('click', handleTableClick);
}

// Handle table click events
function handleTableClick(e) {
    const target = e.target;

    // Handle expand toggle
    const expandBtn = target.closest('.expand-toggle');
    if (expandBtn) {
        e.stopPropagation();
        const row = expandBtn.closest('tr');
        toggleRowExpansion(row);
        return;
    }

    // Handle delete button
    const deleteBtn = target.closest('.btn--delete');
    if (deleteBtn) {
        e.stopPropagation();
        const hash = deleteBtn.dataset.hash;
        handleDelete(hash);
        return;
    }

    // Handle row click for expansion
    const row = target.closest('tr');
    if (row && !target.closest('a') && !target.closest('button')) {
        if (!row.classList.contains('detail-row')) {
            toggleRowExpansion(row);
        }
    }
}

// Toggle row expansion (accordion behavior)
function toggleRowExpansion(row) {
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
                    expandedToggle.setAttribute('aria-label', '展开详情');
                }
            });
        }
    }

    // Toggle current row
    if (isExpanded) {
        row.classList.remove('expanded');
        detailRow.classList.remove('expanded');
        if (toggle) toggle.textContent = '▶';
        if (toggle) toggle.setAttribute('aria-label', '展开详情');
    } else {
        row.classList.add('expanded');
        detailRow.classList.add('expanded');
        if (toggle) toggle.textContent = '▼';
        if (toggle) toggle.setAttribute('aria-label', '收起详情');
    }
}

// Handle delete action
async function handleDelete(hash) {
    const torrent = TorrentState.torrents.find(t => t.hash === hash);
    if (!torrent) return;

    // Show confirmation
    const result = await showConfirmModal({
        title: '⚠ 确认删除种子？',
        items: [torrent.name],
        confirmText: '确认删除',
        cancelText: '取消',
        isDanger: true,
        showWarning: true,
        warningText: '警告：此操作无法撤销！',
        showCheckbox: true,
        checkboxLabel: '同时删除文件 (推荐)',
        checkboxDefault: true
    });

    if (!result) return;

    const deleteFiles = result.checkboxValue !== undefined ? result.checkboxValue : true;

    // Call API
    try {
        const response = await fetch('/api/panel/torrents/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hashes: [hash], delete_files: deleteFiles })
        });

        const data = await response.json();

        if (data.success) {
            showToast(`已删除种子${deleteFiles ? '及文件' : ''}`, 'success');
            await fetchTorrents();
        } else {
            showToast(`删除失败: ${data.error || '未知错误'}`, 'error');
        }
    } catch (error) {
        console.error('Delete failed:', error);
        showToast('删除失败: 网络错误', 'error');
    }
}

// Helper: Format status
function formatStatus(status) {
    const statusMap = {
        'downloading': '下载中',
        'stalledDL': '等待中',
        'uploading': '做种中',
        'stalledUP': '做种中',
        'pausedDL': '已暂停',
        'pausedUP': '已暂停',
        'queuedDL': '队列中',
        'queuedUP': '队列中',
        'checkingDL': '校验中',
        'checkingUP': '校验中',
        'error': '错误',
        'missingFiles': '文件缺失'
    };
    return statusMap[status] || status;
}

// Helper: Format speed
function formatSpeed(bytesPerSec) {
    if (bytesPerSec === 0) return '0 KB/s';
    if (bytesPerSec < 1024) return `${bytesPerSec} B/s`;
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`;
}

// Helper: Format size
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    if (bytes < 1024 * 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    return `${(bytes / 1024 / 1024 / 1024 / 1024).toFixed(2)} TB`;
}

// Helper: Format relative time
function formatRelativeTime(timestamp) {
    const now = Date.now() / 1000;
    const diff = now - timestamp;

    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;

    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('zh-CN');
}

// Helper: Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show loading state
function showLoadingState() {
    const container = document.getElementById('torrent-table-container');
    if (!container) return;

    container.innerHTML = `
        <div class="torrent-state-message">
            <h3>加载中...</h3>
            <p>正在获取种子列表</p>
        </div>
    `;
}

// Show empty state
function showEmptyState() {
    const container = document.getElementById('torrent-table-container');
    if (!container) return;

    const filterActive = TorrentState.filters.tag || TorrentState.filters.status;

    container.innerHTML = `
        <div class="torrent-state-message">
            <h3>暂无种子</h3>
            <p>${filterActive ?
                '当前筛选条件下没有种子<br>尝试更改筛选条件' :
                '使用 SONAR / RADAR / PILOT 下载种子后<br>将在此处显示'
            }</p>
        </div>
    `;
}

// Show error state
function showErrorState(message) {
    const container = document.getElementById('torrent-table-container');
    if (!container) return;

    container.innerHTML = `
        <div class="torrent-state-message">
            <h3>⚠ ${escapeHtml(message)}</h3>
            <button class="retry-btn" onclick="window.torrentTableRetry()">重试</button>
        </div>
    `;
}

// Retry handler
window.torrentTableRetry = function() {
    fetchTorrents();
};

// Update torrent count display
function updateTorrentCount(count) {
    const countEl = document.getElementById('torrent-count');
    if (countEl) {
        countEl.textContent = `显示 ${count} 个种子`;
    }
}

// Bind filter events
function bindFilterEvents() {
    // Tag filters
    const tagFilters = document.querySelectorAll('.cat-pill[data-tag]');
    tagFilters.forEach(pill => {
        pill.addEventListener('click', () => {
            const tag = pill.dataset.tag;

            // Toggle active state
            if (TorrentState.filters.tag === tag) {
                TorrentState.filters.tag = null;
                pill.classList.remove('active');
            } else {
                // Remove active from all
                tagFilters.forEach(p => p.classList.remove('active'));
                // Set new active
                TorrentState.filters.tag = tag === 'all' ? null : tag;
                if (tag !== 'all') {
                    pill.classList.add('active');
                }
            }

            // Refresh torrents
            fetchTorrents();
        });
    });

    // Status filters
    const statusFilters = document.querySelectorAll('.cat-pill[data-status]');
    statusFilters.forEach(pill => {
        pill.addEventListener('click', () => {
            const status = pill.dataset.status;

            // Toggle active state
            if (TorrentState.filters.status === status) {
                TorrentState.filters.status = null;
                pill.classList.remove('active');
            } else {
                // Remove active from all
                statusFilters.forEach(p => p.classList.remove('active'));
                // Set new active
                TorrentState.filters.status = status === 'all' ? null : status;
                if (status !== 'all') {
                    pill.classList.add('active');
                }
            }

            // Refresh torrents
            fetchTorrents();
        });
    });
}

// Toast helper
function showToast(message, type = 'info') {
    // Reuse existing toast component if available
    if (window.showToast) {
        window.showToast(message, type);
    } else {
        console.log(`Toast (${type}): ${message}`);
        alert(message);
    }
}

// Export functions for use in panel.js
window.TorrentTable = {
    init: initTorrentTable,
    refresh: fetchTorrents,
    stop: stopTorrentAutoRefresh,
    handleSort: handleSort,
    getSort: () => TorrentState.sort
};
