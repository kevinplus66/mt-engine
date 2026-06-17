"""
PANEL 数据采集服务
"""

from datetime import datetime, timedelta
from typing import Dict, Optional
from app.config import BEIJING_TZ, logger, PANEL_COLLECT_INTERVAL
from app.services.panel_db import save_panel_stats_batch
from app.services.qbittorrent import qb_login, qb_get_mteam_stats
import app.state as state


collector_status: Dict[str, Optional[object]] = {
    "last_started": None,
    "last_success": None,
    "last_error": None,
    "last_duration_seconds": None,
}


def _iso_now() -> str:
    return datetime.now(BEIJING_TZ).isoformat()


def get_panel_collector_status() -> Dict[str, Optional[object]]:
    """Return PANEL collector heartbeat without probing external services."""
    last_success = collector_status.get("last_success")
    last_started = collector_status.get("last_started")
    stale_after_seconds = max(PANEL_COLLECT_INTERVAL * 3, 180)
    last_success_dt = _parse_iso_datetime(last_success)
    heartbeat_dt = _parse_iso_datetime(last_started or last_success)
    now = (
        datetime.now(heartbeat_dt.tzinfo)
        if heartbeat_dt and heartbeat_dt.tzinfo
        else datetime.now(BEIJING_TZ)
    )
    next_refresh = (
        (last_success_dt + timedelta(seconds=PANEL_COLLECT_INTERVAL)).isoformat()
        if last_success_dt
        else None
    )
    heartbeat_age_seconds = (
        (now - heartbeat_dt).total_seconds() if heartbeat_dt else None
    )
    stale = (
        heartbeat_age_seconds is not None
        and heartbeat_age_seconds > stale_after_seconds
    )

    return {
        "last_started": last_started,
        "last_success": last_success,
        "last_error": collector_status.get("last_error"),
        "last_duration_seconds": collector_status.get("last_duration_seconds"),
        "next_refresh": next_refresh,
        "heartbeat_age_seconds": heartbeat_age_seconds,
        "stale": stale,
        "stale_after_seconds": stale_after_seconds,
    }


def _parse_iso_datetime(value: Optional[object]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


async def collect_panel_data():
    """采集 PANEL 数据并存储到数据库"""
    started_at = datetime.now(BEIJING_TZ)
    collector_status["last_started"] = started_at.isoformat()
    collector_status["last_error"] = None
    errors = []
    timestamp = int(started_at.timestamp())

    # 1. 采集 qBittorrent 数据
    qb_seeding_count = 0
    qb_leeching_count = 0
    qb_traffic_stats = None
    try:
        sid = await qb_login()
        if sid:
            qb_stats = await qb_get_mteam_stats(sid)
            qb_traffic_stats = {
                "uploaded": qb_stats['uploaded'],
                "downloaded": qb_stats['downloaded'],
                "upload_speed": qb_stats.get('upload_speed', 0),
                "download_speed": qb_stats.get('download_speed', 0),
            }
            # 获取 qBittorrent 的做种/下载数
            qb_seeding_count = qb_stats.get('seeding_count', 0)
            qb_leeching_count = qb_stats.get('leeching_count', 0)
            logger.info(f"采集 qBittorrent 数据成功")
    except Exception as e:
        message = f"采集 qBittorrent 数据失败: {e}"
        errors.append(message)
        logger.error(message)

    # 2. 使用已缓存的 M-Team 用户资料（由 fetch_all_free_torrents 刷新，避免重复调用 API）
    mteam_traffic_stats = None
    user_stats = None
    try:
        profile = state.user_profile
        if state.has_real_user_profile(profile):
            mteam_traffic_stats = {
                "uploaded": profile['uploaded'],
                "downloaded": profile['downloaded'],
            }

            # 使用 qBittorrent 的做种/下载数
            user_stats = {
                "share_ratio": profile['share_ratio'],
                "uploaded": profile['uploaded'],
                "downloaded": profile['downloaded'],
                "seeding_count": qb_seeding_count,
                "leeching_count": qb_leeching_count,
            }
            logger.info(f"采集 M-Team 数据成功")
        else:
            logger.warning("无缓存的用户资料，跳过 M-Team 数据采集")
    except Exception as e:
        message = f"采集 M-Team 数据失败: {e}"
        errors.append(message)
        logger.error(message)
    finally:
        if qb_traffic_stats or mteam_traffic_stats or user_stats:
            await save_panel_stats_batch(
                timestamp=timestamp,
                qb_traffic=qb_traffic_stats,
                mteam_traffic=mteam_traffic_stats,
                user_stats=user_stats,
            )
        collector_status["last_duration_seconds"] = (
            datetime.now(BEIJING_TZ) - started_at
        ).total_seconds()
        if errors:
            collector_status["last_error"] = "; ".join(errors)
        else:
            collector_status["last_success"] = _iso_now()
            collector_status["last_error"] = None

