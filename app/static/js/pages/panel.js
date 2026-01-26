/**
 * PANEL 页面主逻辑
 */

import { initTheme, toggleTheme } from '../components/theme.js';
import { initLanguage, toggleLanguage } from '../components/language.js';

// 页面状态
const PanelState = {
    currentRange: '24h',
    autoRefresh: true,
    refreshInterval: 300000, // 5分钟
    charts: {},
    lastUpdate: null
};

// 初始化页面
async function initPanel() {
    console.log('Initializing PANEL...');

    // 0. 初始化主题和语言
    initTheme();
    initLanguage();

    // 0.1. 绑定主题和语言切换按钮
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }

    const langBtn = document.getElementById('langToggle');
    if (langBtn) {
        langBtn.addEventListener('click', toggleLanguage);
    }

    // 1. 加载实时统计
    await loadRealtimeStats();

    // 2. 加载历史图表
    await loadHistoryCharts('24h');

    // 3. 初始化种子监控表格 (NEW)
    if (window.TorrentTable) {
        await window.TorrentTable.init();
    }

    // 4. 绑定事件
    bindRangeButtons();

    // 5. 启动自动刷新
    startAutoRefresh();

    console.log('PANEL initialized');
}

// 加载实时统计
async function loadRealtimeStats() {
    try {
        const response = await fetch('/api/panel/stats');
        const data = await response.json();

        console.log('Stats loaded:', data);

        // 更新卡片
        updateAllStatCards(data);

        // 更新存储空间卡片 (NEW)
        if (data.storage) {
            updateStorageCard(data.storage);
        }

        // 更新最后刷新时间
        updateLastUpdateTime(data.last_update);

        PanelState.lastUpdate = data.last_update;
    } catch (error) {
        console.error('Failed to load stats:', error);
        showToast('加载统计数据失败', 'error');
    }
}

// 更新存储空间卡片
function updateStorageCard(storage) {
    const card = document.getElementById('card-storage');
    if (!card) return;

    const valueEl = card.querySelector('.stat-value');
    const barEl = card.querySelector('.storage-bar');

    if (valueEl) {
        valueEl.textContent = `${storage.used_display} / ${storage.total_display}`;
    }

    if (barEl) {
        barEl.style.width = `${storage.percent}%`;

        // 根据使用率添加警告色
        barEl.classList.remove('warning', 'danger');
        if (storage.percent >= 90) {
            barEl.classList.add('danger');
        } else if (storage.percent >= 80) {
            barEl.classList.add('warning');
        }
    }

    // 空间不足警告
    if (storage.percent >= 90 && window.showToast) {
        showToast('⚠ 存储空间不足 10%，请及时清理', 'warning');
    }
}

// 加载历史图表
async function loadHistoryCharts(range) {
    try {
        console.log('Loading charts for range:', range);

        // 并行加载数据
        const [trafficData, ratioData] = await Promise.all([
            fetch(`/api/panel/history?range=${range}`).then(r => r.json()),
            fetch(`/api/panel/share-ratio?range=${range}`).then(r => r.json())
        ]);

        console.log('Chart data loaded');

        // 渲染图表
        renderTrafficChart(trafficData);
        renderShareRatioChart(ratioData);

        PanelState.currentRange = range;
    } catch (error) {
        console.error('Failed to load charts:', error);
        showToast('加载图表数据失败', 'error');
    }
}

// 渲染流量趋势图 (显示每个间隔的变化量，而非累计值)
function renderTrafficChart(data) {
    if (!data.data_points || data.data_points.length < 2) {
        showEmptyChart('traffic-chart', '暂无数据');
        return;
    }

    // Hide empty state and show canvas
    hideEmptyChart('traffic-chart');

    // 计算每个间隔的变化量 (delta)
    const timestamps = [];
    const qb_upload = [];
    const qb_download = [];
    const mt_upload = [];
    const mt_download = [];

    for (let i = 1; i < data.data_points.length; i++) {
        const prev = data.data_points[i - 1];
        const curr = data.data_points[i];

        timestamps.push(curr.timestamp);

        // 计算 qBittorrent 变化量 (处理重置情况，如重启后数值变小)
        const qbUpDelta = (curr.qbittorrent?.uploaded || 0) - (prev.qbittorrent?.uploaded || 0);
        const qbDownDelta = (curr.qbittorrent?.downloaded || 0) - (prev.qbittorrent?.downloaded || 0);
        qb_upload.push(Math.max(0, qbUpDelta));
        qb_download.push(Math.max(0, qbDownDelta));

        // 计算 M-Team 变化量
        const mtUpDelta = (curr.mteam?.uploaded || 0) - (prev.mteam?.uploaded || 0);
        const mtDownDelta = (curr.mteam?.downloaded || 0) - (prev.mteam?.downloaded || 0);
        mt_upload.push(Math.max(0, mtUpDelta));
        mt_download.push(Math.max(0, mtDownDelta));
    }

    const chartData = { timestamps, qb_upload, qb_download, mt_upload, mt_download };

    // 销毁旧图表
    if (PanelState.charts.traffic) {
        PanelState.charts.traffic.destroy();
    }

    // 创建新图表
    PanelState.charts.traffic = createTrafficChart('traffic-chart', chartData);

    // 创建数据集切换开关
    createChartToggles(PanelState.charts.traffic, 'traffic-chart-toggles');
}

// 渲染分享率图表
function renderShareRatioChart(data) {
    if (!data.data_points || data.data_points.length === 0) {
        showEmptyChart('ratio-chart', '暂无数据');
        return;
    }

    // Hide empty state and show canvas
    hideEmptyChart('ratio-chart');

    const chartData = {
        timestamps: data.data_points.map(p => p.timestamp),
        ratios: data.data_points.map(p => p.share_ratio),
        highest: data.highest,
        lowest: data.lowest
    };

    // 销毁旧图表
    if (PanelState.charts.ratio) {
        PanelState.charts.ratio.destroy();
    }

    // 创建新图表
    PanelState.charts.ratio = createShareRatioChart('ratio-chart', chartData);

    // 创建数据集切换开关
    createChartToggles(PanelState.charts.ratio, 'ratio-chart-toggles');
}

// 显示空图表
function showEmptyChart(canvasId, message) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Destroy existing chart
    const chartKey = canvasId.replace('-chart', '');
    if (PanelState.charts[chartKey]) {
        PanelState.charts[chartKey].destroy();
        PanelState.charts[chartKey] = null;
    }

    canvas.style.display = 'none';

    const container = canvas.parentElement;
    let emptyEl = container.querySelector('.empty-message');
    if (!emptyEl) {
        emptyEl = document.createElement('div');
        emptyEl.className = 'empty-message';
        container.appendChild(emptyEl);
    }
    emptyEl.textContent = message;
    emptyEl.style.display = 'flex';
}

// 隐藏空图表状态
function hideEmptyChart(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    canvas.style.display = 'block';

    const container = canvas.parentElement;
    const emptyEl = container.querySelector('.empty-message');
    if (emptyEl) {
        emptyEl.style.display = 'none';
    }
}

// 绑定时间范围按钮
function bindRangeButtons() {
    const buttons = document.querySelectorAll('.range-btn');

    buttons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const range = btn.dataset.range;

            // 更新按钮状态
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // 加载图表
            await loadHistoryCharts(range);
        });
    });
}

// 启动自动刷新
function startAutoRefresh() {
    setInterval(async () => {
        if (PanelState.autoRefresh) {
            console.log('Auto-refreshing...');
            await loadRealtimeStats();
            await loadHistoryCharts(PanelState.currentRange);
        }
    }, PanelState.refreshInterval);

    console.log('Auto-refresh started (5 min interval)');
}

// Toast 提示
function showToast(message, type = 'info') {
    console.log(`Toast (${type}): ${message}`);
    // TODO: 实现 toast 显示 (复用现有 toast 组件)
}

// 导出初始化函数
export { initPanel };
