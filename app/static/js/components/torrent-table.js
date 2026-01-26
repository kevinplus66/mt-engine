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
