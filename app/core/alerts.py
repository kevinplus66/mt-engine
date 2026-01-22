"""
紧急报警与自动删除逻辑
"""

import asyncio
from typing import List, Dict
from app.config import ALERT_THRESHOLD_MINUTES, PUSHPLUS_TOKEN, QBITTORRENT_URL, logger
from app.state import (
    auto_delete_enabled, known_free_torrent_ids, user_torrent_status
)
from app.services.pushplus import is_free_discount, can_send_alert, send_pushplus_alert
from app.services.qbittorrent import qb_login, qb_find_torrent_by_mteam_id, qb_delete_torrent
from app.utils import parse_datetime, calculate_remaining_time
import app.state as state


async def check_emergency_alerts(torrents: List[Dict]) -> None:
    """
    检查紧急情况并执行自动删除/发送报警

    情况 A：免费即将到期且未下载完（剩余时间 < 10 分钟）
    情况 B：免费突然失效且未下载完（变节检测）

    注意：自动删除功能独立于 PushPlus，即使未配置 PUSHPLUS_TOKEN 也会执行删除
    """
    # 如果既没有启用自动删除，也没有配置推送，则跳过
    if not state.auto_delete_enabled and not PUSHPLUS_TOKEN:
        # 仍然需要更新历史免费记录（用于变节检测）
        for torrent in torrents:
            if is_free_discount(torrent.get("discount")):
                state.known_free_torrent_ids.add(torrent["id"])
        return

    alerts_to_send = []

    # 第一步：更新历史免费记录
    for torrent in torrents:
        if is_free_discount(torrent.get("discount")):
            state.known_free_torrent_ids.add(torrent["id"])

    logger.debug(f"当前追踪的免费种子数量: {len(state.known_free_torrent_ids)}")

    # 第二步：检查下载中的种子是否有紧急情况
    for torrent_id, leeching_info in state.user_torrent_status.get("leeching", {}).items():
        # 获取下载进度
        try:
            peer_info = leeching_info.get("peer", {})
            torrent_data = leeching_info.get("torrent", {})
            downloaded = int(peer_info.get("downloaded", 0) or 0)
            total_size = int(torrent_data.get("size", 0) or 0)

            if total_size > 0:
                progress = min((downloaded / total_size) * 100, 100.0)
            else:
                progress = 0

            # 已完成下载的不需要报警
            if progress >= 100:
                continue

            torrent_name = torrent_data.get("name", "未知种子")
            status_info = torrent_data.get("status", {})
            current_discount = status_info.get("discount", "")
            discount_end_time_str = status_info.get("discountEndTime")

        except (ValueError, TypeError, KeyError) as e:
            logger.debug(f"解析种子 {torrent_id} 信息失败: {e}")
            continue

        # 情况 A：免费即将到期且未下载完（剩余时间 < 10 分钟时自动删除）
        if is_free_discount(current_discount) and discount_end_time_str:
            discount_end_time = parse_datetime(discount_end_time_str)
            if discount_end_time:
                remaining = calculate_remaining_time(discount_end_time)
                remaining_minutes = remaining["hours"] * 60

                if remaining_minutes < ALERT_THRESHOLD_MINUTES and remaining_minutes > 0:
                    if can_send_alert(torrent_id, "expiring"):
                        # 初始化状态变量
                        deleted_successfully = False
                        torrent_found = False
                        login_success = False

                        # 如果启用自动删除功能，尝试从 qBittorrent 删除该种子
                        if state.auto_delete_enabled and QBITTORRENT_URL:
                            logger.info(f"自动删除功能已启用（免费即将到期），尝试删除种子 {torrent_id} ({torrent_name[:50]}...)")
                            sid = await qb_login()
                            if sid:
                                login_success = True
                                torrent_hash = await qb_find_torrent_by_mteam_id(torrent_id, sid)
                                if torrent_hash:
                                    torrent_found = True
                                    deleted_successfully = await qb_delete_torrent(torrent_hash, sid, delete_files=True)
                                    if deleted_successfully:
                                        logger.info(f"成功自动删除种子 {torrent_id}（免费即将到期）")
                                    else:
                                        logger.warning(f"自动删除种子 {torrent_id} 失败（免费即将到期）")
                                else:
                                    logger.info(f"未在 qBittorrent 中找到种子 {torrent_id}，无需删除")
                            else:
                                logger.warning("qBittorrent 登录失败，无法执行自动删除")

                        # 生成简化的删除状态消息
                        if deleted_successfully:
                            deletion_message = "🗑️ <span style='color:green;'><b>已触发自动删除，安全下车。</b></span>"
                        elif not state.auto_delete_enabled:
                            deletion_message = "⚠️ <span style='color:orange;'>自动删除未开启，建议立即手动检查！</span>"
                        elif not login_success:
                            deletion_message = "🚫 <span style='color:red;'>客户端登录失败，无法执行删除。</span>"
                        elif not torrent_found:
                            deletion_message = "❓ <span style='color:gray;'>未在客户端找到该种子。</span>"
                        else:
                            deletion_message = "⚠️ <span style='color:red;'><b>自动删除失败，请务必手动处理！</b></span>"

                        # 简化的告警模板
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
        if not is_free_discount(current_discount) and torrent_id in state.known_free_torrent_ids:
            if can_send_alert(torrent_id, "changed"):
                # 初始化状态变量
                deleted_successfully = False
                torrent_found = False
                login_success = False

                # 如果启用自动删除功能，尝试从 qBittorrent 删除该种子
                if state.auto_delete_enabled and QBITTORRENT_URL:
                    logger.info(f"自动删除功能已启用（免费变收费），尝试删除种子 {torrent_id} ({torrent_name[:50]}...)")
                    sid = await qb_login()
                    if sid:
                        login_success = True
                        torrent_hash = await qb_find_torrent_by_mteam_id(torrent_id, sid)
                        if torrent_hash:
                            torrent_found = True
                            deleted_successfully = await qb_delete_torrent(torrent_hash, sid, delete_files=True)
                            if deleted_successfully:
                                logger.info(f"成功自动删除种子 {torrent_id}（免费变收费）")
                            else:
                                logger.warning(f"自动删除种子 {torrent_id} 失败（免费变收费）")
                        else:
                            logger.info(f"未在 qBittorrent 中找到种子 {torrent_id}，无需删除")
                    else:
                        logger.warning("qBittorrent 登录失败，无法执行自动删除")

                # 生成简化的删除状态消息
                if deleted_successfully:
                    deletion_message = "🗑️ <span style='color:green;'><b>已触发自动删除，安全下车。</b></span>"
                elif not state.auto_delete_enabled:
                    deletion_message = "⚠️ <span style='color:orange;'>自动删除未开启，建议立即手动检查！</span>"
                elif not login_success:
                    deletion_message = "🚫 <span style='color:red;'>客户端登录失败，无法执行删除。</span>"
                elif not torrent_found:
                    deletion_message = "❓ <span style='color:gray;'>未在客户端找到该种子。</span>"
                else:
                    deletion_message = "⚠️ <span style='color:red;'><b>自动删除失败，请务必手动处理！</b></span>"

                # 简化的告警模板
                alerts_to_send.append({
                    "type": "changed",
                    "title": "MT免费优惠已失效",
                    "content": (
                        f"<h3>🚨 免费优惠已失效</h3>"
                        f"<p><b>{torrent_name}</b></p>"
                        f"📉 进度: <b style='color:orange;'>{progress:.1f}%</b><br>"
                        f"❌ 状态: <b style='color:red;'>{current_discount or 'NORMAL'}</b><br>"
                        f"<hr>"
                        f"{deletion_message}"
                    )
                })

    # 发送报警（仅当配置了 PUSHPLUS_TOKEN）
    if PUSHPLUS_TOKEN:
        for alert in alerts_to_send:
            await send_pushplus_alert(alert["title"], alert["content"])
            await asyncio.sleep(1)  # 避免推送太快
