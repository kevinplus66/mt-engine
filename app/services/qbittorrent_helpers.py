"""
Pure qBittorrent formatting and tracker helpers.
"""

import base64
import re
import time
from typing import Dict, List, Optional

import httpx

from app.config import logger


def is_qb_add_success(response: httpx.Response) -> bool:
    """
    Validate qBittorrent add-torrent response.

    qBittorrent may return HTTP 200 with non-success body (e.g. duplicate/rejected).
    """
    body = (response.text or "").strip().lower()
    return response.status_code == 200 and body in ("ok.", "ok")


def calculate_torrent_health(torrent: Dict, trackers: List[Dict]) -> Dict:
    """
    Calculate torrent health for PANEL display.
    """
    has_working_tracker = any(
        t.get("status") == 2
        for t in trackers
        if t.get("url", "").startswith("http")
    )

    state = torrent.get("state", "")
    if state in ("error", "missingFiles"):
        return {"score": 0, "status": "error", "reason": "文件损坏"}

    if not has_working_tracker:
        return {"score": 25, "status": "degraded", "reason": "Tracker离线"}

    if torrent.get("progress", 0) >= 1.0:
        last_activity = torrent.get("last_activity", 0)
        if last_activity > 0:
            idle_seconds = time.time() - last_activity
            if idle_seconds > 259200:
                idle_days = int(idle_seconds / 86400)
                return {
                    "score": 50,
                    "status": "warning",
                    "reason": f"{idle_days}天无上传",
                }

    return {"score": 100, "status": "healthy", "reason": ""}


def extract_mteam_id_from_trackers(trackers: List[Dict]) -> Optional[str]:
    """
    Extract M-Team torrent ID from tracker URLs.
    """
    for tracker in trackers:
        tracker_url = tracker.get("url", "")
        if "m-team" not in tracker_url.lower():
            continue

        match = re.search(r"torrent_id=(\d+)", tracker_url)
        if match:
            return match.group(1)

        try:
            if "credential=" in tracker_url:
                credential_match = re.search(
                    r"credential=([A-Za-z0-9+/=]+)",
                    tracker_url,
                )
                if credential_match:
                    credential_b64 = credential_match.group(1)
                    decoded = base64.b64decode(credential_b64).decode(
                        "utf-8",
                        errors="ignore",
                    )
                    tid_match = re.search(r"tid=(\d+)", decoded)
                    if tid_match:
                        return tid_match.group(1)
        except Exception as e:
            logger.debug(f"解析 credential 失败: {e}")
            continue

    return None
