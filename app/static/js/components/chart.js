/**
 * Chart.js 图表组件 - Nothing OS 风格
 */

// 获取 Nothing OS 图表配置
function getNothingOSChartOptions(yAxisCallback = null) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    font: {
                        family: 'DotGothic16, sans-serif',
                        size: 11
                    },
                    color: getComputedStyle(document.documentElement)
                        .getPropertyValue('--nt-text-primary').trim(),
                    boxWidth: 20,
                    boxHeight: 2,
                    padding: 15
                }
            },
            tooltip: {
                backgroundColor: getComputedStyle(document.documentElement)
                    .getPropertyValue('--nt-bg-secondary').trim(),
                titleColor: getComputedStyle(document.documentElement)
                    .getPropertyValue('--nt-text-primary').trim(),
                bodyColor: getComputedStyle(document.documentElement)
                    .getPropertyValue('--nt-text-secondary').trim(),
                borderColor: getComputedStyle(document.documentElement)
                    .getPropertyValue('--nt-border').trim(),
                borderWidth: 1,
                cornerRadius: 0,
                padding: 12,
                displayColors: true,
                callbacks: {
                    label: (context) => {
                        const label = context.dataset.label || '';
                        const value = formatSize(context.parsed.y);
                        return `${label}: ${value}`;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    borderDash: [2, 2],
                    color: getComputedStyle(document.documentElement)
                        .getPropertyValue('--nt-border-light').trim()
                },
                ticks: {
                    font: {
                        family: 'Roboto Mono, monospace',
                        size: 10
                    },
                    color: getComputedStyle(document.documentElement)
                        .getPropertyValue('--nt-text-secondary').trim()
                }
            },
            y: {
                grid: {
                    borderDash: [2, 2],
                    color: getComputedStyle(document.documentElement)
                        .getPropertyValue('--nt-border-light').trim()
                },
                ticks: {
                    font: {
                        family: 'Roboto Mono, monospace',
                        size: 10
                    },
                    color: getComputedStyle(document.documentElement)
                        .getPropertyValue('--nt-text-secondary').trim(),
                    callback: yAxisCallback || function(value) {
                        return formatSize(value);
                    }
                }
            }
        }
    };
}

// 创建流量趋势图 (折线图)
function createTrafficChart(canvasId, data) {
    const ctx = document.getElementById(canvasId).getContext('2d');

    // 准备数据
    const labels = data.timestamps.map(ts => formatBeijingTime(ts, 'short'));

    const datasets = [
        {
            label: 'qBittorrent 上传',
            data: data.qb_upload,
            borderColor: '#666666',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.1
        },
        {
            label: 'M-Team 上传',
            data: data.mt_upload,
            borderColor: '#D71921',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.1
        },
        {
            label: 'qBittorrent 下载',
            data: data.qb_download,
            borderColor: '#999999',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [2, 2],
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.1
        },
        {
            label: 'M-Team 下载',
            data: data.mt_download,
            borderColor: '#FF6B6B',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [10, 5, 2, 5],
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.1
        }
    ];

    return new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: getNothingOSChartOptions()
    });
}

// 创建每日总量柱状图
function createDailyBarChart(canvasId, data) {
    const ctx = document.getElementById(canvasId).getContext('2d');

    const labels = data.dates;

    const datasets = [
        {
            label: 'M-Team 上传',
            data: data.mt_upload,
            backgroundColor: 'rgba(215, 25, 33, 0.8)',
            borderColor: '#D71921',
            borderWidth: 1
        },
        {
            label: 'M-Team 下载',
            data: data.mt_download,
            backgroundColor: 'rgba(255, 107, 107, 0.8)',
            borderColor: '#FF6B6B',
            borderWidth: 1
        }
    ];

    return new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: getNothingOSChartOptions()
    });
}

// 创建分享率折线图
function createShareRatioChart(canvasId, data) {
    const ctx = document.getElementById(canvasId).getContext('2d');

    const labels = data.timestamps.map(ts => formatBeijingTime(ts, 'short'));

    const datasets = [{
        label: '分享率',
        data: data.ratios,
        borderColor: '#D71921',
        backgroundColor: 'rgba(215, 25, 33, 0.1)',
        borderWidth: 2,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.1
    }];

    const options = getNothingOSChartOptions((value) => value.toFixed(2));

    // 添加最高/最低值标注
    options.plugins.annotation = {
        annotations: {
            highest: {
                type: 'line',
                yMin: data.highest,
                yMax: data.highest,
                borderColor: '#4CAF50',
                borderWidth: 1,
                borderDash: [5, 5],
                label: {
                    content: `最高: ${data.highest.toFixed(2)}`,
                    enabled: true,
                    position: 'end'
                }
            },
            lowest: {
                type: 'line',
                yMin: data.lowest,
                yMax: data.lowest,
                borderColor: '#FF9800',
                borderWidth: 1,
                borderDash: [5, 5],
                label: {
                    content: `最低: ${data.lowest.toFixed(2)}`,
                    enabled: true,
                    position: 'end'
                }
            }
        }
    };

    return new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: options
    });
}

// 格式化北京时间
function formatBeijingTime(utcTimestamp, format = 'full') {
    const date = new Date(utcTimestamp * 1000);

    const options = {
        timeZone: 'Asia/Shanghai',
        hour12: false
    };

    if (format === 'short') {
        // 短格式: "01-26 14:30"
        options.month = '2-digit';
        options.day = '2-digit';
        options.hour = '2-digit';
        options.minute = '2-digit';
    } else {
        // 完整格式: "2026-01-26 14:30:00"
        options.year = 'numeric';
        options.month = '2-digit';
        options.day = '2-digit';
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.second = '2-digit';
    }

    return date.toLocaleString('zh-CN', options).replace(/\//g, '-');
}

// 格式化文件大小 (十进制)
function formatSize(bytes) {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1000 && unitIndex < units.length - 1) {
        size /= 1000;
        unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
}
