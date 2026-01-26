/**
 * Torrent Table Component
 * Displays MT-Engine torrents with filters and batch operations
 */

// State
const TorrentState = {
    torrents: [],
    selectedHashes: new Set(),
    filters: {
        tag: null,
        status: null
    },
    isLoading: false,
    autoRefreshInterval: 30000, // 30 seconds
    refreshTimer: null
};

// Initialize torrent table
async function initTorrentTable() {
    console.log('Initializing torrent table...');

    // Initial load
    await fetchTorrents();

    // Bind events
    bindFilterEvents();
    bindBatchActionEvents();

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

        // Keep selection for torrents that still exist
        const currentHashes = new Set(TorrentState.torrents.map(t => t.hash));
        TorrentState.selectedHashes = new Set(
            [...TorrentState.selectedHashes].filter(h => currentHashes.has(h))
        );

        if (TorrentState.torrents.length === 0) {
            showEmptyState();
        } else {
            renderTorrentTable();
        }

        updateTorrentCount(data.filtered_count);
        updateBatchActionsBar();

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
                    <th><input type="checkbox" id="select-all-torrents" class="torrent-checkbox"></th>
                    <th>标题</th>
                    <th>大小</th>
                    <th>进度</th>
                    <th>健康度</th>
                    <th>状态</th>
                    <th>标签</th>
                    <th>分享率</th>
                    <th>速度</th>
                    <th>添加时间</th>
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

    // Bind checkbox events
    bindTorrentCheckboxes();
}

// Render single torrent row
function renderTorrentRow(torrent) {
    const isSelected = TorrentState.selectedHashes.has(torrent.hash);
    const progress = Math.round(torrent.progress * 100);

    return `
        <tr data-hash="${torrent.hash}">
            <td>
                <input type="checkbox" class="torrent-checkbox"
                       data-hash="${torrent.hash}" ${isSelected ? 'checked' : ''}>
            </td>
            <td title="${escapeHtml(torrent.name)}">${escapeHtml(torrent.name)}</td>
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
}

// Render torrent card (mobile)
function renderTorrentCard(torrent) {
    const isSelected = TorrentState.selectedHashes.has(torrent.hash);
    const progress = Math.round(torrent.progress * 100);

    return `
        <div class="torrent-card" data-hash="${torrent.hash}">
            <div class="torrent-card-header">
                <input type="checkbox" class="torrent-checkbox"
                       data-hash="${torrent.hash}" ${isSelected ? 'checked' : ''}>
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

// Bind torrent checkbox events
function bindTorrentCheckboxes() {
    // Select all checkbox
    const selectAllCheckbox = document.getElementById('select-all-torrents');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                // Select all
                TorrentState.torrents.forEach(t => {
                    TorrentState.selectedHashes.add(t.hash);
                });
            } else {
                // Deselect all
                TorrentState.selectedHashes.clear();
            }
            updateCheckboxStates();
            updateBatchActionsBar();
        });
    }

    // Individual checkboxes
    const checkboxes = document.querySelectorAll('.torrent-checkbox[data-hash]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const hash = e.target.dataset.hash;
            if (e.target.checked) {
                TorrentState.selectedHashes.add(hash);
            } else {
                TorrentState.selectedHashes.delete(hash);
            }
            updateSelectAllCheckbox();
            updateBatchActionsBar();
        });
    });
}

// Update checkbox states
function updateCheckboxStates() {
    const checkboxes = document.querySelectorAll('.torrent-checkbox[data-hash]');
    checkboxes.forEach(checkbox => {
        const hash = checkbox.dataset.hash;
        checkbox.checked = TorrentState.selectedHashes.has(hash);
    });
}

// Update select-all checkbox
function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-torrents');
    if (!selectAllCheckbox) return;

    const totalCount = TorrentState.torrents.length;
    const selectedCount = TorrentState.selectedHashes.size;

    selectAllCheckbox.checked = totalCount > 0 && selectedCount === totalCount;
    selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalCount;
}

// Bind filter events
function bindFilterEvents() {
    // Tag filters
    const tagFilters = document.querySelectorAll('.filter-pill[data-tag]');
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
    const statusFilters = document.querySelectorAll('.filter-pill[data-status]');
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

// Bind batch action events
function bindBatchActionEvents() {
    // Pause button
    const pauseBtn = document.getElementById('batch-pause-btn');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', handleBatchPause);
    }

    // Resume button
    const resumeBtn = document.getElementById('batch-resume-btn');
    if (resumeBtn) {
        resumeBtn.addEventListener('click', handleBatchResume);
    }

    // Delete button
    const deleteBtn = document.getElementById('batch-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', handleBatchDelete);
    }

    // Clear selection button
    const clearBtn = document.getElementById('batch-clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            TorrentState.selectedHashes.clear();
            updateCheckboxStates();
            updateSelectAllCheckbox();
            updateBatchActionsBar();
        });
    }
}

// Update batch actions bar visibility
function updateBatchActionsBar() {
    const bar = document.getElementById('batch-actions-bar');
    const countEl = document.getElementById('batch-selected-count');

    if (!bar) return;

    const selectedCount = TorrentState.selectedHashes.size;

    if (selectedCount > 0) {
        bar.classList.add('visible');
        if (countEl) {
            countEl.textContent = `已选择 ${selectedCount} 个种子`;
        }
    } else {
        bar.classList.remove('visible');
    }
}

// Get selected torrent names
function getSelectedTorrentNames() {
    return TorrentState.torrents
        .filter(t => TorrentState.selectedHashes.has(t.hash))
        .map(t => t.name);
}

// Handle batch pause
async function handleBatchPause() {
    const hashes = Array.from(TorrentState.selectedHashes);
    if (hashes.length === 0) return;

    const names = getSelectedTorrentNames();

    // Show confirmation
    const result = await showConfirmModal({
        title: '确认暂停种子？',
        message: '暂停后可以随时恢复。',
        items: names,
        confirmText: '确认暂停',
        cancelText: '取消',
        isDanger: false
    });

    if (!result) return;

    // Call API
    try {
        const response = await fetch('/api/panel/torrents/pause', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hashes })
        });

        const data = await response.json();

        if (data.success) {
            showToast(`已暂停 ${data.paused_count} 个种子`, 'success');
        } else {
            showToast(`暂停失败: ${data.error || '未知错误'}`, 'error');
        }

        // Clear selection and refresh
        TorrentState.selectedHashes.clear();
        await fetchTorrents();

    } catch (error) {
        console.error('Batch pause failed:', error);
        showToast('暂停失败: 网络错误', 'error');
    }
}

// Handle batch resume
async function handleBatchResume() {
    const hashes = Array.from(TorrentState.selectedHashes);
    if (hashes.length === 0) return;

    const names = getSelectedTorrentNames();

    // Show confirmation
    const result = await showConfirmModal({
        title: '确认恢复种子？',
        items: names,
        confirmText: '确认恢复',
        cancelText: '取消',
        isDanger: false
    });

    if (!result) return;

    // Call API
    try {
        const response = await fetch('/api/panel/torrents/resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hashes })
        });

        const data = await response.json();

        if (data.success) {
            showToast(`已恢复 ${data.resumed_count} 个种子`, 'success');
        } else {
            showToast(`恢复失败: ${data.error || '未知错误'}`, 'error');
        }

        // Clear selection and refresh
        TorrentState.selectedHashes.clear();
        await fetchTorrents();

    } catch (error) {
        console.error('Batch resume failed:', error);
        showToast('恢复失败: 网络错误', 'error');
    }
}

// Handle batch delete
async function handleBatchDelete() {
    const hashes = Array.from(TorrentState.selectedHashes);
    if (hashes.length === 0) return;

    const names = getSelectedTorrentNames();

    // Show confirmation with delete files checkbox
    const result = await showConfirmModal({
        title: '⚠ 确认删除种子？',
        items: names,
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
            body: JSON.stringify({ hashes, delete_files: deleteFiles })
        });

        const data = await response.json();

        if (data.success) {
            showToast(`已删除 ${data.deleted_count} 个种子${deleteFiles ? '及文件' : ''}`, 'success');
        } else if (data.deleted_count > 0 && data.failed.length > 0) {
            showToast(`已删除 ${data.deleted_count}/${hashes.length} 个种子，${data.failed.length} 个失败`, 'warning');
        } else {
            showToast(`删除失败: ${data.error || '未知错误'}`, 'error');
        }

        // Clear selection and refresh
        TorrentState.selectedHashes.clear();
        await fetchTorrents();

    } catch (error) {
        console.error('Batch delete failed:', error);
        showToast('删除失败: 网络错误', 'error');
    }
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
    stop: stopTorrentAutoRefresh
};
