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
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT OR REPLACE INTO traffic_stats
            (timestamp, source, uploaded, downloaded, upload_speed, download_speed)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (timestamp, source, uploaded, downloaded, upload_speed, download_speed))

        conn.commit()
        return True
    except Exception as e:
        logger.error(f"保存流量统计失败: {e}")
        return False
    finally:
        if conn:
            conn.close()


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
    conn = None
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
        return True
    except Exception as e:
        logger.error(f"保存用户统计失败: {e}")
        return False
    finally:
        if conn:
            conn.close()


async def cleanup_old_data(days: int = 30):
    """删除指定天数之前的数据"""
    conn = None
    try:
        cutoff_timestamp = int((datetime.utcnow() - timedelta(days=days)).timestamp())

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("DELETE FROM traffic_stats WHERE timestamp < ?", (cutoff_timestamp,))
        deleted_traffic = cursor.rowcount

        cursor.execute("DELETE FROM user_stats WHERE timestamp < ?", (cutoff_timestamp,))
        deleted_user = cursor.rowcount

        conn.commit()

        logger.info(f"清理旧数据完成: traffic_stats={deleted_traffic}, user_stats={deleted_user}")
        return True
    except Exception as e:
        logger.error(f"清理旧数据失败: {e}")
        return False
    finally:
        if conn:
            conn.close()


async def get_latest_stats() -> Optional[Dict]:
    """获取最新的统计数据"""
    conn = None
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
    finally:
        if conn:
            conn.close()


def get_traffic_history(hours: int) -> List[Dict]:
    """获取流量历史数据

    Args:
        hours: 查询的小时数

    Returns:
        数据点列表，格式: [
            {
                "timestamp": 1234567890,
                "mteam": {"uploaded": 123, "downloaded": 456},
                "qbittorrent": {"uploaded": 789, "downloaded": 101112}
            }
        ]
    """
    conn = None
    try:
        cutoff_timestamp = int((datetime.utcnow() - timedelta(hours=hours)).timestamp())

        conn = get_db_connection()
        cursor = conn.cursor()

        # 查询指定时间范围内的所有数据点
        cursor.execute("""
            SELECT timestamp, source, uploaded, downloaded
            FROM traffic_stats
            WHERE timestamp >= ?
            ORDER BY timestamp ASC
        """, (cutoff_timestamp,))

        rows = cursor.fetchall()

        # 按时间戳组织数据
        data_by_timestamp = {}
        for row in rows:
            timestamp = row["timestamp"]
            source = row["source"]

            if timestamp not in data_by_timestamp:
                data_by_timestamp[timestamp] = {
                    "timestamp": timestamp,
                    "mteam": {"uploaded": 0, "downloaded": 0},
                    "qbittorrent": {"uploaded": 0, "downloaded": 0}
                }

            data_by_timestamp[timestamp][source] = {
                "uploaded": row["uploaded"],
                "downloaded": row["downloaded"]
            }

        # 转换为列表并排序
        result = sorted(data_by_timestamp.values(), key=lambda x: x["timestamp"])
        return result

    except Exception as e:
        logger.error(f"获取流量历史失败: {e}")
        return []
    finally:
        if conn:
            conn.close()


def get_share_ratio_history(hours: int) -> Tuple[List[Dict], Dict]:
    """获取分享率历史数据

    Args:
        hours: 查询的小时数

    Returns:
        (数据点列表, 统计信息)
        数据点格式: [{"timestamp": 1234567890, "share_ratio": 1.23}]
        统计信息格式: {
            "current": 1.23,
            "highest": 1.50,
            "lowest": 1.00,
            "change_24h": 0.05
        }
    """
    conn = None
    try:
        cutoff_timestamp = int((datetime.utcnow() - timedelta(hours=hours)).timestamp())

        conn = get_db_connection()
        cursor = conn.cursor()

        # 查询指定时间范围内的分享率数据
        cursor.execute("""
            SELECT timestamp, share_ratio
            FROM user_stats
            WHERE timestamp >= ?
            ORDER BY timestamp ASC
        """, (cutoff_timestamp,))

        rows = cursor.fetchall()

        if not rows:
            return [], {}

        # 转换为列表
        data_points = [
            {"timestamp": row["timestamp"], "share_ratio": row["share_ratio"]}
            for row in rows
        ]

        # 计算统计信息
        ratios = [point["share_ratio"] for point in data_points]
        current = ratios[-1] if ratios else 0
        highest = max(ratios) if ratios else 0
        lowest = min(ratios) if ratios else 0

        # 计算24小时变化
        change_24h = 0
        timestamp_24h_ago = int((datetime.utcnow() - timedelta(hours=24)).timestamp())
        # 找到最接近24小时前的数据点
        past_ratio = None
        for idx, point in enumerate(data_points):
            if point["timestamp"] >= timestamp_24h_ago:
                if past_ratio is None:
                    # 使用前一个点作为24小时前的值（如果存在）
                    if idx > 0:
                        past_ratio = data_points[idx - 1]["share_ratio"]
                    else:
                        past_ratio = point["share_ratio"]
                break

        if past_ratio is not None:
            change_24h = current - past_ratio

        stats = {
            "current": round(current, 3),
            "highest": round(highest, 3),
            "lowest": round(lowest, 3),
            "change_24h": round(change_24h, 3)
        }

        return data_points, stats

    except Exception as e:
        logger.error(f"获取分享率历史失败: {e}")
        return [], {}
    finally:
        if conn:
            conn.close()


def aggregate_data(data_points: List[Dict], interval_seconds: int) -> List[Dict]:
    """聚合数据点

    将数据点按时间间隔分组，每组取最大值（因为是累计值）

    Args:
        data_points: 原始数据点列表
        interval_seconds: 聚合间隔（秒）

    Returns:
        聚合后的数据点列表
    """
    if not data_points or interval_seconds <= 0:
        return data_points

    try:
        # 按时间桶分组
        buckets = {}
        for point in data_points:
            timestamp = point["timestamp"]
            bucket_key = (timestamp // interval_seconds) * interval_seconds

            if bucket_key not in buckets:
                buckets[bucket_key] = []
            buckets[bucket_key].append(point)

        # 对每个桶内的数据取最大值
        result = []
        for bucket_timestamp in sorted(buckets.keys()):
            bucket_points = buckets[bucket_timestamp]

            # 根据数据结构决定如何聚合
            if "share_ratio" in bucket_points[0]:
                # 分享率数据：取最大值
                max_ratio = max(p["share_ratio"] for p in bucket_points)
                result.append({
                    "timestamp": bucket_timestamp,
                    "share_ratio": max_ratio
                })
            elif "mteam" in bucket_points[0]:
                # 流量数据：取最大值
                max_mteam_up = max(p["mteam"]["uploaded"] for p in bucket_points)
                max_mteam_down = max(p["mteam"]["downloaded"] for p in bucket_points)
                max_qb_up = max(p["qbittorrent"]["uploaded"] for p in bucket_points)
                max_qb_down = max(p["qbittorrent"]["downloaded"] for p in bucket_points)

                result.append({
                    "timestamp": bucket_timestamp,
                    "mteam": {
                        "uploaded": max_mteam_up,
                        "downloaded": max_mteam_down
                    },
                    "qbittorrent": {
                        "uploaded": max_qb_up,
                        "downloaded": max_qb_down
                    }
                })

        return result

    except Exception as e:
        logger.error(f"聚合数据失败: {e}")
        return data_points


def calculate_30min_avg_speeds() -> Dict:
    """计算过去30分钟的平均上传/下载速度

    Returns:
        {
            "upload": bytes/s,
            "download": bytes/s
        }
    """
    conn = None
    try:
        # 获取30分钟前和现在的时间戳
        now = datetime.utcnow()
        time_30min_ago = now - timedelta(minutes=30)
        timestamp_now = int(now.timestamp())
        timestamp_30min_ago = int(time_30min_ago.timestamp())

        logger.info(f"计算30分钟平均速度: 开始时间={timestamp_30min_ago}, 结束时间={timestamp_now}")

        conn = get_db_connection()
        cursor = conn.cursor()

        # 获取30分钟前最接近的数据点（qbittorrent）
        cursor.execute("""
            SELECT uploaded, downloaded, timestamp
            FROM traffic_stats
            WHERE source = 'qbittorrent' AND timestamp >= ?
            ORDER BY timestamp ASC
            LIMIT 1
        """, (timestamp_30min_ago,))

        start_row = cursor.fetchone()

        # 获取最新的数据点（qbittorrent）
        cursor.execute("""
            SELECT uploaded, downloaded, timestamp
            FROM traffic_stats
            WHERE source = 'qbittorrent'
            ORDER BY timestamp DESC
            LIMIT 1
        """)

        end_row = cursor.fetchone()

        # 如果没有足够的历史数据，返回0
        if not start_row or not end_row:
            logger.warning(f"没有足够的历史数据计算30分钟平均速度: start_row={start_row}, end_row={end_row}")
            return {"upload": 0, "download": 0}

        logger.info(f"开始数据点: timestamp={start_row['timestamp']}, up={start_row['uploaded']}, down={start_row['downloaded']}")
        logger.info(f"结束数据点: timestamp={end_row['timestamp']}, up={end_row['uploaded']}, down={end_row['downloaded']}")

        # 计算时间差（秒）
        time_diff = end_row["timestamp"] - start_row["timestamp"]

        logger.info(f"时间差: {time_diff}秒")

        # 如果时间差小于1秒，避免除以0
        if time_diff < 1:
            logger.warning(f"时间差小于1秒: {time_diff}")
            return {"upload": 0, "download": 0}

        # 计算流量增量
        upload_delta = end_row["uploaded"] - start_row["uploaded"]
        download_delta = end_row["downloaded"] - start_row["downloaded"]

        logger.info(f"流量增量: upload={upload_delta}, download={download_delta}")

        # 计算平均速度（bytes/s）
        avg_upload_speed = max(0, upload_delta / time_diff)
        avg_download_speed = max(0, download_delta / time_diff)

        logger.info(f"平均速度: upload={avg_upload_speed} B/s, download={avg_download_speed} B/s")

        return {
            "upload": int(avg_upload_speed),
            "download": int(avg_download_speed)
        }

    except Exception as e:
        logger.error(f"计算30分钟平均速度失败: {e}")
        return {"upload": 0, "download": 0}
    finally:
        if conn:
            conn.close()
