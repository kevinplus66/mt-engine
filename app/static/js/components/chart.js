/**
 * Chart.js 图表组件 - Nothing OS 风格
 */

// Detect if device supports hover
const supportsHover = window.matchMedia('(hover: hover)').matches;

// 获取 Nothing OS 图表配置
function getNothingOSChartOptions(yAxisCallback = null) {
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements, chart) => {
            // Only use click for toggle on touch devices
            if (!supportsHover) {
                // Get click position relative to chart area
                const canvasPosition = Chart.helpers.getRelativePosition(event, chart);

                // Get the data index from X position
                const dataIndex = chart.scales.x.getValueForPixel(canvasPosition.x);

                // Round to nearest integer index
                const nearestIndex = Math.round(dataIndex);

                // Check if index is valid
                if (nearestIndex >= 0 && nearestIndex < chart.data.labels.length) {
                    // Toggle: if clicking near the same index (within 1 position), hide; otherwise show
                    // Use tolerance for touch screen imprecision
                    const isSamePoint = chart._currentTagIndex !== null &&
                                       Math.abs(chart._currentTagIndex - nearestIndex) <= 1;

                    if (isSamePoint) {
                        clearDataPointTag(chart);
                        chart._currentTagIndex = null;
                    } else {
                        showDataPointTagAtIndex(chart, nearestIndex, canvasPosition.x);
                        chart._currentTagIndex = nearestIndex;
                    }
                } else {
                    clearDataPointTag(chart);
                    chart._currentTagIndex = null;
                }
            }
        },
        onHover: (event, elements, chart) => {
            // Only use hover on desktop devices
            if (supportsHover) {
                const canvasPosition = Chart.helpers.getRelativePosition(event, chart);

                // Get the data index from X position
                const dataIndex = chart.scales.x.getValueForPixel(canvasPosition.x);

                // Round to nearest integer index
                const nearestIndex = Math.round(dataIndex);

                // Check if index is valid and within chart area
                if (nearestIndex >= 0 && nearestIndex < chart.data.labels.length &&
                    canvasPosition.x >= 0 && canvasPosition.x <= chart.width &&
                    canvasPosition.y >= 0 && canvasPosition.y <= chart.height) {

                    // Only update if index changed
                    if (chart._currentHoverIndex !== nearestIndex) {
                        showDataPointTagAtIndex(chart, nearestIndex, canvasPosition.x);
                        chart._currentHoverIndex = nearestIndex;
                    }
                } else {
                    // Mouse left chart area
                    clearDataPointTag(chart);
                    chart._currentHoverIndex = null;
                }
            }
        },
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
    return options;
}

// 创建流量趋势图 (折线图 - 显示每间隔变化量)
function createTrafficChart(canvasId, data) {
    const ctx = document.getElementById(canvasId).getContext('2d');

    // 准备数据
    const labels = data.timestamps.map(ts => formatBeijingTime(ts, 'short'));

    const datasets = [
        {
            label: 'qB 上传增量',
            data: data.qb_upload,
            borderColor: '#666666',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHitRadius: 10,
            tension: 0.1
        },
        {
            label: 'MT 上传增量',
            data: data.mt_upload,
            borderColor: '#D71921',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHitRadius: 10,
            tension: 0.1
        },
        {
            label: 'qB 下载增量',
            data: data.qb_download,
            borderColor: '#999999',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [2, 2],
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHitRadius: 10,
            tension: 0.1
        },
        {
            label: 'MT 下载增量',
            data: data.mt_download,
            borderColor: '#FF6B6B',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [10, 5, 2, 5],
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHitRadius: 10,
            tension: 0.1
        }
    ];

    const chart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: getNothingOSChartOptions()
    });

    // Add mouseleave handler to clear tag when mouse leaves canvas (desktop only)
    if (supportsHover) {
        ctx.canvas.addEventListener('mouseleave', () => {
            clearDataPointTag(chart);
            chart._currentHoverIndex = null;
        });
    }

    return chart;
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
        pointHitRadius: 10,
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

    const chart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: options
    });

    // Add mouseleave handler to clear tag when mouse leaves canvas (desktop only)
    if (supportsHover) {
        ctx.canvas.addEventListener('mouseleave', () => {
            clearDataPointTag(chart);
            chart._currentHoverIndex = null;
        });
    }

    return chart;
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

// 显示数据点标签 (基于X坐标索引，显示所有可见数据集)
function showDataPointTagAtIndex(chart, dataIndex, clickX) {
    // Clear any existing tag first
    clearDataPointTag(chart);

    // Get the time label at this index
    const label = chart.data.labels[dataIndex];

    // Create tag element
    const tag = document.createElement('div');
    tag.className = 'chart-data-tag';
    tag.id = `chart-tag-${chart.id}`;

    // Build HTML for all visible datasets
    let datasetHTML = '';
    chart.data.datasets.forEach((dataset, index) => {
        // Only show visible datasets
        if (!chart.isDatasetVisible(index)) {
            return;
        }

        const value = dataset.data[dataIndex];
        const color = dataset.borderColor || dataset.backgroundColor;

        // Format the value based on chart type
        let formattedValue;
        if (dataset.label.includes('分享率')) {
            formattedValue = value.toFixed(2);
        } else {
            formattedValue = formatSize(value);
        }

        datasetHTML += `
            <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
                <span style="display: inline-block; width: 8px; height: 8px; background: ${color}; border-radius: 50%;"></span>
                <span style="font-size: 10px; color: var(--nt-text-secondary);">${dataset.label}:</span>
                <span style="font-weight: 700; margin-left: auto;">${formattedValue}</span>
            </div>
        `;
    });

    tag.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px dotted var(--nt-border);">${label}</div>
        ${datasetHTML}
    `;

    // Position the tag near the clicked X coordinate
    const canvasPosition = chart.canvas.getBoundingClientRect();
    const x = clickX + canvasPosition.left + window.scrollX;

    // Get Y position from the first visible point (for vertical alignment)
    let y = canvasPosition.top + canvasPosition.height / 2 + window.scrollY;
    for (let i = 0; i < chart.data.datasets.length; i++) {
        if (chart.isDatasetVisible(i)) {
            const point = chart.getDatasetMeta(i).data[dataIndex];
            if (point) {
                y = point.y + canvasPosition.top + window.scrollY;
                break;
            }
        }
    }

    tag.style.position = 'absolute';
    tag.style.left = `${x}px`;
    tag.style.top = `${y - 120}px`; // Position above the point
    tag.style.transform = 'translateX(-50%)'; // Center horizontally

    document.body.appendChild(tag);

    // Store reference to the tag on the chart for cleanup
    chart._dataPointTag = tag;
}

// 显示数据点标签 (旧版本，保留用于向后兼容)
function showDataPointTag(chart, element) {
    // Clear any existing tag first
    clearDataPointTag(chart);

    const datasetIndex = element.datasetIndex;
    const dataIndex = element.index;
    const dataset = chart.data.datasets[datasetIndex];
    const value = dataset.data[dataIndex];
    const label = chart.data.labels[dataIndex];

    // Create tag element
    const tag = document.createElement('div');
    tag.className = 'chart-data-tag';
    tag.id = `chart-tag-${chart.id}`;

    // Format the value based on chart type
    let formattedValue;
    if (dataset.label.includes('分享率')) {
        formattedValue = value.toFixed(2);
    } else {
        formattedValue = formatSize(value);
    }

    tag.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 4px;">${dataset.label}</div>
        <div style="color: var(--nt-text-secondary); font-size: 10px; margin-bottom: 2px;">${label}</div>
        <div style="color: var(--nt-text-primary); font-weight: 700;">${formattedValue}</div>
    `;

    // Position the tag near the clicked point
    const canvasPosition = chart.canvas.getBoundingClientRect();
    const point = chart.getDatasetMeta(datasetIndex).data[dataIndex];
    const x = point.x + canvasPosition.left + window.scrollX;
    const y = point.y + canvasPosition.top + window.scrollY;

    tag.style.position = 'absolute';
    tag.style.left = `${x}px`;
    tag.style.top = `${y - 80}px`; // Position above the point
    tag.style.transform = 'translateX(-50%)'; // Center horizontally

    document.body.appendChild(tag);

    // Store reference to the tag on the chart for cleanup
    chart._dataPointTag = tag;
}

// 清除数据点标签
function clearDataPointTag(chart) {
    if (chart._dataPointTag) {
        chart._dataPointTag.remove();
        chart._dataPointTag = null;
    }

    // Also remove any orphaned tags by ID pattern
    const orphanedTag = document.getElementById(`chart-tag-${chart.id}`);
    if (orphanedTag) {
        orphanedTag.remove();
    }
}

// 创建图表数据集切换开关
function createChartToggles(chart, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = ''; // Clear existing

    chart.data.datasets.forEach((dataset, index) => {
        const toggle = document.createElement('label');
        toggle.className = 'chart-toggle-item';

        // Get the color for the indicator
        const color = dataset.borderColor || dataset.backgroundColor;

        toggle.innerHTML = `
            <input type="checkbox" checked data-index="${index}">
            <span class="color-indicator" style="background: ${color}"></span>
            <span class="toggle-label">${dataset.label}</span>
        `;

        toggle.querySelector('input').addEventListener('change', (e) => {
            chart.setDatasetVisibility(index, e.target.checked);
            chart.update();
        });

        container.appendChild(toggle);
    });
}
