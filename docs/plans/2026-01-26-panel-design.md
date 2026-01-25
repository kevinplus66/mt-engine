# PANEL 页面设计文档

**项目**: MT-Engine
**日期**: 2026-01-26
**版本**: 1.0
**状态**: 设计完成,待实现

## 1. 概述

PANEL 是 MT-Engine 的第四个页面,定位为"个人数据仪表盘",用于长期监控和分析 PT 站点数据。

### 1.1 与现有页面的关系

- **SONAR**: 被动监控 Free 种子
- **RADAR**: 主动搜索种子
- **PILOT**: 自动化下载和清理
- **PANEL**: 数据可视化和趋势分析

### 1.2 核心功能

1. 实时统计卡片展示(分享率、上传/下载总量、魔力值、做种数等)
2. 历史趋势图表(30天数据,支持24H/7D/30D视图切换)
3. qBittorrent vs M-Team 数据对比(叠加显示,发现异常流量)
4. 自动数据采集(每5分钟后台采集并存储)
5. 智能数据聚合(不同时间范围自动调整精度)

## 2. 数据架构

### 2.1 数据存储

**存储方式**: SQLite 数据库
**位置**: `release/data/panel.db`
**保留期**: 30天(自动清理旧数据)
**采集频率**: 每5分钟一次

### 2.2 数据库表结构

#### 流量统计表 (traffic_stats)

```sql
CREATE TABLE traffic_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,   -- UTC 时间戳
    source TEXT NOT NULL,          -- 'qbittorrent' 或 'mteam'
    uploaded INTEGER NOT NULL,     -- 总上传量(字节)
    downloaded INTEGER NOT NULL,   -- 总下载量(字节)
    upload_speed INTEGER,          -- 当前上传速率(字节/秒)
    download_speed INTEGER,        -- 当前下载速率(字节/秒)
    UNIQUE(timestamp, source)
);

CREATE INDEX idx_traffic_time ON traffic_stats(timestamp);
CREATE INDEX idx_traffic_source ON traffic_stats(source);
```

#### 用户统计表 (user_stats)

```sql
CREATE TABLE user_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    share_ratio REAL NOT NULL,     -- 分享率
    bonus INTEGER,                  -- 魔力值
    seeding_count INTEGER,          -- 做种数
    leeching_count INTEGER,         -- 下载数
    uploaded INTEGER,               -- 上传总量(字节)
    downloaded INTEGER,             -- 下载总量(字节)
    user_level TEXT,                -- 用户等级
    UNIQUE(timestamp)
);

CREATE INDEX idx_user_time ON user_stats(timestamp);
```

### 2.3 时区处理

- **存储**: UTC 时间戳
- **显示**: 转换为北京时间(Asia/Shanghai, UTC+8)
- **前端**: JavaScript 使用 `toLocaleString()` 转换显示

### 2.4 数据聚合策略

| 时间范围 | 聚合方式 | 数据点数量 |
|---------|---------|-----------|
| 24H | 5分钟原始数据 | 288个点 |
| 7D | 按小时聚合 | 168个点 |
| 30D | 按天聚合 | 30个点 |

## 3. API 接口设计

### 3.1 页面路由

```
GET /panel
返回: panel.html 模板
```

### 3.2 实时统计接口

```
GET /api/panel/stats

返回示例:
{
    "mteam": {
        "share_ratio": 2.45,
        "uploaded": 1234567890,
        "downloaded": 500000000,
        "uploaded_display": "1.23 GB",
        "downloaded_display": "500.00 MB",
        "bonus": 12500,
        "seeding_count": 45,
        "leeching_count": 2,
        "user_level": "精英"
    },
    "qbittorrent": {
        "uploaded": 1230000000,
        "downloaded": 498000000,
        "upload_speed": 1024000,
        "download_speed": 512000
    },
    "last_update": 1738000000
}
```

### 3.3 历史数据接口

```
GET /api/panel/history?range=24h|7d|30d

返回示例:
{
    "range": "24h",
    "data_points": [
        {
            "timestamp": 1738000000,
            "mteam": {"uploaded": 1234567890, "downloaded": 500000000},
            "qbittorrent": {"uploaded": 1230000000, "downloaded": 498000000}
        }
    ],
    "aggregation": "5min"
}
```

### 3.4 分享率历史接口

```
GET /api/panel/share-ratio?range=24h|7d|30d

返回示例:
{
    "data_points": [
        {"timestamp": 1738000000, "share_ratio": 2.45}
    ],
    "current": 2.45,
    "highest": 2.50,
    "lowest": 2.40,
    "change_24h": 0.05
}
```

## 4. 数据采集服务

### 4.1 采集流程

集成到 `main.py` 的 `background_refresh()` 任务:

```python
async def background_refresh():
    while True:
        try:
            # 现有的种子刷新逻辑
            await refresh_torrents()

            # 新增: PANEL 数据采集
            await collect_panel_data()

            # PILOT 检查
            if pilot_enabled:
                await run_pilot_cycles()

        except Exception as e:
            logger.error(f"后台任务异常: {e}")

        await asyncio.sleep(REFRESH_INTERVAL)  # 300秒
```

### 4.2 qBittorrent 数据采集

采集带 M-Team 标签的种子统计:

```python
async def qb_get_mteam_stats(sid: str) -> Dict:
    """统计 M-Team 相关标签的种子流量"""
    torrents = await qb_get_torrents(sid)

    mteam_tags = ['声呐做种', '雷达下载', 'PILOT']
    total_uploaded = 0
    total_downloaded = 0
    upload_speed = 0
    download_speed = 0

    for torrent in torrents:
        tags = torrent.get('tags', '').split(',')
        if any(tag.strip() in mteam_tags for tag in tags):
            total_uploaded += torrent.get('uploaded', 0)
            total_downloaded += torrent.get('downloaded', 0)
            upload_speed += torrent.get('upspeed', 0)
            download_speed += torrent.get('dlspeed', 0)

    return {
        'uploaded': total_uploaded,
        'downloaded': total_downloaded,
        'upload_speed': upload_speed,
        'download_speed': download_speed
    }
```

### 4.3 M-Team 数据采集

使用现有的 `fetch_user_profile()` API 获取:
- 上传/下载总量
- 分享率
- 其他统计数据(需要额外 API 调用获取 bonus、做种数等)

### 4.4 数据清理

自动删除30天前的数据:

```python
async def cleanup_old_panel_data():
    """删除30天前的数据"""
    cutoff_timestamp = int((datetime.utcnow() - timedelta(days=30)).timestamp())

    DELETE FROM traffic_stats WHERE timestamp < cutoff_timestamp;
    DELETE FROM user_stats WHERE timestamp < cutoff_timestamp;
```

## 5. 前端设计

### 5.1 页面布局

```
┌─────────────────────────────────────────────┐
│  Navbar (复用现有导航栏)                      │
├─────────────────────────────────────────────┤
│  关键指标卡片区 (顶部,网格布局)                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│
│  │分享率  │ │上传量  │ │下载量  │ │魔力值  ││
│  │+ 趋势  │ │        │ │        │ │        ││
│  └────────┘ └────────┘ └────────┘ └────────┘│
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│
│  │做种数  │ │下载数  │ │用户等级│ │更新时间││
│  └────────┘ └────────┘ └────────┘ └────────┘│
├─────────────────────────────────────────────┤
│  图表控制区                                   │
│  [24H] [7D] [30D]  <时间范围切换按钮>        │
├─────────────────────────────────────────────┤
│  上传/下载趋势图 (折线图)                     │
│  ┌─────────────────────────────────────────┐│
│  │ qBittorrent 上传 ----                   ││
│  │ M-Team 上传 ----                        ││
│  │ qBittorrent 下载 ----                   ││
│  │ M-Team 下载 ----                        ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  每日总量对比图 (柱状图)                      │
│  ┌─────────────────────────────────────────┐│
│  │ 每天的上传/下载柱状图 (过去30天)          ││
│  └─────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│  分享率趋势图 (折线图)                        │
│  ┌─────────────────────────────────────────┐│
│  │ 显示最高/最低值标注                       ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

### 5.2 文件结构

```
release/app/
├── static/
│   ├── css/modules/panel.css          // PANEL 专用样式
│   └── js/
│       ├── pages/panel.js              // PANEL 页面主逻辑
│       ├── components/chart.js         // 图表组件封装
│       └── components/stats-card.js    // 统计卡片组件
└── templates/
    └── panel.html                      // PANEL 页面模板
```

### 5.3 图表库

使用 **Chart.js** (v4.4.0):
- 轻量级(~200KB)
- 支持折线图、柱状图、混合图表
- 易于自定义为 Nothing OS 风格
- 通过 CDN 引入

### 5.4 统计卡片设计

每个卡片包含:
- **标签**: DotGothic16 字体,大写,字间距1px
- **数值**: Roboto Mono 字体,28px,粗体
- **趋势**: 迷你 SVG 折线图(60x20px)
- **变化**: 显示24小时变化值和箭头(↑/↓)

卡片样式:
- 点状边框,悬停时变实线
- 背景色使用 `--nt-bg-secondary`
- 响应式网格布局(4列/3列/2列)

### 5.5 图表样式(Nothing OS)

```javascript
const chartOptions = {
    colors: {
        mteam: '#D71921',        // M-Team 红色
        qbittorrent: '#666666',  // qBittorrent 灰色
    },
    font: {
        family: 'Roboto Mono, monospace',
        size: 11
    },
    grid: {
        borderDash: [2, 2],      // 点状网格线
        color: 'var(--nt-border-light)'
    },
    borderRadius: 0              // 无圆角
};
```

### 5.6 数据叠加对比

在折线图中同时绘制4条线:
- qBittorrent 上传(灰色实线)
- M-Team 上传(红色虚线)
- qBittorrent 下载(灰色点线)
- M-Team 下载(红色点划线)

使用不同线型确保黑白模式下也能区分。

### 5.7 自动刷新

- 默认启用自动刷新
- 刷新间隔: 5分钟(300秒)
- 刷新内容: 实时统计 + 当前时间范围的历史图表
- 显示最后更新时间(北京时间)

## 6. 数据格式化规范

**容量单位**: 十进制(SI units)
- 1 KB = 1,000 bytes
- 1 MB = 1,000,000 bytes
- 1 GB = 1,000,000,000 bytes
- 1 TB = 1,000,000,000,000 bytes

**实现**:
- 后端: 复用现有 `format_size()` 函数
- 前端: 实现相同逻辑的 `formatSize()` JavaScript 函数

## 7. 访问权限

**访问控制**: 无需认证
**理由**: 与 SONAR/RADAR 一样公开访问,部署在私有网络中确保安全

## 8. 响应式设计

| 屏幕尺寸 | 卡片布局 | 图表 |
|---------|---------|------|
| >1024px (桌面) | 4列网格 | 全宽显示 |
| 768-1024px (平板) | 3列网格 | 全宽显示 |
| <768px (移动) | 2列网格 | 可横向滚动 |

## 9. 错误处理

1. **数据加载失败**: 显示占位符和重试按钮
2. **API 超时**: Toast 提示"加载超时,请刷新页面"
3. **空数据**: 显示"暂无历史数据,请等待数据采集"
4. **图表渲染失败**: 降级显示表格数据

## 10. 性能优化

1. **图表数据缓存**: 避免重复渲染相同数据
2. **懒加载**: 首屏只加载24H数据,切换时才加载7D/30D
3. **防抖**: 窗口 resize 时延迟重绘图表(300ms)
4. **数据聚合**: 后端完成聚合,前端直接渲染

## 11. 部署注意事项

### 11.1 Docker Volume 映射

确保数据库持久化:

```yaml
volumes:
  - ./data:/app/data
```

### 11.2 依赖安装

在 `panel.html` 中添加 Chart.js CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
```

### 11.3 数据库初始化

首次运行时自动创建表结构(在应用启动时执行)。

### 11.4 .gitignore 更新

添加数据库文件到 `.gitignore`:

```
data/panel.db
data/panel.db-journal
```

## 12. 未来扩展可能

1. **导出功能**: 导出统计数据为 CSV/Excel
2. **对比功能**: 与其他用户对比(如 RIVAL_USER_ID)
3. **告警功能**: 分享率低于阈值时通知
4. **自定义时间范围**: 支持用户选择任意日期范围
5. **更多图表**: 种子分类分布、做种时长统计等

## 13. 实现检查清单

### 后端

- [ ] 创建 `app/services/panel.py` 数据采集服务
- [ ] 创建 `app/routes/panel.py` 路由处理
- [ ] 在 `main.py` 中集成数据采集到 `background_refresh()`
- [ ] 实现 SQLite 数据库初始化
- [ ] 实现数据聚合查询逻辑
- [ ] 实现数据清理任务
- [ ] 添加 qBittorrent 标签统计功能

### 前端

- [ ] 创建 `panel.html` 模板
- [ ] 创建 `css/modules/panel.css` 样式
- [ ] 创建 `js/pages/panel.js` 主逻辑
- [ ] 创建 `js/components/chart.js` 图表组件
- [ ] 创建 `js/components/stats-card.js` 卡片组件
- [ ] 实现时间范围切换功能
- [ ] 实现自动刷新功能
- [ ] 实现北京时间显示

### 测试

- [ ] 数据采集功能测试
- [ ] API 接口测试
- [ ] 图表渲染测试
- [ ] 响应式布局测试
- [ ] 数据清理功能测试
- [ ] 容错机制测试

### 部署

- [ ] 更新 Docker volume 配置
- [ ] 更新 `.gitignore`
- [ ] 添加数据库初始化脚本
- [ ] 更新 `AGENT.md` 文档
- [ ] 更新 `README.md`

---

**设计完成日期**: 2026-01-26
**设计状态**: ✅ 已确认,等待实现
