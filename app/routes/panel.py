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
