# PANEL Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement PANEL dashboard page for MT-Engine with 30-day data tracking, real-time stats cards, and historical trend charts

**Architecture:** SQLite database stores traffic/user stats every 5 minutes, background task collects data from qBittorrent and M-Team APIs, frontend displays 8 stat cards + 3 charts with Chart.js, auto-refresh every 5 minutes

**Tech Stack:** Python 3.9+, FastAPI, SQLite3, Jinja2, Chart.js 4.4.0, Nothing OS design system

---

## Task 1: Database Schema and Initialization

**Files:**
- Create: `release/app/services/panel_db.py`
- Create: `release/data/.gitkeep` (ensure directory exists)
- Modify: `release/.gitignore`

**Step 1: Create database service module**

Create `release/app/services/panel_db.py`:

```python
"""
PANEL 数据库服务
"""

import sqlite3
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from pathlib import Path

from app.config import logger

# 数据库路径
DB_PATH = Path(__file__).parent.parent.parent / "data" / "panel.db"


def get_db_connection() -> sqlite3.Connection:
    """获取数据库连接"""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    """初始化数据库表结构"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 创建流量统计表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS traffic_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            source TEXT NOT NULL,
            uploaded INTEGER NOT NULL,
            downloaded INTEGER NOT NULL,
            upload_speed INTEGER,
            download_speed INTEGER,
            UNIQUE(timestamp, source)
        )
    """)

    # 创建索引
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_traffic_time
        ON traffic_stats(timestamp)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_traffic_source
        ON traffic_stats(source)
    """)

    # 创建用户统计表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            share_ratio REAL NOT NULL,
            bonus INTEGER,
            seeding_count INTEGER,
            leeching_count INTEGER,
            uploaded INTEGER,
            downloaded INTEGER,
            user_level TEXT,
            UNIQUE(timestamp)
        )
    """)

    # 创建索引
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_user_time
        ON user_stats(timestamp)
    """)

    conn.commit()
    conn.close()
    logger.info("PANEL 数据库初始化完成")


async def save_traffic_stats(
    timestamp: int,
    source: str,
    uploaded: int,
    downloaded: int,
    upload_speed: Optional[int] = None,
    download_speed: Optional[int] = None
) -> bool:
    """保存流量统计数据"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT OR REPLACE INTO traffic_stats
            (timestamp, source, uploaded, downloaded, upload_speed, download_speed)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (timestamp, source, uploaded, downloaded, upload_speed, download_speed))

        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"保存流量统计失败: {e}")
        return False


async def save_user_stats(
    timestamp: int,
    share_ratio: float,
    uploaded: Optional[int] = None,
    downloaded: Optional[int] = None,
    bonus: Optional[int] = None,
    seeding_count: Optional[int] = None,
    leeching_count: Optional[int] = None,
    user_level: Optional[str] = None
) -> bool:
    """保存用户统计数据"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT OR REPLACE INTO user_stats
            (timestamp, share_ratio, uploaded, downloaded, bonus,
             seeding_count, leeching_count, user_level)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (timestamp, share_ratio, uploaded, downloaded, bonus,
              seeding_count, leeching_count, user_level))

        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"保存用户统计失败: {e}")
        return False


async def cleanup_old_data(days: int = 30):
    """删除指定天数之前的数据"""
    try:
        cutoff_timestamp = int((datetime.utcnow() - timedelta(days=days)).timestamp())

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("DELETE FROM traffic_stats WHERE timestamp < ?", (cutoff_timestamp,))
        deleted_traffic = cursor.rowcount

        cursor.execute("DELETE FROM user_stats WHERE timestamp < ?", (cutoff_timestamp,))
        deleted_user = cursor.rowcount

        conn.commit()
        conn.close()

        logger.info(f"清理旧数据完成: traffic_stats={deleted_traffic}, user_stats={deleted_user}")
        return True
    except Exception as e:
        logger.error(f"清理旧数据失败: {e}")
        return False


async def get_latest_stats() -> Optional[Dict]:
    """获取最新的统计数据"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 获取最新的流量统计
        cursor.execute("""
            SELECT * FROM traffic_stats
            WHERE timestamp = (SELECT MAX(timestamp) FROM traffic_stats)
        """)
        traffic_rows = cursor.fetchall()

        # 获取最新的用户统计
        cursor.execute("""
            SELECT * FROM user_stats
            WHERE timestamp = (SELECT MAX(timestamp) FROM user_stats)
        """)
        user_row = cursor.fetchone()

        conn.close()

        if not traffic_rows:
            return None

        result = {
            "qbittorrent": {},
            "mteam": {},
            "user": {}
        }

        for row in traffic_rows:
            source = row["source"]
            result[source] = {
                "uploaded": row["uploaded"],
                "downloaded": row["downloaded"],
                "upload_speed": row["upload_speed"],
                "download_speed": row["download_speed"]
            }

        if user_row:
            result["user"] = {
                "share_ratio": user_row["share_ratio"],
                "uploaded": user_row["uploaded"],
                "downloaded": user_row["downloaded"],
                "bonus": user_row["bonus"],
                "seeding_count": user_row["seeding_count"],
                "leeching_count": user_row["leeching_count"],
                "user_level": user_row["user_level"]
            }

        return result
    except Exception as e:
        logger.error(f"获取最新统计失败: {e}")
        return None
```

**Step 2: Add data directory placeholder**

Create `release/data/.gitkeep`:

```
# This directory stores PANEL database
```

**Step 3: Update .gitignore**

Add to `release/.gitignore`:

```
# PANEL Database
data/panel.db
data/panel.db-journal
```

**Step 4: Test database initialization**

Run Python test:

```bash
cd release
python3 -c "from app.services.panel_db import init_database; init_database(); print('Database initialized successfully')"
```

Expected: "Database initialized successfully" + `data/panel.db` file created

**Step 5: Commit database layer**

```bash
cd release
git add app/services/panel_db.py data/.gitkeep .gitignore
git commit -m "feat(panel): add database schema and initialization

- Create traffic_stats table for qBittorrent/M-Team data
- Create user_stats table for user metrics
- Add save/cleanup/query functions
- Add .gitignore for panel.db"
```

---

## Task 2: Data Collection Service

**Files:**
- Create: `release/app/services/panel_collector.py`
- Modify: `release/app/services/qbittorrent.py` (add new function)

**Step 1: Add qBittorrent stats collection function**

Add to `release/app/services/qbittorrent.py` (after line 469):

```python
async def qb_get_mteam_stats(sid: str) -> Dict:
    """
    统计 M-Team 相关标签的种子流量

    Args:
        sid: qBittorrent 会话 ID

    Returns:
        Dict: 包含上传下载总量和速率
    """
    torrents = await qb_get_torrents(sid)

    mteam_tags = ['声呐做种', '雷达下载', 'PILOT']
    total_uploaded = 0
    total_downloaded = 0
    upload_speed = 0
    download_speed = 0

    for torrent in torrents:
        tags = torrent.get('tags', '').split(',')
        # 检查是否有 M-Team 标签
        if any(tag.strip() in mteam_tags for tag in tags):
            total_uploaded += torrent.get('uploaded', 0)
            total_downloaded += torrent.get('downloaded', 0)
            upload_speed += torrent.get('upspeed', 0)
            download_speed += torrent.get('dlspeed', 0)

    logger.debug(f"M-Team 标签统计: 上传={total_uploaded}, 下载={total_downloaded}")
    return {
        'uploaded': total_uploaded,
        'downloaded': total_downloaded,
        'upload_speed': upload_speed,
        'download_speed': download_speed
    }
```

**Step 2: Create data collection service**

Create `release/app/services/panel_collector.py`:

```python
"""
PANEL 数据采集服务
"""

from datetime import datetime
from app.config import logger
from app.services.panel_db import save_traffic_stats, save_user_stats, cleanup_old_data
from app.services.qbittorrent import qb_login, qb_get_mteam_stats
from app.services.mteam_api import fetch_user_profile
from app.state import user_torrent_status


async def collect_panel_data():
    """采集 PANEL 数据并存储到数据库"""
    timestamp = int(datetime.utcnow().timestamp())

    # 1. 采集 qBittorrent 数据
    try:
        sid = await qb_login()
        if sid:
            qb_stats = await qb_get_mteam_stats(sid)
            await save_traffic_stats(
                timestamp=timestamp,
                source='qbittorrent',
                uploaded=qb_stats['uploaded'],
                downloaded=qb_stats['downloaded'],
                upload_speed=qb_stats.get('upload_speed', 0),
                download_speed=qb_stats.get('download_speed', 0)
            )
            logger.info(f"采集 qBittorrent 数据成功")
    except Exception as e:
        logger.error(f"采集 qBittorrent 数据失败: {e}")

    # 2. 采集 M-Team 数据
    try:
        profile = await fetch_user_profile()
        if profile:
            await save_traffic_stats(
                timestamp=timestamp,
                source='mteam',
                uploaded=profile['uploaded'],
                downloaded=profile['downloaded']
            )

            # 获取做种/下载数
            seeding_count = len(user_torrent_status.get("seeding", {}))
            leeching_count = len(user_torrent_status.get("leeching", {}))

            await save_user_stats(
                timestamp=timestamp,
                share_ratio=profile['share_ratio'],
                uploaded=profile['uploaded'],
                downloaded=profile['downloaded'],
                seeding_count=seeding_count,
                leeching_count=leeching_count
            )
            logger.info(f"采集 M-Team 数据成功")
    except Exception as e:
        logger.error(f"采集 M-Team 数据失败: {e}")


async def cleanup_panel_data():
    """清理30天前的数据"""
    await cleanup_old_data(days=30)
```

**Step 3: Test data collection**

Run Python test:

```bash
cd release
python3 -c "
import asyncio
from app.services.panel_collector import collect_panel_data
from app.services.panel_db import init_database, get_latest_stats

init_database()
asyncio.run(collect_panel_data())
stats = asyncio.run(get_latest_stats())
print('Data collected:', stats is not None)
"
```

Expected: "Data collected: True"

**Step 4: Commit data collection service**

```bash
cd release
git add app/services/panel_collector.py app/services/qbittorrent.py
git commit -m "feat(panel): add data collection service

- Add qb_get_mteam_stats() for tagged torrent stats
- Add collect_panel_data() to gather qBit + M-Team data
- Add cleanup_panel_data() for old data removal"
```

---

## Task 3: Integrate Background Collection Task

**Files:**
- Modify: `release/app/main.py`

**Step 1: Import panel services**

Add imports at top of `release/app/main.py` (after line 29):

```python
from app.services.panel_db import init_database
from app.services.panel_collector import collect_panel_data, cleanup_panel_data
```

**Step 2: Initialize database on startup**

Add to startup event handler (after line 48, inside `@app.on_event("startup")`):

```python
    # 初始化 PANEL 数据库
    init_database()
    logger.info("PANEL 数据库已初始化")
```

**Step 3: Add data collection to background task**

Modify `background_refresh()` function (around line 67, after `await refresh_torrents()`):

```python
            # 采集 PANEL 数据
            await collect_panel_data()
```

**Step 4: Add daily cleanup task**

Add new background task (after `background_refresh()` function):

```python
async def daily_cleanup():
    """每日清理旧数据"""
    while True:
        try:
            await asyncio.sleep(86400)  # 24小时
            await cleanup_panel_data()
            logger.info("PANEL 数据清理完成")
        except Exception as e:
            logger.error(f"PANEL 数据清理异常: {e}")
```

**Step 5: Start cleanup task on startup**

Add to startup event handler (after existing `asyncio.create_task(background_refresh())`):

```python
    asyncio.create_task(daily_cleanup())
```

**Step 6: Test integration**

Run the app briefly:

```bash
cd release
python3 -m uvicorn app.main:app --reload &
sleep 10
kill %1
```

Check logs for "PANEL 数据库已初始化" and "采集 qBittorrent 数据成功"

**Step 7: Commit background task integration**

```bash
cd release
git add app/main.py
git commit -m "feat(panel): integrate data collection into background tasks

- Initialize database on app startup
- Collect PANEL data every 5 minutes
- Daily cleanup of 30+ day old data"
```

---

## Task 4: API Routes - Real-time Stats

**Files:**
- Create: `release/app/routes/panel.py`
- Modify: `release/app/main.py` (register routes)

**Step 1: Create panel routes module**

Create `release/app/routes/panel.py`:

```python
"""
PANEL 路由
"""

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from typing import Dict, Optional
from datetime import datetime

from app.config import logger
from app.services.panel_db import get_latest_stats
from app.services.mteam_api import fetch_user_profile
from app.services.qbittorrent import qb_login, qb_get_mteam_stats
from app.utils import format_size
from app.state import user_torrent_status

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")


@router.get("/panel", response_class=HTMLResponse)
async def panel_page(request: Request):
    """PANEL 页面"""
    return templates.TemplateResponse("panel.html", {"request": request})


@router.get("/api/panel/stats")
async def get_panel_stats() -> Dict:
    """获取实时统计数据"""
    try:
        # 尝试从数据库获取最新数据
        db_stats = await get_latest_stats()

        # 如果数据库没有数据,实时采集
        if not db_stats:
            logger.info("数据库无数据,实时采集")

            # 采集 qBittorrent 数据
            qb_data = {}
            try:
                sid = await qb_login()
                if sid:
                    qb_stats = await qb_get_mteam_stats(sid)
                    qb_data = {
                        "uploaded": qb_stats['uploaded'],
                        "downloaded": qb_stats['downloaded'],
                        "uploaded_display": format_size(qb_stats['uploaded']),
                        "downloaded_display": format_size(qb_stats['downloaded']),
                        "upload_speed": qb_stats.get('upload_speed', 0),
                        "download_speed": qb_stats.get('download_speed', 0)
                    }
            except Exception as e:
                logger.error(f"实时采集 qBittorrent 失败: {e}")

            # 采集 M-Team 数据
            mt_data = {}
            user_data = {}
            try:
                profile = await fetch_user_profile()
                if profile:
                    mt_data = {
                        "uploaded": profile['uploaded'],
                        "downloaded": profile['downloaded'],
                        "uploaded_display": profile['uploaded_display'],
                        "downloaded_display": profile['downloaded_display']
                    }
                    user_data = {
                        "share_ratio": profile['share_ratio'],
                        "uploaded": profile['uploaded'],
                        "downloaded": profile['downloaded'],
                        "uploaded_display": profile['uploaded_display'],
                        "downloaded_display": profile['downloaded_display'],
                        "seeding_count": len(user_torrent_status.get("seeding", {})),
                        "leeching_count": len(user_torrent_status.get("leeching", {}))
                    }
            except Exception as e:
                logger.error(f"实时采集 M-Team 失败: {e}")

            return {
                "mteam": mt_data,
                "qbittorrent": qb_data,
                "user": user_data,
                "last_update": int(datetime.utcnow().timestamp())
            }

        # 格式化数据库数据
        result = {
            "mteam": {
                "uploaded": db_stats["mteam"].get("uploaded", 0),
                "downloaded": db_stats["mteam"].get("downloaded", 0),
                "uploaded_display": format_size(db_stats["mteam"].get("uploaded", 0)),
                "downloaded_display": format_size(db_stats["mteam"].get("downloaded", 0))
            },
            "qbittorrent": {
                "uploaded": db_stats["qbittorrent"].get("uploaded", 0),
                "downloaded": db_stats["qbittorrent"].get("downloaded", 0),
                "uploaded_display": format_size(db_stats["qbittorrent"].get("uploaded", 0)),
                "downloaded_display": format_size(db_stats["qbittorrent"].get("downloaded", 0)),
                "upload_speed": db_stats["qbittorrent"].get("upload_speed", 0),
                "download_speed": db_stats["qbittorrent"].get("download_speed", 0)
            },
            "user": {
                "share_ratio": db_stats["user"].get("share_ratio", 0),
                "uploaded": db_stats["user"].get("uploaded", 0),
                "downloaded": db_stats["user"].get("downloaded", 0),
                "uploaded_display": format_size(db_stats["user"].get("uploaded", 0)),
                "downloaded_display": format_size(db_stats["user"].get("downloaded", 0)),
                "bonus": db_stats["user"].get("bonus"),
                "seeding_count": db_stats["user"].get("seeding_count", 0),
                "leeching_count": db_stats["user"].get("leeching_count", 0),
                "user_level": db_stats["user"].get("user_level")
            },
            "last_update": int(datetime.utcnow().timestamp())
        }

        return result

    except Exception as e:
        logger.error(f"获取统计数据失败: {e}")
        return {
            "mteam": {},
            "qbittorrent": {},
            "user": {},
            "last_update": int(datetime.utcnow().timestamp())
        }
```

**Step 2: Register panel routes**

Add to `release/app/main.py` imports (around line 32):

```python
from app.routes.panel import router as panel_router
```

Add route registration (after line 55, after other routers):

```python
app.include_router(panel_router)
```

**Step 3: Test stats API**

Start app and test:

```bash
cd release
python3 -m uvicorn app.main:app --reload &
sleep 5
curl http://localhost:8000/api/panel/stats | python3 -m json.tool
kill %1
```

Expected: JSON response with mteam/qbittorrent/user data

**Step 4: Commit stats API**

```bash
cd release
git add app/routes/panel.py app/main.py
git commit -m "feat(panel): add real-time stats API endpoint

- GET /api/panel/stats returns current metrics
- Falls back to live collection if DB empty
- Formats sizes using format_size() utility"
```

---

## Task 5: API Routes - Historical Data

**Files:**
- Modify: `release/app/routes/panel.py`
- Modify: `release/app/services/panel_db.py` (add query functions)

**Step 1: Add historical query functions to DB service**

Add to `release/app/services/panel_db.py` (at end of file):

```python
async def get_traffic_history(hours: int) -> List[Dict]:
    """
    获取流量历史数据

    Args:
        hours: 小时数 (24, 168=7天, 720=30天)

    Returns:
        List[Dict]: 数据点列表
    """
    try:
        from_timestamp = int((datetime.utcnow() - timedelta(hours=hours)).timestamp())

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT timestamp, source, uploaded, downloaded
            FROM traffic_stats
            WHERE timestamp >= ?
            ORDER BY timestamp ASC
        """, (from_timestamp,))

        rows = cursor.fetchall()
        conn.close()

        # 按时间戳分组
        data_by_time = {}
        for row in rows:
            ts = row["timestamp"]
            if ts not in data_by_time:
                data_by_time[ts] = {}

            data_by_time[ts][row["source"]] = {
                "uploaded": row["uploaded"],
                "downloaded": row["downloaded"]
            }

        # 转换为列表
        result = []
        for ts in sorted(data_by_time.keys()):
            result.append({
                "timestamp": ts,
                "mteam": data_by_time[ts].get("mteam", {}),
                "qbittorrent": data_by_time[ts].get("qbittorrent", {})
            })

        return result
    except Exception as e:
        logger.error(f"获取流量历史失败: {e}")
        return []


async def get_share_ratio_history(hours: int) -> Tuple[List[Dict], Dict]:
    """
    获取分享率历史数据

    Args:
        hours: 小时数

    Returns:
        Tuple[List[Dict], Dict]: (数据点列表, 统计信息)
    """
    try:
        from_timestamp = int((datetime.utcnow() - timedelta(hours=hours)).timestamp())

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT timestamp, share_ratio
            FROM user_stats
            WHERE timestamp >= ?
            ORDER BY timestamp ASC
        """, (from_timestamp,))

        rows = cursor.fetchall()
        conn.close()

        if not rows:
            return [], {}

        data_points = [
            {"timestamp": row["timestamp"], "share_ratio": row["share_ratio"]}
            for row in rows
        ]

        ratios = [row["share_ratio"] for row in rows]
        current = ratios[-1]
        highest = max(ratios)
        lowest = min(ratios)

        # 计算24小时变化
        change_24h = 0
        if len(ratios) >= 2:
            # 找到24小时前的数据点
            target_ts = int(datetime.utcnow().timestamp()) - 86400
            closest_idx = 0
            min_diff = abs(rows[0]["timestamp"] - target_ts)
            for i, row in enumerate(rows):
                diff = abs(row["timestamp"] - target_ts)
                if diff < min_diff:
                    min_diff = diff
                    closest_idx = i

            if closest_idx < len(ratios):
                change_24h = current - ratios[closest_idx]

        stats = {
            "current": current,
            "highest": highest,
            "lowest": lowest,
            "change_24h": round(change_24h, 2)
        }

        return data_points, stats
    except Exception as e:
        logger.error(f"获取分享率历史失败: {e}")
        return [], {}
```

**Step 2: Add aggregation function**

Add to `release/app/services/panel_db.py`:

```python
def aggregate_data(data_points: List[Dict], interval_seconds: int) -> List[Dict]:
    """
    聚合数据点

    Args:
        data_points: 原始数据点
        interval_seconds: 聚合间隔(秒)

    Returns:
        List[Dict]: 聚合后的数据点
    """
    if not data_points:
        return []

    aggregated = {}

    for point in data_points:
        # 计算聚合bucket
        bucket = (point["timestamp"] // interval_seconds) * interval_seconds

        if bucket not in aggregated:
            aggregated[bucket] = {
                "timestamp": bucket,
                "mteam": {"uploaded": 0, "downloaded": 0},
                "qbittorrent": {"uploaded": 0, "downloaded": 0},
                "count": 0
            }

        # 累加数据 (取最大值,因为是累计量)
        if "mteam" in point and point["mteam"]:
            aggregated[bucket]["mteam"]["uploaded"] = max(
                aggregated[bucket]["mteam"]["uploaded"],
                point["mteam"].get("uploaded", 0)
            )
            aggregated[bucket]["mteam"]["downloaded"] = max(
                aggregated[bucket]["mteam"]["downloaded"],
                point["mteam"].get("downloaded", 0)
            )

        if "qbittorrent" in point and point["qbittorrent"]:
            aggregated[bucket]["qbittorrent"]["uploaded"] = max(
                aggregated[bucket]["qbittorrent"]["uploaded"],
                point["qbittorrent"].get("uploaded", 0)
            )
            aggregated[bucket]["qbittorrent"]["downloaded"] = max(
                aggregated[bucket]["qbittorrent"]["downloaded"],
                point["qbittorrent"].get("downloaded", 0)
            )

        aggregated[bucket]["count"] += 1

    # 转换为列表并排序
    result = []
    for bucket in sorted(aggregated.keys()):
        data = aggregated[bucket]
        result.append({
            "timestamp": data["timestamp"],
            "mteam": data["mteam"],
            "qbittorrent": data["qbittorrent"]
        })

    return result
```

**Step 3: Add historical data endpoints**

Add to `release/app/routes/panel.py`:

```python
from app.services.panel_db import get_traffic_history, get_share_ratio_history, aggregate_data


@router.get("/api/panel/history")
async def get_panel_history(range: str = "24h") -> Dict:
    """
    获取历史数据

    Args:
        range: 时间范围 (24h, 7d, 30d)
    """
    try:
        # 解析时间范围
        range_hours = {
            "24h": 24,
            "7d": 168,
            "30d": 720
        }
        hours = range_hours.get(range, 24)

        # 获取原始数据
        data_points = await get_traffic_history(hours)

        if not data_points:
            return {
                "range": range,
                "data_points": [],
                "aggregation": "none"
            }

        # 根据范围决定聚合策略
        if range == "24h":
            # 5分钟原始数据
            aggregation = "5min"
            aggregated = data_points
        elif range == "7d":
            # 按小时聚合
            aggregation = "1hour"
            aggregated = aggregate_data(data_points, 3600)
        else:  # 30d
            # 按天聚合
            aggregation = "1day"
            aggregated = aggregate_data(data_points, 86400)

        return {
            "range": range,
            "data_points": aggregated,
            "aggregation": aggregation
        }

    except Exception as e:
        logger.error(f"获取历史数据失败: {e}")
        return {
            "range": range,
            "data_points": [],
            "aggregation": "none"
        }


@router.get("/api/panel/share-ratio")
async def get_share_ratio_history_endpoint(range: str = "24h") -> Dict:
    """获取分享率历史"""
    try:
        range_hours = {
            "24h": 24,
            "7d": 168,
            "30d": 720
        }
        hours = range_hours.get(range, 24)

        data_points, stats = await get_share_ratio_history(hours)

        return {
            "data_points": data_points,
            "current": stats.get("current", 0),
            "highest": stats.get("highest", 0),
            "lowest": stats.get("lowest", 0),
            "change_24h": stats.get("change_24h", 0)
        }

    except Exception as e:
        logger.error(f"获取分享率历史失败: {e}")
        return {
            "data_points": [],
            "current": 0,
            "highest": 0,
            "lowest": 0,
            "change_24h": 0
        }
```

**Step 4: Test historical APIs**

```bash
cd release
python3 -m uvicorn app.main:app --reload &
sleep 5
curl "http://localhost:8000/api/panel/history?range=24h" | python3 -m json.tool
curl "http://localhost:8000/api/panel/share-ratio?range=24h" | python3 -m json.tool
kill %1
```

Expected: JSON responses with data_points arrays

**Step 5: Commit historical APIs**

```bash
cd release
git add app/routes/panel.py app/services/panel_db.py
git commit -m "feat(panel): add historical data API endpoints

- GET /api/panel/history with 24h/7d/30d ranges
- GET /api/panel/share-ratio with stats
- Smart aggregation (5min/1hour/1day)
- Data aggregation uses max for cumulative values"
```

---

## Task 6: Frontend - HTML Template

**Files:**
- Create: `release/app/templates/panel.html`

**Step 1: Create panel.html template**

Create `release/app/templates/panel.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PANEL - MT-Engine</title>

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DotGothic16&family=Inter:wght@400;500;600&family=Roboto+Mono:wght@400;500;700&display=swap" rel="stylesheet">

    <!-- CSS -->
    <link rel="stylesheet" href="{{ url_for('static', path='/css/variables.css') }}">
    <link rel="stylesheet" href="{{ url_for('static', path='/css/base.css') }}">
    <link rel="stylesheet" href="{{ url_for('static', path='/css/layout.css') }}">
    <link rel="stylesheet" href="{{ url_for('static', path='/css/components.css') }}">
    <link rel="stylesheet" href="{{ url_for('static', path='/css/modules/navbar.css') }}">
    <link rel="stylesheet" href="{{ url_for('static', path='/css/modules/toast.css') }}">
    <link rel="stylesheet" href="{{ url_for('static', path='/css/modules/panel.css') }}">

    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>

    <!-- Favicon -->
    <link rel="icon" type="image/png" href="{{ url_for('static', path='/favicon.png') }}">
</head>
<body>
    <!-- Navbar -->
    <nav class="navbar">
        <div class="navbar-container">
            <div class="navbar-left">
                <span class="navbar-title">MT-ENGINE</span>
                <span class="navbar-subtitle">PANEL</span>
            </div>
            <div class="navbar-right">
                <button id="theme-toggle" class="icon-button" aria-label="Toggle theme">
                    <span class="theme-icon">◐</span>
                </button>
            </div>
        </div>
    </nav>

    <!-- Main Content -->
    <main class="container">
        <!-- Stats Cards Grid -->
        <section class="stats-grid">
            <!-- Card: Share Ratio -->
            <div class="stat-card" id="card-share-ratio">
                <div class="stat-label">分享率</div>
                <div class="stat-value">--</div>
                <div class="stat-trend">
                    <svg class="mini-chart"></svg>
                    <span class="stat-change">--</span>
                </div>
            </div>

            <!-- Card: Uploaded -->
            <div class="stat-card" id="card-uploaded">
                <div class="stat-label">总上传量</div>
                <div class="stat-value">--</div>
                <div class="stat-subvalue">M-Team</div>
            </div>

            <!-- Card: Downloaded -->
            <div class="stat-card" id="card-downloaded">
                <div class="stat-label">总下载量</div>
                <div class="stat-value">--</div>
                <div class="stat-subvalue">M-Team</div>
            </div>

            <!-- Card: Bonus -->
            <div class="stat-card" id="card-bonus">
                <div class="stat-label">魔力值</div>
                <div class="stat-value">--</div>
            </div>

            <!-- Card: Seeding -->
            <div class="stat-card" id="card-seeding">
                <div class="stat-label">做种数</div>
                <div class="stat-value">--</div>
            </div>

            <!-- Card: Leeching -->
            <div class="stat-card" id="card-leeching">
                <div class="stat-label">下载数</div>
                <div class="stat-value">--</div>
            </div>

            <!-- Card: User Level -->
            <div class="stat-card" id="card-level">
                <div class="stat-label">用户等级</div>
                <div class="stat-value">--</div>
            </div>

            <!-- Card: Last Update -->
            <div class="stat-card" id="card-update">
                <div class="stat-label">最后更新</div>
                <div class="stat-value last-update-time">--</div>
            </div>
        </section>

        <!-- Chart Controls -->
        <section class="chart-controls">
            <div class="range-buttons">
                <button class="range-btn active" data-range="24h">24H</button>
                <button class="range-btn" data-range="7d">7D</button>
                <button class="range-btn" data-range="30d">30D</button>
            </div>
        </section>

        <!-- Traffic Trend Chart -->
        <section class="chart-container">
            <h3 class="chart-title">上传/下载趋势</h3>
            <canvas id="traffic-chart"></canvas>
        </section>

        <!-- Daily Total Chart -->
        <section class="chart-container">
            <h3 class="chart-title">每日总量对比</h3>
            <canvas id="daily-chart"></canvas>
        </section>

        <!-- Share Ratio Chart -->
        <section class="chart-container">
            <h3 class="chart-title">分享率变化</h3>
            <canvas id="ratio-chart"></canvas>
        </section>
    </main>

    <!-- Toast Container -->
    <div id="toast-container" class="toast-container"></div>

    <!-- JavaScript -->
    <script src="{{ url_for('static', path='/js/config.js') }}"></script>
    <script src="{{ url_for('static', path='/js/utils.js') }}"></script>
    <script src="{{ url_for('static', path='/js/components/theme.js') }}"></script>
    <script src="{{ url_for('static', path='/js/components/toast.js') }}"></script>
    <script src="{{ url_for('static', path='/js/components/chart.js') }}"></script>
    <script src="{{ url_for('static', path='/js/components/stats-card.js') }}"></script>
    <script src="{{ url_for('static', path='/js/pages/panel.js') }}"></script>
</body>
</html>
```

**Step 2: Test template rendering**

```bash
cd release
python3 -m uvicorn app.main:app --reload &
sleep 5
curl http://localhost:8000/panel
kill %1
```

Expected: HTML response with PANEL template

**Step 3: Commit HTML template**

```bash
cd release
git add app/templates/panel.html
git commit -m "feat(panel): add HTML template with stats cards and chart placeholders

- 8 stat cards in responsive grid
- 3 chart containers with Canvas elements
- Time range toggle buttons (24H/7D/30D)
- Nothing OS design system integration"
```

---

## Task 7: Frontend - CSS Styles

**Files:**
- Create: `release/app/static/css/modules/panel.css`

**Step 1: Create panel.css**

Create `release/app/static/css/modules/panel.css`:

```css
/* PANEL Styles - Nothing OS Design */

/* Stats Grid */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 32px;
}

@media (max-width: 1024px) {
    .stats-grid {
        grid-template-columns: repeat(3, 1fr);
    }
}

@media (max-width: 768px) {
    .stats-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

/* Stat Card */
.stat-card {
    background: var(--nt-bg-secondary);
    border: 1px dotted var(--nt-border);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: border-style 0.2s;
}

@media (hover: hover) {
    .stat-card:hover {
        border-style: solid;
    }
}

.stat-label {
    font-family: 'DotGothic16', sans-serif;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--nt-text-secondary);
}

.stat-value {
    font-family: 'Roboto Mono', monospace;
    font-size: 28px;
    font-weight: 700;
    color: var(--nt-text-primary);
    line-height: 1.2;
}

.stat-subvalue {
    font-family: 'Roboto Mono', monospace;
    font-size: 10px;
    color: var(--nt-text-tertiary);
}

.stat-trend {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
}

.mini-chart {
    width: 60px;
    height: 20px;
    color: var(--nt-text-secondary);
}

.stat-change {
    font-family: 'Roboto Mono', monospace;
    font-size: 11px;
}

.stat-change.positive {
    color: #4CAF50;
}

.stat-change.negative {
    color: var(--nt-red);
}

.last-update-time {
    font-size: 11px;
    font-weight: 400;
}

/* Chart Controls */
.chart-controls {
    margin-bottom: 24px;
}

.range-buttons {
    display: flex;
    gap: 8px;
}

.range-btn {
    font-family: 'DotGothic16', sans-serif;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 8px 16px;
    border: 1px dotted var(--nt-border);
    background: transparent;
    color: var(--nt-text-primary);
    cursor: pointer;
    transition: all 0.2s;
}

.range-btn.active {
    background: var(--nt-text-primary);
    color: var(--nt-bg-primary);
    border-style: solid;
}

@media (hover: hover) {
    .range-btn:hover:not(.active) {
        border-style: solid;
    }
}

/* Chart Container */
.chart-container {
    background: var(--nt-bg-secondary);
    border: 1px dotted var(--nt-border);
    padding: 24px;
    margin-bottom: 24px;
}

.chart-title {
    font-family: 'DotGothic16', sans-serif;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 16px;
    color: var(--nt-text-primary);
}

.chart-container canvas {
    width: 100% !important;
    height: 400px !important;
}

/* Loading State */
.stat-card.loading .stat-value,
.stat-card.loading .stat-change {
    opacity: 0.3;
}

/* Empty State */
.chart-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 400px;
    font-family: 'Roboto Mono', monospace;
    font-size: 12px;
    color: var(--nt-text-tertiary);
}
```

**Step 2: Test CSS loading**

Open browser to http://localhost:8000/panel and verify:
- Stats cards in grid layout
- Buttons styled correctly
- Chart containers have proper spacing

**Step 3: Commit CSS styles**

```bash
cd release
git add app/static/css/modules/panel.css
git commit -m "feat(panel): add Nothing OS styled CSS for PANEL page

- Responsive grid layout (4/3/2 columns)
- Stat card styles with hover effects
- Time range button styles
- Chart container styles
- Color-coded stat changes (green/red)"
```

---

## Task 8: Frontend - JavaScript Chart Component

**Files:**
- Create: `release/app/static/js/components/chart.js`

**Step 1: Create chart component**

Create `release/app/static/js/components/chart.js`:

```javascript
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
```

**Step 2: Test chart functions exist**

Add to browser console:
```javascript
console.log(typeof createTrafficChart); // Should be 'function'
```

**Step 3: Commit chart component**

```bash
cd release
git add app/static/js/components/chart.js
git commit -m "feat(panel): add Chart.js wrapper component

- Nothing OS styled chart options
- Traffic trend line chart creator
- Daily bar chart creator
- Share ratio chart creator
- Beijing time formatter
- Decimal file size formatter"
```

---

## Task 9: Frontend - Stats Card Component

**Files:**
- Create: `release/app/static/js/components/stats-card.js`

**Step 1: Create stats card component**

Create `release/app/static/js/components/stats-card.js`:

```javascript
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
```

**Step 2: Commit stats card component**

```bash
cd release
git add app/static/js/components/stats-card.js
git commit -m "feat(panel): add stats card update component

- updateStatCard() for single card update
- updateStatTrend() for trend display
- drawMiniChart() SVG sparkline generator
- updateAllStatCards() batch updater
- updateLastUpdateTime() with Beijing time"
```

---

## Task 10: Frontend - Main Panel JavaScript

**Files:**
- Create: `release/app/static/js/pages/panel.js`

**Step 1: Create panel.js main logic**

Create `release/app/static/js/pages/panel.js`:

```javascript
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
```

**Step 2: Test page initialization**

Open browser to http://localhost:8000/panel and check:
- Console shows "PANEL initialized"
- Stats cards update with data
- Charts render (or show "暂无数据" if DB empty)
- Time range buttons work

**Step 3: Commit main panel JS**

```bash
cd release
git add app/static/js/pages/panel.js
git commit -m "feat(panel): add main page JavaScript logic

- Auto-initialize on page load
- Load real-time stats from API
- Render 3 charts with historical data
- Time range switching (24H/7D/30D)
- Auto-refresh every 5 minutes
- Calculate daily totals from cumulative data"
```

---

## Task 11: Testing and Bug Fixes

**Files:**
- Test all components end-to-end

**Step 1: Start application and collect data**

```bash
cd release
python3 -m uvicorn app.main:app --reload &
echo "Waiting for data collection..."
sleep 360  # Wait 6 minutes for at least one data point
```

**Step 2: Manual testing checklist**

Open http://localhost:8000/panel and verify:

- [ ] All 8 stat cards display values
- [ ] Share ratio card shows trend line
- [ ] Traffic trend chart displays 4 lines
- [ ] Daily bar chart shows data
- [ ] Share ratio chart displays
- [ ] 24H/7D/30D buttons switch views
- [ ] Page auto-refreshes after 5 minutes
- [ ] Last update time shows Beijing time
- [ ] Dark/light theme works
- [ ] Mobile responsive layout works

**Step 3: Check database**

```bash
sqlite3 release/data/panel.db "SELECT COUNT(*) FROM traffic_stats;"
sqlite3 release/data/panel.db "SELECT COUNT(*) FROM user_stats;"
```

Expected: At least 1 row in each table

**Step 4: Check logs**

```bash
tail -f MT-Engine/logs/app.log | grep PANEL
```

Expected: See "采集 qBittorrent 数据成功" and "采集 M-Team 数据成功"

**Step 5: Fix any bugs found**

Document and fix issues:
- [ ] API errors
- [ ] Chart rendering issues
- [ ] Data collection failures
- [ ] UI/UX problems

**Step 6: Stop test server**

```bash
kill %1
```

**Step 7: Commit bug fixes**

```bash
cd release
git add .
git commit -m "fix(panel): address testing issues

[List specific fixes made]"
```

---

## Task 12: Update Documentation

**Files:**
- Modify: `release/agent.md`
- Modify: `release/.gitignore` (verify)

**Step 1: Update AGENT.md**

Add PANEL section to `release/agent.md` (after line 103, in "Key Endpoints" section):

```markdown
    - `GET /panel` - PANEL (面板) page
    - `GET /api/panel/stats` - Get real-time stats (M-Team + qBittorrent)
    - `GET /api/panel/history?range=24h|7d|30d` - Get historical traffic data
    - `GET /api/panel/share-ratio?range=24h|7d|30d` - Get share ratio history
```

Add PANEL description (after line 11, in "Purpose" section):

```markdown
4. **PANEL (面板)** - Personal dashboard with 30-day data tracking and trend visualization
```

**Step 2: Verify .gitignore**

Check `release/.gitignore` contains:

```
data/panel.db
data/panel.db-journal
```

**Step 3: Commit documentation**

```bash
cd release
git add agent.md .gitignore
git commit -m "docs: update AGENT.md with PANEL endpoints and description"
```

---

## Task 13: Final Integration and Deployment Prep

**Files:**
- Verify all files ready for deployment

**Step 1: Run full application test**

```bash
cd release
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
sleep 10

# Test all endpoints
curl http://localhost:8000/panel
curl http://localhost:8000/api/panel/stats
curl "http://localhost:8000/api/panel/history?range=24h"
curl "http://localhost:8000/api/panel/share-ratio?range=24h"

kill %1
```

All requests should return 200 OK

**Step 2: Check Docker compatibility**

Verify no hardcoded paths that break in Docker:
- Database path uses `Path(__file__).parent`
- All static files use `url_for()`
- No absolute paths to `/Users/...`

**Step 3: Create deployment checklist**

Create `release/docs/panel-deployment.md`:

```markdown
# PANEL Deployment Checklist

## Pre-deployment
- [ ] Database initialized on startup
- [ ] Data directory in Docker volume
- [ ] .gitignore excludes panel.db
- [ ] All API endpoints tested
- [ ] Frontend charts render
- [ ] Auto-refresh works

## Post-deployment
- [ ] Wait 5+ minutes for data collection
- [ ] Verify stats cards populate
- [ ] Verify charts display data
- [ ] Test time range switching
- [ ] Check logs for errors

## Troubleshooting
- No data: Wait for background task (runs every 5 min)
- Charts empty: Check API responses in browser console
- Database errors: Check `data/` directory permissions
```

**Step 4: Final commit**

```bash
cd release
git add docs/panel-deployment.md
git commit -m "docs: add PANEL deployment checklist"
```

**Step 5: Create feature branch summary**

```bash
cd release
git log --oneline --since="2026-01-26" > /tmp/panel-commits.txt
cat /tmp/panel-commits.txt
```

Review all commits for quality

---

## Execution Complete

**Plan saved to:** `docs/plans/2026-01-26-panel-implementation.md`

**Estimated time:** 4-6 hours (assuming no major issues)

**Key milestones:**
1. Database layer (30 min)
2. Data collection (45 min)
3. API endpoints (60 min)
4. Frontend HTML/CSS (45 min)
5. Frontend JavaScript (90 min)
6. Testing & debugging (60 min)
7. Documentation (30 min)

**Next steps:**
1. Follow tasks sequentially
2. Test after each commit
3. Fix bugs immediately
4. Deploy using `deploy.sh`
