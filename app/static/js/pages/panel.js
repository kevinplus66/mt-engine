/**
 * PANEL 页面主逻辑
 */

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

    // 1. 加载实时统计
    await loadRealtimeStats();

    // 2. 加载历史图表
    await loadHistoryCharts('24h');

    // 3. 绑定事件
    bindRangeButtons();

    // 4. 启动自动刷新
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

        // 更新最后刷新时间
        updateLastUpdateTime(data.last_update);

        PanelState.lastUpdate = data.last_update;
    } catch (error) {
        console.error('Failed to load stats:', error);
        showToast('加载统计数据失败', 'error');
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
        renderDailyBarChart(trafficData);
        renderShareRatioChart(ratioData);

        PanelState.currentRange = range;
    } catch (error) {
        console.error('Failed to load charts:', error);
        showToast('加载图表数据失败', 'error');
    }
}

// 渲染流量趋势图
function renderTrafficChart(data) {
    if (!data.data_points || data.data_points.length === 0) {
        showEmptyChart('traffic-chart', '暂无数据');
        return;
    }

    // 准备数据
    const chartData = {
        timestamps: data.data_points.map(p => p.timestamp),
        qb_upload: data.data_points.map(p => p.qbittorrent?.uploaded || 0),
        qb_download: data.data_points.map(p => p.qbittorrent?.downloaded || 0),
        mt_upload: data.data_points.map(p => p.mteam?.uploaded || 0),
        mt_download: data.data_points.map(p => p.mteam?.downloaded || 0)
    };

    // 销毁旧图表
    if (PanelState.charts.traffic) {
        PanelState.charts.traffic.destroy();
    }

    // 创建新图表
    PanelState.charts.traffic = createTrafficChart('traffic-chart', chartData);
}

// 渲染每日柱状图
function renderDailyBarChart(data) {
    if (!data.data_points || data.data_points.length === 0) {
        showEmptyChart('daily-chart', '暂无数据');
        return;
    }

    // 按天分组计算每日总量
    const dailyData = calculateDailyTotals(data.data_points);

    if (dailyData.dates.length === 0) {
        showEmptyChart('daily-chart', '暂无数据');
        return;
    }

    // 销毁旧图表
    if (PanelState.charts.daily) {
        PanelState.charts.daily.destroy();
    }

    // 创建新图表
    PanelState.charts.daily = createDailyBarChart('daily-chart', dailyData);
}

// 渲染分享率图表
function renderShareRatioChart(data) {
    if (!data.data_points || data.data_points.length === 0) {
        showEmptyChart('ratio-chart', '暂无数据');
        return;
    }

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
}

// 计算每日总量
function calculateDailyTotals(dataPoints) {
    const dailyMap = {};

    dataPoints.forEach(point => {
        // 转换为北京时间日期
        const date = new Date(point.timestamp * 1000);
        const beijingDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
        const dateKey = `${beijingDate.getFullYear()}-${String(beijingDate.getMonth() + 1).padStart(2, '0')}-${String(beijingDate.getDate()).padStart(2, '0')}`;

        if (!dailyMap[dateKey]) {
            dailyMap[dateKey] = {
                mt_upload_max: 0,
                mt_download_max: 0
            };
        }

        // 使用最大值 (因为是累计量)
        dailyMap[dateKey].mt_upload_max = Math.max(
            dailyMap[dateKey].mt_upload_max,
            point.mteam?.uploaded || 0
        );
        dailyMap[dateKey].mt_download_max = Math.max(
            dailyMap[dateKey].mt_download_max,
            point.mteam?.downloaded || 0
        );
    });

    // 计算每日增量
    const sortedDates = Object.keys(dailyMap).sort();
    const dates = [];
    const mt_upload = [];
    const mt_download = [];

    let prevUpload = 0;
    let prevDownload = 0;

    sortedDates.forEach(date => {
        const currentUpload = dailyMap[date].mt_upload_max;
        const currentDownload = dailyMap[date].mt_download_max;

        dates.push(date);
        mt_upload.push(Math.max(0, currentUpload - prevUpload));
        mt_download.push(Math.max(0, currentDownload - prevDownload));

        prevUpload = currentUpload;
        prevDownload = currentDownload;
    });

    return { dates, mt_upload, mt_download };
}

// 显示空图表
function showEmptyChart(canvasId, message) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const container = canvas.parentElement;
    container.classList.add('chart-empty');
    canvas.style.display = 'none';

    let emptyEl = container.querySelector('.empty-message');
    if (!emptyEl) {
        emptyEl = document.createElement('div');
        emptyEl.className = 'empty-message';
        container.appendChild(emptyEl);
    }
    emptyEl.textContent = message;
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

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPanel);
} else {
    initPanel();
}
