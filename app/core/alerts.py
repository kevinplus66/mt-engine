"""
紧急报警与自动删除逻辑
"""

import asyncio
from typing import List, Dict, Optional, Tuple

from app.config import ALERT_THRESHOLD_MINUTES, PUSHPLUS_TOKEN, QBITTORRENT_URL, logger
from app.constants import QB_TAG_RADAR, QB_TAG_SONAR
from app.services.pushplus import is_free_discount, can_send_alert, send_pushplus_alert
from app.services.qbittorrent import (
    qb_login,
    qb_find_torrent_by_mteam_id,
    qb_delete_torrent,
    qb_get_torrents,
    qb_get_torrent_trackers,
    extract_mteam_id_from_trackers,
)
from app.utils import parse_datetime, calculate_remaining_time
import app.state as state


LEECHING_STATES = (
    "downloading", "stalledDL", "metaDL", "pausedDL",
    "queuedDL", "forcedDL", "checkingDL"
)
MANAGED_TAGS = {QB_TAG_SONAR, QB_TAG_RADAR, "PILOT"}


def _build_cached_leeching_candidates() -> Dict[str, Dict]:
    """
    Build monitoring candidates from hourly M-Team leeching cache.

    This remains as a fallback source. Real-time qB candidates (if available)
    will overwrite same-id records with fresher progress/hash data.
    """
    candidates: Dict[str, Dict] = {}

    for torrent_id, leeching_info in state.user_torrent_status.get("leeching", {}).items():
        try:
            peer_info = leeching_info.get("peer", {})
            torrent_data = leeching_info.get("torrent", {})
            downloaded = int(peer_info.get("downloaded", 0) or 0)
            total_size = int(torrent_data.get("size", 0) or 0)

            progress = min((downloaded / total_size) * 100, 100.0) if total_size > 0 else 0.0
            if progress >= 100:
                continue

            status_info = torrent_data.get("status", {})
            candidates[str(torrent_id)] = {
                "torrent_name": torrent_data.get("name", "未知种子"),
                "progress": progress,
                "current_discount": status_info.get("discount", ""),
                "discount_end_time": status_info.get("discountEndTime"),
                "qb_hash": None,
            }
        except (ValueError, TypeError, KeyError) as e:
            logger.debug(f"解析种子 {torrent_id} 信息失败: {e}")
            continue

    return candidates


async def _build_live_qb_leeching_candidates() -> Tuple[Dict[str, Dict], Optional[str]]:
    """
    Build monitoring candidates from qBittorrent downloading tasks.

    This closes the monitoring blind window without increasing M-Team API calls.
    """
    if not QBITTORRENT_URL:
        return {}, None

    sid = await qb_login()
    if not sid:
        return {}, None

    candidates: Dict[str, Dict] = {}
    tasks = await qb_get_torrents(sid)

    for task in tasks:
        state_name = task.get("state", "")
        if state_name not in LEECHING_STATES:
            continue

        progress = float(task.get("progress", 0) or 0) * 100
        progress = min(max(progress, 0.0), 100.0)
        if progress >= 100:
            continue

        tags = {t.strip() for t in task.get("tags", "").split(",") if t.strip()}
        if not tags.intersection(MANAGED_TAGS):
            continue

        torrent_hash = task.get("hash", "")
        if not torrent_hash:
            continue

        trackers = await qb_get_torrent_trackers(torrent_hash, sid)
        torrent_id = extract_mteam_id_from_trackers(trackers)
        if not torrent_id:
            continue

        candidates[str(torrent_id)] = {
            "torrent_name": task.get("name", "未知种子"),
            "progress": progress,
            "current_discount": "",
            "discount_end_time": None,
            "qb_hash": torrent_hash,
        }

    return candidates, sid


def _build_deletion_message(
    deleted_successfully: bool,
    login_success: bool,
    torrent_found: bool,
) -> str:
    """Generate unified deletion-status message for notifications."""
    if deleted_successfully:
        return "🗑️ <span style='color:green;'><b>已触发自动删除，安全下车。</b></span>"
    if not state.auto_delete_enabled:
        return "⚠️ <span style='color:orange;'>自动删除未开启，建议立即手动检查！</span>"
    if not login_success:
        return "🚫 <span style='color:red;'>客户端登录失败，无法执行删除。</span>"
    if not torrent_found:
        return "❓ <span style='color:gray;'>未在客户端找到该种子。</span>"
    return "⚠️ <span style='color:red;'><b>自动删除失败，请务必手动处理！</b></span>"


async def _try_auto_delete(
    torrent_id: str,
    reason_label: str,
    sid: Optional[str],
    preferred_hash: Optional[str] = None,
) -> Tuple[bool, bool, bool, Optional[str]]:
    """
    Attempt auto-delete once and return status tuple:
    (deleted_successfully, torrent_found, login_success, sid)
    """
    if not state.auto_delete_enabled or not QBITTORRENT_URL:
        return False, False, False, sid

    if not sid:
        sid = await qb_login()
        if not sid:
            logger.warning("qBittorrent 登录失败，无法执行自动删除")
            return False, False, False, sid

    login_success = True
    torrent_hash = preferred_hash
    torrent_found = False

    if not torrent_hash:
        torrent_hash = await qb_find_torrent_by_mteam_id(
            torrent_id, sid, managed_only=True
        )

    if torrent_hash:
        torrent_found = True
        deleted_successfully = await qb_delete_torrent(torrent_hash, sid, delete_files=True)
        if deleted_successfully:
            logger.info(f"成功自动删除种子 {torrent_id}（{reason_label}）")
        else:
            logger.warning(f"自动删除种子 {torrent_id} 失败（{reason_label}）")
        return deleted_successfully, torrent_found, login_success, sid

    logger.info(f"未在 qBittorrent 中找到种子 {torrent_id}，无需删除")
    return False, torrent_found, login_success, sid


async def check_emergency_alerts(
    torrents: List[Dict],
    *,
    expiry_only: bool = False,
    current_free_membership_complete: bool = True,
) -> None:
    """
    检查紧急情况并执行自动删除/发送报警

    情况 A：免费即将到期且未下载完（剩余时间 < 10 分钟）
    情况 B：免费突然失效且未下载完（变节检测；仅完整当前免费列表启用）
    注意：自动删除功能独立于 PushPlus，即使未配置 PUSHPLUS_TOKEN 也会执行删除
    """
    # 如果既没有启用自动删除，也没有配置推送，则跳过
    if not state.auto_delete_enabled and not PUSHPLUS_TOKEN:
        # 仍然需要更新历史免费记录（用于变节检测）；expiry_only 使用旧缓存，
        # 不能影响变节检测状态。
        if not expiry_only:
            for torrent in torrents:
                if is_free_discount(torrent.get("discount")):
                    state.known_free_torrent_ids.add(str(torrent["id"]))
        return

    alerts_to_send = []
    membership_complete = current_free_membership_complete and not expiry_only

    # 第一步：更新历史免费记录并构建当前免费映射
    current_free_map = {str(t["id"]): t for t in torrents}
    if not expiry_only:
        for torrent in torrents:
            if is_free_discount(torrent.get("discount")):
                state.known_free_torrent_ids.add(str(torrent["id"]))
    logger.debug(f"当前追踪的免费种子数量: {len(state.known_free_torrent_ids)}")

    current_free_ids = set(current_free_map.keys())
    logger.debug(f"当前免费列表种子数量: {len(current_free_ids)}")

    # 第二步：收集监控目标（缓存 + qB 实时）
    monitoring_targets = _build_cached_leeching_candidates()
    qb_targets, qb_sid = await _build_live_qb_leeching_candidates()
    for torrent_id, qb_target in qb_targets.items():
        cached_target = monitoring_targets.get(torrent_id)
        if cached_target:
            qb_target["current_discount"] = (
                qb_target.get("current_discount")
                or cached_target.get("current_discount", "")
            )
            qb_target["discount_end_time"] = (
                qb_target.get("discount_end_time")
                or cached_target.get("discount_end_time")
            )
        monitoring_targets[torrent_id] = qb_target

    for torrent_id, target in monitoring_targets.items():
        progress = float(target.get("progress", 0) or 0)
        if progress >= 100:
            continue

        torrent_name = target.get("torrent_name", "未知种子")
        free_meta = current_free_map.get(torrent_id)
        is_in_current_map = free_meta is not None
        if is_in_current_map:
            current_discount = free_meta.get("discount")
            discount_end_time_str = free_meta.get("discount_end_time")
        else:
            current_discount = target.get("current_discount", "")
            discount_end_time_str = target.get("discount_end_time")
        qb_hash = target.get("qb_hash")

        # 情况 A：免费即将到期且未下载完（剩余时间 < 10 分钟时自动删除）
        # 完整列表中，当前列表元数据优先；部分/仅到期检查中，允许使用缓存的
        # 已知 FREE 元数据，避免 page-one 缓存漏掉即将过期的下载中种子。
        can_check_expiry = is_in_current_map or not membership_complete
        if can_check_expiry and is_free_discount(current_discount) and discount_end_time_str:
            discount_end_time = parse_datetime(discount_end_time_str)
            if discount_end_time:
                remaining = calculate_remaining_time(discount_end_time)
                remaining_minutes = remaining["hours"] * 60

                if remaining_minutes < ALERT_THRESHOLD_MINUTES and remaining_minutes > 0:
                    logger.info(
                        f"触发免费即将到期检查: {torrent_id} ({torrent_name[:50]}...) "
                        f"auto_delete={'on' if state.auto_delete_enabled else 'off'}"
                    )
                    deleted_successfully, torrent_found, login_success, qb_sid = await _try_auto_delete(
                        torrent_id=torrent_id,
                        reason_label="免费即将到期",
                        sid=qb_sid,
                        preferred_hash=qb_hash,
                    )

                    if PUSHPLUS_TOKEN and can_send_alert(torrent_id, "expiring"):
                        deletion_message = _build_deletion_message(
                            deleted_successfully=deleted_successfully,
                            login_success=login_success,
                            torrent_found=torrent_found,
                        )

                        alerts_to_send.append({
                            "type": "expiring",
                            "title": "MT免费即将结束",
                            "content": (
                                f"<h3>⚠️ 免费即将结束 ({remaining['display']})</h3>"
                                f"<p><b>{torrent_name}</b></p>"
                                f"📉 进度: <b style='color:orange;'>{progress:.1f}%</b><br>"
                                f"⏱️ 剩余: <b style='color:red;'>{remaining['display']}</b><br>"
                                f"🏷️ 优惠: {current_discount}<br>"
                                f"<hr>"
                                f"{deletion_message}"
                            )
                        })

        # 情况 B：免费突然失效（变节检测）
        if membership_complete and not is_in_current_map and torrent_id in state.known_free_torrent_ids:
            logger.info(
                f"触发免费变收费检查: {torrent_id} ({torrent_name[:50]}...) "
                f"auto_delete={'on' if state.auto_delete_enabled else 'off'}"
            )
            deleted_successfully, torrent_found, login_success, qb_sid = await _try_auto_delete(
                torrent_id=torrent_id,
                reason_label="免费变收费",
                sid=qb_sid,
                preferred_hash=qb_hash,
            )

            if PUSHPLUS_TOKEN and can_send_alert(torrent_id, "changed"):
                deletion_message = _build_deletion_message(
                    deleted_successfully=deleted_successfully,
                    login_success=login_success,
                    torrent_found=torrent_found,
                )

                alerts_to_send.append({
                    "type": "changed",
                    "title": "MT免费优惠已失效",
                    "content": (
                        f"<h3>🚨 免费优惠已失效</h3>"
                        f"<p><b>{torrent_name}</b></p>"
                        f"📉 进度: <b style='color:orange;'>{progress:.1f}%</b><br>"
                        f"❌ 状态: <b style='color:red;'>已从免费列表移除</b><br>"
                        f"<hr>"
                        f"{deletion_message}"
                    )
                })

    # 发送报警（仅当配置了 PUSHPLUS_TOKEN）
    if PUSHPLUS_TOKEN:
        for alert in alerts_to_send:
            await send_pushplus_alert(alert["title"], alert["content"])
            await asyncio.sleep(1)  # 避免推送太快
