"""
PANEL 数据采集服务
"""

from datetime import datetime
from app.config import logger
from app.services.panel_db import save_traffic_stats, save_user_stats, cleanup_old_data
from app.services.qbittorrent import qb_login, qb_get_mteam_stats
from app.state import user_profile


async def collect_panel_data():
    """采集 PANEL 数据并存储到数据库"""
    timestamp = int(datetime.utcnow().timestamp())

    # 1. 采集 qBittorrent 数据
    qb_seeding_count = 0
    qb_leeching_count = 0
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
            # 获取 qBittorrent 的做种/下载数
            qb_seeding_count = qb_stats.get('seeding_count', 0)
            qb_leeching_count = qb_stats.get('leeching_count', 0)
            logger.info(f"采集 qBittorrent 数据成功")
    except Exception as e:
        logger.error(f"采集 qBittorrent 数据失败: {e}")

    # 2. 使用已缓存的 M-Team 用户资料（由 fetch_all_free_torrents 刷新，避免重复调用 API）
    try:
        profile = user_profile
        if profile and profile.get('uploaded') is not None:
            await save_traffic_stats(
                timestamp=timestamp,
                source='mteam',
                uploaded=profile['uploaded'],
                downloaded=profile['downloaded']
            )

            # 使用 qBittorrent 的做种/下载数
            await save_user_stats(
                timestamp=timestamp,
                share_ratio=profile['share_ratio'],
                uploaded=profile['uploaded'],
                downloaded=profile['downloaded'],
                seeding_count=qb_seeding_count,
                leeching_count=qb_leeching_count
            )
            logger.info(f"采集 M-Team 数据成功")
        else:
            logger.warning("无缓存的用户资料，跳过 M-Team 数据采集")
    except Exception as e:
        logger.error(f"采集 M-Team 数据失败: {e}")


async def cleanup_panel_data():
    """清理30天前的数据"""
    await cleanup_old_data(days=30)
