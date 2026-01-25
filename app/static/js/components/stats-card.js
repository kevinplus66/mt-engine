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
    const changeText = change > 0 ? `+${change.toFixed(2)} ↑` :
                       change < 0 ? `${change.toFixed(2)} ↓` :
                       '0.00 →';
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
    const { mteam, qbittorrent, user } = statsData;

    // 分享率
    if (user && user.share_ratio !== undefined) {
        updateStatCard('card-share-ratio', user.share_ratio.toFixed(2), {
            change: user.change_24h || 0,
            trend: user.trend || []
        });
    }

    // 上传量
    if (mteam && mteam.uploaded_display) {
        updateStatCard('card-uploaded', mteam.uploaded_display);
    }

    // 下载量
    if (mteam && mteam.downloaded_display) {
        updateStatCard('card-downloaded', mteam.downloaded_display);
    }

    // 魔力值
    if (user && user.bonus !== undefined && user.bonus !== null) {
        updateStatCard('card-bonus', user.bonus.toLocaleString());
    }

    // 做种数
    if (user && user.seeding_count !== undefined) {
        updateStatCard('card-seeding', user.seeding_count);
    }

    // 下载数
    if (user && user.leeching_count !== undefined) {
        updateStatCard('card-leeching', user.leeching_count);
    }

    // 用户等级
    if (user && user.user_level) {
        updateStatCard('card-level', user.user_level);
    }
}

// 更新最后刷新时间
function updateLastUpdateTime(utcTimestamp) {
    const card = document.getElementById('card-update');
    if (!card) return;

    const timeEl = card.querySelector('.last-update-time');
    if (timeEl) {
        const beijingTime = formatBeijingTime(utcTimestamp, 'short');
        timeEl.textContent = beijingTime;
    }
}
