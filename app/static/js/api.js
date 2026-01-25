/* ============================================================================
   MT-Engine - API Client
   Functions for making API calls to the backend
   ============================================================================ */

import { CONFIG } from './config.js';

// ============ Search Torrents ============
export async function searchTorrents(params) {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/radar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Search API error:', error);
        throw error;
    }
}

// ============ Download Torrent ============
export async function downloadTorrent(torrentId, isSearchPage = true) {
    try {
        const endpoint = isSearchPage ? '/radar/download' : '/download';
        const response = await fetch(`${CONFIG.API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: torrentId })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Download API error:', error);
        throw error;
    }
}

// ============ Get Filter Options ============
export async function getFilterOptions() {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/filter-options`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Filter options API error:', error);
        throw error;
    }
}

// ============ Get Categories ============
export async function getCategories() {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/categories`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Categories API error:', error);
        throw error;
    }
}

// ============ Refresh Torrents (Sonar Page) ============
export async function refreshTorrents() {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/refresh`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Refresh API error:', error);
        throw error;
    }
}

// ============ Toggle Auto Delete ============
export async function toggleAutoDelete(enable) {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/auto-delete/toggle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ enable })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Toggle auto-delete API error:', error);
        throw error;
    }
}

// ============ Get Auto Delete Status ============
export async function getAutoDeleteStatus() {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/auto-delete/status`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Auto-delete status API error:', error);
        throw error;
    }
}

// ============ Get Torrents (Free Hunter Page) ============
export async function getTorrents(filters = {}) {
    try {
        const queryParams = new URLSearchParams(filters).toString();
        const response = await fetch(`${CONFIG.API_BASE}/torrents?${queryParams}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Get torrents API error:', error);
        throw error;
    }
}

// ============ Health Check ============
export async function healthCheck() {
    try {
        const response = await fetch('/health');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Health check error:', error);
        throw error;
    }
}
