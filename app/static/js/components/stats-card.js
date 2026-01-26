/**
 * 统计卡片组件
 */

// 更新统计卡片
function updateStatCard(cardId, value, options = {}) {
    const card = document.getElementById(cardId);
    if (!card) return;

    const valueEl = card.querySelector('.stat-value');
    if (valueEl) {
        valueEl.textContent = value;
    }

    // 更新子值 (可选)
    if (options.subvalue !== undefined) {
        const subvalueEl = card.querySelector('.stat-subvalue');
        if (subvalueEl) {
            subvalueEl.textContent = options.subvalue;
        }
    }

    // 更新趋势 (可选)
    if (options.trend !== undefined && options.change !== undefined) {
        updateStatTrend(card, options.trend, options.change);
    }
}

// 更新统计趋势
function updateStatTrend(card, trendData, change) {
    const changeEl = card.querySelector('.stat-change');
    if (!changeEl) return;

    // 更新变化值
    const changeText = change > 0 ? `今日分享率增长：+${change.toFixed(2)} ↑` :
                       change < 0 ? `今日分享率增长：${change.toFixed(2)} ↓` :
                       '今日分享率增长：0.00 →';
    changeEl.textContent = changeText;

    // 更新样式
    changeEl.className = 'stat-change';
    if (change > 0) {
        changeEl.classList.add('positive');
    } else if (change < 0) {
        changeEl.classList.add('negative');
    }

    // 绘制迷你趋势图
    const chartEl = card.querySelector('.mini-chart');
    if (chartEl && trendData && trendData.length > 0) {
        drawMiniChart(chartEl, trendData);
    }
}

// 绘制迷你趋势线 (SVG)
function drawMiniChart(svg, dataPoints) {
    const width = 60;
    const height = 20;

    if (dataPoints.length < 2) {
        svg.innerHTML = '';
        return;
    }

    const max = Math.max(...dataPoints);
    const min = Math.min(...dataPoints);
    const range = max - min;

    // 如果所有值相同,绘制水平线
    if (range === 0) {
        const y = height / 2;
        svg.innerHTML = `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                <line x1="0" y1="${y}" x2="${width}" y2="${y}"
                      stroke="currentColor" stroke-width="1.5" />
            </svg>
        `;
        return;
    }

    // 生成折线点
    const points = dataPoints.map((val, i) => {
        const x = (i / (dataPoints.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    svg.innerHTML = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <polyline points="${points}"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linejoin="round"
                      stroke-linecap="round" />
        </svg>
    `;
}

// 批量更新所有统计卡片
function updateAllStatCards(statsData) {
    const { mteam, qbittorrent, user, avg_speeds } = statsData;

    // 分享率
    if (user && user.share_ratio !== undefined) {
        updateStatCard('card-share-ratio', user.share_ratio.toFixed(2), {
            change: user.change_24h || 0,
            trend: user.trend || []
        });
    }

    // 上传/下载量 (合并卡片 - M-Team 数据)
    if (mteam && mteam.uploaded_display && mteam.downloaded_display) {
        updateDualValueCard('card-traffic',
            mteam.uploaded_display,
            mteam.downloaded_display
        );
    }

    // 做种/下载 (双大数字)
    if (user && user.seeding_count !== undefined && user.leeching_count !== undefined) {
        updateDualValueCard('card-seeding-leeching',
            user.seeding_count.toString(),
            user.leeching_count.toString()
        );
    }

    // 平均速度 (合并卡片 - qBittorrent 数据)
    if (avg_speeds && avg_speeds.upload_display && avg_speeds.download_display) {
        updateDualValueCard('card-avg-speed',
            avg_speeds.upload_display,
            avg_speeds.download_display
        );
    }

    // 魔力值 (如果卡片存在)
    if (user && user.bonus !== undefined && user.bonus !== null) {
        updateStatCard('card-bonus', user.bonus.toLocaleString());
    }

    // 用户等级 (如果卡片存在)
    if (user && user.user_level) {
        updateStatCard('card-level', user.user_level);
    }
}

// 更新双值卡片 (e.g., "132.80 TB / 12.20 TB")
function updateDualValueCard(cardId, value1, value2) {
    const card = document.getElementById(cardId);
    if (!card) return;

    // Find the dual value container
    const dualValueEl = card.querySelector('.stat-value-dual');
    if (!dualValueEl) return;

    // Update the two values
    const val1El = dualValueEl.querySelector('.value-up, .value-seeding');
    const val2El = dualValueEl.querySelector('.value-down, .value-leeching');

    if (val1El) val1El.textContent = value1;
    if (val2El) val2El.textContent = value2;
}

// 更新最后刷新时间 (已移除 - 不再需要最后更新卡片)
// function updateLastUpdateTime(utcTimestamp) {
//     const card = document.getElementById('card-update');
//     if (!card) return;
//
//     const timeEl = card.querySelector('.last-update-time');
//     if (timeEl) {
//         const beijingTime = formatBeijingTime(utcTimestamp, 'short');
//         timeEl.textContent = beijingTime;
//     }
// }
