"""
PANEL 路由
"""

from fastapi import APIRouter
from typing import Dict, Optional, Literal, List
from datetime import datetime
from pydantic import BaseModel

from app import state
from app.config import logger
from app.models import (
    PanelDeleteTorrentsResponse,
    PanelHistoryResponse,
    PanelPauseTorrentsResponse,
    PanelResumeTorrentsResponse,
    PanelShareRatioResponse,
    PanelStatsResponse,
    PanelTorrentsResponse,
)
from app.services.panel_db import get_latest_stats, get_traffic_history, get_share_ratio_history, aggregate_data, calculate_30min_avg_speeds
from app.services.qbittorrent import (
    qb_login, qb_get_mteam_stats, qb_get_mteam_torrents,
    qb_pause_torrents, qb_resume_torrents, qb_delete_torrents,
    qb_get_storage_info
)
from app.utils import format_size, format_speed_int

router = APIRouter()


class PauseTorrentsRequest(BaseModel):
    hashes: List[str]

class ResumeTorrentsRequest(BaseModel):
    hashes: List[str]

class DeleteTorrentsRequest(BaseModel):
    hashes: List[str]
    delete_files: bool = False


@router.get("/api/panel/stats", response_model=PanelStatsResponse)
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
            qb_seeding_count = 0
            qb_leeching_count = 0
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
                    qb_seeding_count = qb_stats.get('seeding_count', 0)
                    qb_leeching_count = qb_stats.get('leeching_count', 0)
            except Exception as e:
                logger.error(f"实时采集 qBittorrent 失败: {e}")

            # 使用已缓存的 M-Team 用户资料（由免费种子刷新路径更新，避免每次浏览器刷新都触发 live API）
            mt_data = {}
            user_data = {}
            try:
                profile = state.user_profile
                if state.has_real_user_profile(profile):
                    uploaded = profile["uploaded"]
                    downloaded = profile["downloaded"]
                    share_ratio = profile["share_ratio"]
                    uploaded_display = profile.get('uploaded_display') or format_size(uploaded)
                    downloaded_display = profile.get('downloaded_display') or format_size(downloaded)
                    mt_data = {
                        "uploaded": uploaded,
                        "downloaded": downloaded,
                        "uploaded_display": uploaded_display,
                        "downloaded_display": downloaded_display
                    }
                    user_data = {
                        "share_ratio": share_ratio,
                        "uploaded": uploaded,
                        "downloaded": downloaded,
                        "uploaded_display": uploaded_display,
                        "downloaded_display": downloaded_display,
                        "seeding_count": qb_seeding_count,      # 改用 qBittorrent 数据
                        "leeching_count": qb_leeching_count     # 改用 qBittorrent 数据
                    }
                else:
                    logger.warning("无缓存的用户资料，跳过 M-Team 数据采集")
            except Exception as e:
                logger.error(f"读取缓存 M-Team 用户资料失败: {e}")

            # 添加存储信息
            storage = None
            try:
                sid = await qb_login()
                if sid:
                    storage = await qb_get_storage_info(sid)
            except Exception as e:
                logger.error(f"获取存储信息失败: {e}")

            return {
                "mteam": mt_data,
                "qbittorrent": qb_data,
                "user": user_data,
                "storage": storage,
                "last_update": int(datetime.utcnow().timestamp())
            }

        # 格式化数据库数据
        # 添加存储信息
        storage = None
        try:
            sid = await qb_login()
            if sid:
                storage = await qb_get_storage_info(sid)
        except Exception as e:
            logger.error(f"获取存储信息失败: {e}")

        # 计算30分钟平均速度
        avg_speeds = calculate_30min_avg_speeds()

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
            "storage": storage,
            "avg_speeds": {
                "upload_30min": avg_speeds["upload"],
                "download_30min": avg_speeds["download"],
                "upload_display": format_speed_int(avg_speeds["upload"]) + "/s",
                "download_display": format_speed_int(avg_speeds["download"]) + "/s"
            },
            "last_update": db_stats["last_update"]
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


@router.get("/api/panel/history", response_model=PanelHistoryResponse)
async def get_panel_history(range: Literal["1h", "6h", "12h", "24h", "7d", "30d"] = "24h") -> Dict:
    """获取流量历史数据

    Args:
        range: 时间范围，可选值: 1h, 6h, 12h, 24h, 7d, 30d

    Returns:
        {
            "range": "24h",
            "aggregation": "5min",
            "data_points": [...]
        }
    """
    try:
        # 解析时间范围
        range_hours = {
            "1h": 1,
            "6h": 6,
            "12h": 12,
            "24h": 24,
            "7d": 168,  # 7 * 24
            "30d": 720  # 30 * 24
        }

        hours = range_hours[range]

        # 获取原始数据
        raw_data = get_traffic_history(hours)

        # 确定聚合间隔
        aggregation_map = {
            "1h": {"seconds": 0, "label": "none"},  # 不聚合
            "6h": {"seconds": 0, "label": "none"},  # 不聚合
            "12h": {"seconds": 0, "label": "none"},  # 不聚合
            "24h": {"seconds": 0, "label": "none"},  # 不聚合
            "7d": {"seconds": 3600, "label": "1hour"},  # 1小时
            "30d": {"seconds": 86400, "label": "1day"}  # 1天
        }

        agg_config = aggregation_map[range]
        aggregation_label = agg_config["label"]

        # 应用聚合
        if agg_config["seconds"] > 0:
            data_points = aggregate_data(raw_data, agg_config["seconds"])
        else:
            data_points = raw_data

        return {
            "range": range,
            "aggregation": aggregation_label,
            "data_points": data_points
        }

    except Exception as e:
        logger.error(f"获取历史数据失败: {e}")
        return {
            "error": str(e),
            "range": range,
            "aggregation": "none",
            "data_points": []
        }


@router.get("/api/panel/share-ratio", response_model=PanelShareRatioResponse)
async def get_panel_share_ratio(range: Literal["1h", "6h", "12h", "24h", "7d", "30d"] = "24h") -> Dict:
    """获取分享率历史数据

    Args:
        range: 时间范围，可选值: 1h, 6h, 12h, 24h, 7d, 30d

    Returns:
        {
            "range": "24h",
            "data_points": [...],
            "current": 1.23,
            "highest": 1.50,
            "lowest": 1.00,
            "change_24h": 0.05
        }
    """
    try:
        # 解析时间范围
        range_hours = {
            "1h": 1,
            "6h": 6,
            "12h": 12,
            "24h": 24,
            "7d": 168,
            "30d": 720
        }

        hours = range_hours[range]

        # 获取数据
        data_points, stats = get_share_ratio_history(hours)

        return {
            "range": range,
            "data_points": data_points,
            **stats
        }

    except Exception as e:
        logger.error(f"获取分享率历史失败: {e}")
        return {
            "error": str(e),
            "range": range,
            "data_points": []
        }


@router.get("/api/panel/torrents", response_model=PanelTorrentsResponse)
async def get_panel_torrents(
    tag: Optional[str] = None,
    status: Optional[str] = None
) -> Dict:
    """
    获取种子列表（带筛选）

    Args:
        tag: 标签筛选 ("声呐做种" | "雷达下载" | "PILOT")
        status: 状态筛选 ("downloading" | "seeding" | "paused" | "completed")

    Returns:
        {
            "torrents": List[Dict],
            "total_count": int,
            "filtered_count": int
        }
    """
    try:
        sid = await qb_login()
        if not sid:
            return {
                "torrents": [],
                "total_count": 0,
                "filtered_count": 0,
                "error": "qBittorrent 连接失败"
            }

        torrents = await qb_get_mteam_torrents(sid, tag, status)

        return {
            "torrents": torrents,
            "total_count": len(torrents),
            "filtered_count": len(torrents)
        }
    except Exception as e:
        logger.error(f"获取种子列表失败: {e}")
        return {
            "torrents": [],
            "total_count": 0,
            "filtered_count": 0,
            "error": str(e)
        }


@router.post(
    "/api/panel/torrents/pause",
    response_model=PanelPauseTorrentsResponse,
)
async def pause_torrents(request: PauseTorrentsRequest) -> Dict:
    """批量暂停种子"""
    try:
        sid = await qb_login()
        if not sid:
            return {"success": False, "paused_count": 0, "failed": request.hashes,
                    "error": "qBittorrent 连接失败"}

        result = await qb_pause_torrents(sid, request.hashes)
        return result
    except Exception as e:
        logger.error(f"批量暂停失败: {e}")
        return {"success": False, "paused_count": 0, "failed": request.hashes, "error": str(e)}


@router.post(
    "/api/panel/torrents/resume",
    response_model=PanelResumeTorrentsResponse,
)
async def resume_torrents(request: ResumeTorrentsRequest) -> Dict:
    """批量恢复种子"""
    try:
        sid = await qb_login()
        if not sid:
            return {"success": False, "resumed_count": 0, "failed": request.hashes,
                    "error": "qBittorrent 连接失败"}

        result = await qb_resume_torrents(sid, request.hashes)
        return result
    except Exception as e:
        logger.error(f"批量恢复失败: {e}")
        return {"success": False, "resumed_count": 0, "failed": request.hashes, "error": str(e)}


@router.post(
    "/api/panel/torrents/delete",
    response_model=PanelDeleteTorrentsResponse,
)
async def delete_torrents(request: DeleteTorrentsRequest) -> Dict:
    """批量删除种子"""
    try:
        sid = await qb_login()
        if not sid:
            return {"success": False, "deleted_count": 0, "failed": request.hashes,
                    "error": "qBittorrent 连接失败"}

        result = await qb_delete_torrents(sid, request.hashes, request.delete_files)
        return result
    except Exception as e:
        logger.error(f"批量删除失败: {e}")
        return {"success": False, "deleted_count": 0, "failed": request.hashes, "error": str(e)}
