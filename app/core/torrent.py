"""
种子数据处理核心逻辑
"""

import asyncio
import random
import time
from datetime import datetime, timedelta
from types import SimpleNamespace
from typing import Dict, Any, Optional
from app.config import (
    BEIJING_TZ, API_DELAY, REFRESH_INTERVAL, PANEL_COLLECT_INTERVAL,
    CATEGORIES_CACHE_HOURS, FREE_REFRESH_FAILURE_BACKOFF_SECONDS, logger,
    MT_TOKEN, MT_SITE_URL,
)
from app.state import user_torrent_status
from app.utils import (
    calculate_remaining_time, get_discount_label, format_size, _safe_int
)
from app.services.mteam_api import mt_client
from app.services.runtime_status import runtime_status
import app.state as state


_refresh_lock: Optional[asyncio.Lock] = None


def _get_refresh_lock() -> asyncio.Lock:
    """Lazily create refresh lock to avoid event-loop binding issues at import time."""
    global _refresh_lock
    if _refresh_lock is None:
        _refresh_lock = asyncio.Lock()
    return _refresh_lock


def _parse_free_refresh_backoff_until(value: Any) -> Optional[datetime]:
    """Parse cached FREE refresh backoff timestamp."""
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=BEIJING_TZ)
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=BEIJING_TZ)


def _parse_cached_free_last_update(value: Any) -> Optional[datetime]:
    """Parse cached FREE refresh timestamp."""
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=BEIJING_TZ)
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=BEIJING_TZ)


def _set_free_refresh_failure(error: str) -> None:
    """Preserve the cache while recording shared FREE refresh backoff."""
    backoff_until = datetime.now(BEIJING_TZ) + timedelta(
        seconds=FREE_REFRESH_FAILURE_BACKOFF_SECONDS
    )
    state.cached_data["error"] = error
    state.cached_data["free_refresh_backoff_until"] = backoff_until.isoformat()
    state.cached_data["free_refresh_backoff_reason"] = error


async def _run_expiry_only_emergency_checks(torrents) -> None:
    if torrents:
        from app.core.alerts import check_emergency_alerts

        await check_emergency_alerts(torrents, expiry_only=True)


def process_torrent(item: Dict, discount_type: str, torrent_mode: str = "normal") -> Dict:
    """处理单个种子数据"""
    torrent_info = item if "id" in item else item.get("torrent", item)
    status_info = torrent_info.get("status") or {}

    torrent_id = str(torrent_info.get("id", ""))
    name = torrent_info.get("name", "未知")
    small_descr = torrent_info.get("smallDescr", "")
    size = _safe_int(torrent_info.get("size"))

    seeders = _safe_int(status_info.get("seeders"))
    leechers = _safe_int(status_info.get("leechers"))

    discount = status_info.get("discount", discount_type)
    discount_end_time_str = status_info.get("discountEndTime")
    from app.utils import parse_datetime
    discount_end_time = parse_datetime(discount_end_time_str)
    remaining = calculate_remaining_time(discount_end_time)

    detail_url = f"{MT_SITE_URL}/detail/{torrent_id}"

    # 用户状态
    user_status = "none"
    user_progress = 0

    if torrent_id in user_torrent_status["seeding"]:
        user_status = "seeding"
    elif torrent_id in user_torrent_status["leeching"]:
        user_status = "leeching"
        leeching_info = user_torrent_status["leeching"][torrent_id]
        try:
            peer_info = leeching_info.get("peer", {})
            torrent_data = leeching_info.get("torrent", {})
            downloaded = int(peer_info.get("downloaded", 0) or 0)
            total_size = int(torrent_data.get("size", 0) or 0)
            if total_size > 0 and downloaded > 0:
                user_progress = min((downloaded / total_size) * 100, 100.0)
        except (ValueError, TypeError, KeyError):
            user_progress = 0

    return {
        "id": torrent_id,
        "name": name,
        "small_descr": small_descr,
        "size": size,
        "size_display": format_size(size),
        "seeders": seeders,
        "leechers": leechers,
        "discount": discount,
        "discount_label": get_discount_label(discount),
        "discount_end_time": discount_end_time_str,
        "remaining": remaining,
        "category": torrent_info.get("category", ""),
        "category_name": torrent_info.get("categoryName", ""),
        "created_date": torrent_info.get("createdDate", ""),
        "detail_url": detail_url,
        "user_status": user_status,
        "user_progress": user_progress,
        "mode": torrent_mode
    }


async def fetch_all_free_torrents() -> Dict[str, Any]:
    """获取所有免费种子"""
    async with _get_refresh_lock():
        now = datetime.now(BEIJING_TZ)
        backoff_until = _parse_free_refresh_backoff_until(
            state.cached_data.get("free_refresh_backoff_until")
        )
        if backoff_until and backoff_until > now:
            reason = state.cached_data.get("free_refresh_backoff_reason") or state.cached_data.get("error")
            logger.warning(
                f"FREE refresh cooldown active until {backoff_until.isoformat()}; "
                f"skipping M-Team search (reason={reason})"
            )
            await _run_expiry_only_emergency_checks(state.cached_data.get("torrents") or [])
            return state.cached_data

        if not MT_TOKEN:
            state.cached_data["error"] = "未配置 MT_TOKEN 环境变量"
            runtime_status.mark_error("mteam", state.cached_data["error"])
            return state.cached_data

        last_update = _parse_cached_free_last_update(state.cached_data.get("last_update"))
        if not state.cached_data.get("error") and last_update:
            cache_age = (now - last_update).total_seconds()
            if cache_age < REFRESH_INTERVAL:
                logger.info(
                    f"→ 复用新鲜 page-one FREE 缓存 "
                    f"(age={cache_age:.0f}s < {REFRESH_INTERVAL}s)"
                )
                return state.cached_data
        logger.info("开始搜索免费种子")

        # 检查用户状态是否需要刷新（整点刷新）
        current_hour = int(time.time()) // 3600
        should_refresh_user_status = (current_hour != state._last_user_status_refresh_hour)

        if should_refresh_user_status:
            # 顺序获取用户状态（避免触发 M-Team API 速率限制）
            if hasattr(mt_client, "fetch_user_torrent_status_with_status"):
                user_status_result = await mt_client.fetch_user_torrent_status_with_status()
            else:
                legacy_statuses = await mt_client.fetch_user_torrent_status()
                has_existing_status = bool(
                    state.user_torrent_status.get("seeding")
                    or state.user_torrent_status.get("leeching")
                )
                has_new_status = bool(
                    legacy_statuses.get("seeding")
                    or legacy_statuses.get("leeching")
                )
                user_status_result = SimpleNamespace(
                    statuses=legacy_statuses,
                    succeeded=has_new_status or not has_existing_status,
                    error=None if has_new_status or not has_existing_status else "用户状态为空",
                )
            if user_status_result.succeeded:
                state.user_torrent_status.update(user_status_result.statuses)
            else:
                logger.warning(
                    f"用户种子状态刷新失败，保留上一份缓存: {user_status_result.error or '未知错误'}"
                )

            await asyncio.sleep(API_DELAY + random.uniform(1, 3))

            user_profile_result = await mt_client.fetch_user_profile()
            if user_profile_result:
                state.user_profile.update(user_profile_result)

            if user_status_result.succeeded:
                state._last_user_status_refresh_hour = current_hour
                logger.info("✓ 用户状态已刷新（整点触发）")

            # 用户状态刷新后，间隔一段时间再开始搜索
            await asyncio.sleep(API_DELAY + random.uniform(1, 3))
        else:
            logger.info("→ 用户状态使用缓存（本小时已刷新）")

        all_torrents = []
        seen_ids = set()
        shard_metadata = {}

        # 搜索 FREE 的普通区、成人区；保留 M-Team 默认 page 1，再补一个
        # leechers-desc page 1，避免只看默认排序时错过高需求候选。
        # _2X_FREE 只补 normal/leechers-desc 这一个低频 shard：让 2xFree
        # 进入候选集，但不扩成 full crawl 或成人区额外搜索。
        # 仅 FREE normal/default 为 required：可选 shard 临时故障不应丢弃
        # 普通区数据并触发 30 分钟退避。
        search_tasks = [
            ("FREE", "normal", "default", None, None, True),
            ("FREE", "normal", "leechers_desc", "LEECHERS", "DESC", False),
            ("FREE", "adult", "default", None, None, False),
            ("FREE", "adult", "leechers_desc", "LEECHERS", "DESC", False),
            ("_2X_FREE", "normal", "leechers_desc", "LEECHERS", "DESC", False),
        ]

        for discount_type, mode, variant, sort_field, sort_direction, required in search_tasks:
            await asyncio.sleep(API_DELAY + random.uniform(1, 5))
            shard = f"{discount_type}/{mode}/{variant}"
            search_result = await mt_client.search_free_torrents_page_one_with_status(
                discount_type,
                mode=mode,
                sort_field=sort_field,
                sort_direction=sort_direction,
            )
            shard_metadata[shard] = {
                "total": search_result.total,
                "pages_fetched": search_result.pages_fetched,
                "complete": search_result.complete,
                "items": len(search_result.items),
            }
            if not search_result.succeeded:
                error = search_result.error or f"{shard} 免费搜索失败"
                if required:
                    _set_free_refresh_failure(error)
                    runtime_status.mark_error("mteam", error)
                    logger.error(f"{shard} 免费搜索失败，保留上一份缓存并进入冷却")
                    await _run_expiry_only_emergency_checks(state.cached_data.get("torrents") or [])
                    return state.cached_data

                logger.warning(f"{shard} 可选免费搜索失败，继续使用已成功 shard: {error}")
                continue

            for item in search_result.items:
                torrent = process_torrent(item, discount_type, mode)
                if torrent["id"] not in seen_ids:
                    seen_ids.add(torrent["id"])
                    all_torrents.append(torrent)

        # 按剩余时间排序
        all_torrents.sort(key=lambda t: t["remaining"]["hours"])

        # 检查分类列表是否需要刷新 (24小时)
        last_categories_refresh = state._last_categories_refresh

        if (
            last_categories_refresh is None or
            (now - last_categories_refresh).total_seconds() > CATEGORIES_CACHE_HOURS * 3600
        ):
            previous_categories = state.cached_data.get("categories", [])
            if hasattr(mt_client, "fetch_categories_with_status"):
                category_result = await mt_client.fetch_categories_with_status()
            else:
                category_result = SimpleNamespace(
                    categories=await mt_client.fetch_categories(),
                    succeeded=True,
                    error=None,
                )
            if category_result.succeeded and (
                category_result.categories or not previous_categories
            ):
                categories = category_result.categories
                state._last_categories_refresh = now
                logger.info("✓ 分类列表已刷新 (24小时缓存)")
            else:
                categories = previous_categories or category_result.categories
                logger.warning(
                    f"分类列表刷新失败或为空，保留上一份缓存: {category_result.error or '无可用分类'}"
                )
        else:
            categories = state.cached_data.get("categories", [])
            elapsed_hours = int((now - last_categories_refresh).total_seconds() / 3600)
            logger.info(f"→ 分类列表使用缓存 (已过 {elapsed_hours} 小时)")

        # 统计
        free_count = sum(1 for t in all_torrents if t["discount"] == "FREE")
        free_2x_count = sum(1 for t in all_torrents if t["discount"] == "_2X_FREE")

        state.cached_data = {
            "torrents": all_torrents,
            "categories": categories,
            "last_update": datetime.now(BEIJING_TZ).strftime("%Y-%m-%d %H:%M:%S"),
            "error": None,
            "free_refresh_backoff_until": None,
            "free_refresh_backoff_reason": None,
            "coverage": "page1+leechers_desc",
            "membership_complete": False,
            "free_refresh_shards": shard_metadata,
            "total": len(all_torrents),
            "free_count": free_count,
            "free_2x_count": free_2x_count,
        }
        runtime_status.mark_success("mteam")

        logger.info(f"找到 {len(all_torrents)} 个免费种子 (Free: {free_count}, 2xFree: {free_2x_count})")

        # 检查紧急情况（免费即将到期）；page-one 候选集不是完整免费会员集合，禁用 Case B。
        if all_torrents:
            from app.core.alerts import check_emergency_alerts
            await check_emergency_alerts(
                all_torrents,
                current_free_membership_complete=False,
            )
        else:
            logger.warning("免费种子列表为空，跳过紧急检查（疑似 API 异常）")

        return state.cached_data


async def background_refresh_torrents():
    """后台定时刷新免费种子（默认5分钟）"""
    while True:
        start_time = asyncio.get_event_loop().time()
        refresh_error = None
        try:
            await fetch_all_free_torrents()
        except Exception as e:
            refresh_error = str(e)
            state.cached_data["error"] = refresh_error
            runtime_status.mark_error("mteam", refresh_error)
            logger.error(f"种子刷新异常: {refresh_error}", exc_info=True)

        elapsed = asyncio.get_event_loop().time() - start_time
        sleep_time = max(60, REFRESH_INTERVAL - elapsed)
        if refresh_error:
            logger.warning(f"种子刷新失败，耗时 {elapsed:.1f}秒，下次重试在 {sleep_time:.0f}秒后")
        else:
            logger.info(f"种子刷新完成，耗时 {elapsed:.1f}秒，下次刷新在 {sleep_time:.0f}秒后")
        await asyncio.sleep(sleep_time)


async def background_collect_panel():
    """后台定时采集 PANEL 数据（默认1分钟）"""
    while True:
        try:
            from app.services.panel_collector import collect_panel_data
            await collect_panel_data()
        except Exception as e:
            logger.error(f"PANEL 数据采集异常: {e}")

        await asyncio.sleep(PANEL_COLLECT_INTERVAL)
