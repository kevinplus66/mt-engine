/* ============================================================================
   MT-Engine - PILOT Page
   Pilot management page initialization and logic
   ============================================================================ */

import { initTheme, toggleTheme } from '../components/theme.js';
import { initLanguage, toggleLanguage } from '../components/language.js';
import { showToast } from '../components/toast.js';
import { t, setCurrentPage } from '../i18n.js';

// Get CSS variables for colors (Nothing OS design system)
const getColorVariables = () => {
    const styles = getComputedStyle(document.documentElement);
    return {
        success: styles.getPropertyValue('--status-safe').trim() || '#2ecc71',
        info: styles.getPropertyValue('--color-info').trim() || '#8E9AAF',
        muted: styles.getPropertyValue('--nt-text-tertiary').trim() || '#999999'
    };
};

// Page state
let currentConfig = null;
let currentStats = null;

export async function initPilotPage() {
    // Set current page for title
    setCurrentPage('pilot');

    // Initialize components
    initTheme();
    initLanguage();

    // Setup event listeners
    setupEventListeners();

    // Load initial data
    await loadStats();
    await loadConfig();

    // Auto-refresh stats every 60 seconds
    setInterval(() => {
        loadStats();
    }, 60000);

    console.log('Pilot page initialized');
}

function setupEventListeners() {
    // Action buttons
    const dryRunBtn = document.getElementById('dryRunBtn');
    const runDownloadBtn = document.getElementById('runDownloadBtn');
    const runCleanupBtn = document.getElementById('runCleanupBtn');
    const refreshStatsBtn = document.getElementById('refreshStatsBtn');

    if (dryRunBtn) dryRunBtn.addEventListener('click', runDryRun);
    if (runDownloadBtn) runDownloadBtn.addEventListener('click', triggerDownload);
    if (runCleanupBtn) runCleanupBtn.addEventListener('click', triggerCleanup);
    if (refreshStatsBtn) refreshStatsBtn.addEventListener('click', loadStats);

    // Toggle switches
    const downloadToggle = document.getElementById('downloadToggle');
    const cleanupToggle = document.getElementById('cleanupToggle');

    if (downloadToggle) {
        downloadToggle.addEventListener('change', async (e) => {
            if (currentConfig) {
                currentConfig.download.enabled = e.target.checked;
                await saveConfig();
            }
        });
    }

    if (cleanupToggle) {
        cleanupToggle.addEventListener('change', async (e) => {
            if (currentConfig) {
                currentConfig.cleanup.enabled = e.target.checked;
                await saveConfig();
            }
        });
    }

    // Save config button (explicit save, no auto-save)
    const saveConfigBtn = document.getElementById('saveConfigBtn');
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', saveConfigFromForm);
    }

    // Theme toggle
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }

    // Language toggle
    const langBtn = document.getElementById('langToggle');
    if (langBtn) {
        langBtn.addEventListener('click', toggleLanguage);
    }
}

// API Functions
async function fetchAPI(url, options = {}) {
    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API error:', error);
        throw error;
    }
}

async function loadConfig() {
    try {
        currentConfig = await fetchAPI('/api/pilot/config');
        renderConfigForm();
        updateToggles();
        console.log('Config loaded:', currentConfig);
    } catch (error) {
        console.error('Failed to load config:', error);
        showToast(t('autoConfigLoadFailed'));
    }
}

async function loadStats() {
    try {
        currentStats = await fetchAPI('/api/pilot/stats');
        renderStats();
    } catch (error) {
        console.error('Failed to load stats:', error);
        // Don't show toast for stats errors (happens frequently on first load)
    }
}

async function saveConfig() {
    try {
        const result = await fetchAPI('/api/pilot/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentConfig)
        });
        showToast(t('autoConfigSaved'));
        await loadStats(); // Refresh stats after config change
    } catch (error) {
        console.error('Failed to save config:', error);
        showToast(t('autoConfigSaveFailed'));
    }
}

async function saveConfigFromForm() {
    const form = document.getElementById('rulesForm');
    const formData = new FormData(form);

    // Update config object from form
    currentConfig.download.max_active_tasks = parseInt(formData.get('maxActiveTasks'));
    currentConfig.download.interval_seconds = parseInt(formData.get('intervalSeconds'));
    currentConfig.download.save_path = formData.get('savePath');
    currentConfig.download.disk_usage_threshold = parseInt(formData.get('diskThreshold'));

    // Rules
    currentConfig.download.rules.min_size_gb = parseFloat(formData.get('minSizeGb'));
    currentConfig.download.rules.max_size_gb = parseFloat(formData.get('maxSizeGb'));
    currentConfig.download.rules.max_seeders = parseInt(formData.get('maxSeeders'));
    currentConfig.download.rules.min_leechers = parseInt(formData.get('minLeechers'));
    currentConfig.download.rules.include_keywords = formData.get('includeKeywords')
        .split(',').map(s => s.trim()).filter(s => s);
    currentConfig.download.rules.exclude_keywords = formData.get('excludeKeywords')
        .split(',').map(s => s.trim()).filter(s => s);

    // Weights
    currentConfig.download.rules.weight_size = parseFloat(formData.get('weightSize'));
    currentConfig.download.rules.weight_free_time = parseFloat(formData.get('weightFreeTime'));
    currentConfig.download.rules.weight_age = parseFloat(formData.get('weightAge'));
    currentConfig.download.rules.weight_seeders = parseFloat(formData.get('weightSeeders'));

    // Cleanup
    currentConfig.cleanup.min_share_ratio = parseFloat(formData.get('minShareRatio'));
    currentConfig.cleanup.min_seed_time_hours = parseInt(formData.get('minSeedTimeHours'));
    currentConfig.cleanup.max_download_time_hours = parseInt(formData.get('maxDownloadTimeHours'));
    currentConfig.cleanup.dead_seed_minutes = parseInt(formData.get('deadSeedMinutes'));
    currentConfig.cleanup.dead_seed_max_ratio = parseFloat(formData.get('deadSeedMaxRatio'));
    currentConfig.cleanup.min_current_users = parseInt(formData.get('minCurrentUsers'));
    currentConfig.cleanup.min_upload_speed_kbps = parseInt(formData.get('minUploadSpeedKbps'));
    currentConfig.cleanup.elimination_ratio = parseInt(formData.get('eliminationRatio'));

    await saveConfig();
}

async function runDryRun() {
    const btn = document.getElementById('dryRunBtn');
    const resultsDiv = document.getElementById('dryRunResults');
    const contentDiv = document.getElementById('dryRunContent');

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = t('autoRunning');

    try {
        const result = await fetchAPI('/api/pilot/dry-run');

        // Render results using CSS classes instead of inline styles
        let html = '';

        // Download candidates
        if (result.download_candidates.length > 0) {
            html += `<p style="color: var(--nt-text-secondary); margin-bottom: 0.5rem;">${t('autoTopCandidates')} ${result.download_candidates.length} ${t('autoOfCandidates')} ${result.total_download_candidates}:</p>`;
            html += '<div style="max-height: 300px; overflow-y: auto; margin-bottom: 1.5rem;">';
            result.download_candidates.forEach(torrent => {
                html += `
                    <div class="dry-run-item">
                        <div style="font-weight: 500; color: var(--nt-text);">${escapeHtml(torrent.name)}</div>
                        <div style="font-size: 0.875rem; color: var(--nt-text-secondary);">
                            ${t('autoSize')}: ${torrent.size_gb} GB | ${t('autoScore')}: ${torrent.score} | ${escapeHtml(torrent.reason)}
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        } else {
            html += `<p style="color: var(--nt-text-secondary); margin-bottom: 1.5rem;">${t('autoNoCandidates')}</p>`;
        }

        // Cleanup candidates
        if (result.cleanup_candidates.length > 0) {
            html += `<p style="color: var(--nt-text-secondary); margin-bottom: 0.5rem;">${result.total_cleanup_candidates} ${t('autoCleanupCount')}</p>`;
            html += '<div style="max-height: 300px; overflow-y: auto;">';
            result.cleanup_candidates.forEach(torrent => {
                html += `
                    <div class="dry-run-item dry-run-item--cleanup">
                        <div style="font-weight: 500; color: var(--nt-text);">${escapeHtml(torrent.name)}</div>
                        <div style="font-size: 0.875rem; color: var(--nt-text-secondary);">
                            ${t('autoRatio')}: ${torrent.ratio} | ${escapeHtml(torrent.reason)}
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        } else {
            html += `<p style="color: var(--nt-text-secondary);">${t('autoNoCleanup')}</p>`;
        }

        contentDiv.innerHTML = html;
        resultsDiv.classList.remove('hidden');
        showToast(t('autoDryRunCompleted'));
    } catch (error) {
        console.error('Dry run failed:', error);
        showToast(t('autoDryRunFailed'));
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function triggerDownload() {
    const btn = document.getElementById('runDownloadBtn');
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = t('autoRunning');

    try {
        const result = await fetchAPI('/api/pilot/run-download', { method: 'POST' });
        showToast(t('autoDownloadTriggered'));
        await loadStats();
    } catch (error) {
        console.error('Download trigger failed:', error);
        showToast(t('autoDownloadTriggerFailed'));
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function triggerCleanup() {
    const btn = document.getElementById('runCleanupBtn');
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = t('autoRunning');

    try {
        const result = await fetchAPI('/api/pilot/run-cleanup', { method: 'POST' });
        showToast(t('autoCleanupTriggered'));
        await loadStats();
    } catch (error) {
        console.error('Cleanup trigger failed:', error);
        showToast(t('autoCleanupTriggerFailed'));
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

function renderStats() {
    if (!currentStats) return;

    const activeTasksEl = document.getElementById('activeTasks');
    const pendingDownloadsEl = document.getElementById('pendingDownloads');
    const downloadStatusEl = document.getElementById('downloadStatus');
    const cleanupStatusEl = document.getElementById('cleanupStatus');

    if (activeTasksEl) activeTasksEl.textContent = currentStats.active_tasks;
    if (pendingDownloadsEl) pendingDownloadsEl.textContent = currentStats.pending_downloads;

    // Get color variables from CSS
    const colors = getColorVariables();

    if (downloadStatusEl) {
        const enabled = currentStats.download_enabled;
        downloadStatusEl.textContent = enabled ? t('autoEnabled') : t('autoDisabled');
        downloadStatusEl.style.color = enabled ? colors.success : colors.muted;
    }

    if (cleanupStatusEl) {
        const enabled = currentStats.cleanup_enabled;
        cleanupStatusEl.textContent = enabled ? t('autoEnabled') : t('autoDisabled');
        cleanupStatusEl.style.color = enabled ? colors.success : colors.muted;
    }
}

function updateToggles() {
    if (!currentConfig) return;

    const downloadToggle = document.getElementById('downloadToggle');
    const cleanupToggle = document.getElementById('cleanupToggle');

    if (downloadToggle) downloadToggle.checked = currentConfig.download.enabled;
    if (cleanupToggle) cleanupToggle.checked = currentConfig.cleanup.enabled;
}

function renderConfigForm() {
    if (!currentConfig) return;

    const form = document.getElementById('rulesForm');
    if (!form) return;

    // Download policy
    form.maxActiveTasks.value = currentConfig.download.max_active_tasks;
    form.intervalSeconds.value = currentConfig.download.interval_seconds;
    form.savePath.value = currentConfig.download.save_path;
    form.diskThreshold.value = currentConfig.download.disk_usage_threshold;

    // Rules
    form.minSizeGb.value = currentConfig.download.rules.min_size_gb;
    form.maxSizeGb.value = currentConfig.download.rules.max_size_gb;
    form.maxSeeders.value = currentConfig.download.rules.max_seeders;
    form.minLeechers.value = currentConfig.download.rules.min_leechers;
    form.includeKeywords.value = currentConfig.download.rules.include_keywords.join(', ');
    form.excludeKeywords.value = currentConfig.download.rules.exclude_keywords.join(', ');

    // Weights
    form.weightSize.value = currentConfig.download.rules.weight_size;
    form.weightFreeTime.value = currentConfig.download.rules.weight_free_time;
    form.weightAge.value = currentConfig.download.rules.weight_age;
    form.weightSeeders.value = currentConfig.download.rules.weight_seeders;

    // Cleanup
    form.minShareRatio.value = currentConfig.cleanup.min_share_ratio;
    form.minSeedTimeHours.value = currentConfig.cleanup.min_seed_time_hours;
    form.maxDownloadTimeHours.value = currentConfig.cleanup.max_download_time_hours;
    form.deadSeedMinutes.value = currentConfig.cleanup.dead_seed_minutes;
    form.deadSeedMaxRatio.value = currentConfig.cleanup.dead_seed_max_ratio;
    form.minCurrentUsers.value = currentConfig.cleanup.min_current_users;
    form.minUploadSpeedKbps.value = currentConfig.cleanup.min_upload_speed_kbps;
    form.eliminationRatio.value = currentConfig.cleanup.elimination_ratio;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
