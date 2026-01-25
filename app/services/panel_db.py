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
