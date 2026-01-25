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
