"""
种子数据处理核心逻辑
"""

import asyncio
from datetime import datetime
from typing import Dict, Any
from app.config import (
    BEIJING_TZ, API_DELAY, REFRESH_INTERVAL,
    USER_STATUS_CACHE_HOURS, CATEGORIES_CACHE_HOURS, logger
)
from app.state import (
    cached_data, user_torrent_status, user_collection_ids,
    _last_user_status_refresh, _last_categories_refresh
)
from app.utils import (
    calculate_remaining_time, get_discount_label, format_size, _safe_int
)
from app.services.mteam_api import (
    fetch_user_torrent_status, fetch_user_collection,
    fetch_user_profile, fetch_rival_profile, fetch_categories,
    search_free_torrents
)
from app.config import MT_TOKEN, MT_SITE_URL
import app.state as state


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
        "is_collected": torrent_id in user_collection_ids,
        "mode": torrent_mode
    }


async def fetch_all_free_torrents() -> Dict[str, Any]:
    """获取所有免费种子"""
    global cached_data

    if not MT_TOKEN:
        state.cached_data["error"] = "未配置 MT_TOKEN 环境变量"
        return state.cached_data

    logger.info("开始搜索免费种子")

    now = datetime.now(BEIJING_TZ)

    # 检查用户状态是否需要刷新 (1小时)
    should_refresh_user_status = (
        state._last_user_status_refresh is None or
        (now - state._last_user_status_refresh).total_seconds() > USER_STATUS_CACHE_HOURS * 3600
    )

    if should_refresh_user_status:
        # 顺序获取用户状态（避免触发 M-Team API 速率限制）
        user_status_result = await fetch_user_torrent_status()
        state.user_torrent_status.update(user_status_result)

        await asyncio.sleep(API_DELAY)

        collection_result = await fetch_user_collection()
        state.user_collection_ids = collection_result

        await asyncio.sleep(API_DELAY)

        user_profile_result = await fetch_user_profile()
        if user_profile_result:
            state.user_profile.update(user_profile_result)

        await asyncio.sleep(API_DELAY)

        rival_profile_result = await fetch_rival_profile()
        if rival_profile_result:
            state.rival_profile.update(rival_profile_result)

        state._last_user_status_refresh = now
        logger.info("✓ 用户状态已刷新 (1小时缓存)")
    else:
        elapsed_minutes = int((now - state._last_user_status_refresh).total_seconds() / 60)
        logger.info(f"→ 用户状态使用缓存 (已过 {elapsed_minutes} 分钟)")

    all_torrents = []
    seen_ids = set()

    # 顺序搜索普通区和成人区（避免触发速率限制）
    search_tasks = [
        ("FREE", "normal"),
        ("_2X_FREE", "normal"),
        ("FREE", "adult"),
        ("_2X_FREE", "adult"),
    ]

    for discount_type, mode in search_tasks:
        await asyncio.sleep(API_DELAY)
        torrents = await search_free_torrents(discount_type, mode=mode)
        for item in torrents:
            torrent = process_torrent(item, discount_type, mode)
            if torrent["id"] not in seen_ids:
                seen_ids.add(torrent["id"])
                all_torrents.append(torrent)

    # 按剩余时间排序
    all_torrents.sort(key=lambda t: t["remaining"]["hours"])

    # 检查分类列表是否需要刷新 (24小时)
    should_refresh_categories = (
        state._last_categories_refresh is None or
        (now - state._last_categories_refresh).total_seconds() > CATEGORIES_CACHE_HOURS * 3600
    )

    if should_refresh_categories:
        categories = await fetch_categories()
        state._last_categories_refresh = now
        logger.info("✓ 分类列表已刷新 (24小时缓存)")
    else:
        categories = state.cached_data.get("categories", [])
        elapsed_hours = int((now - state._last_categories_refresh).total_seconds() / 3600)
        logger.info(f"→ 分类列表使用缓存 (已过 {elapsed_hours} 小时)")

    # 统计
    free_count = sum(1 for t in all_torrents if t["discount"] == "FREE")
    free_2x_count = sum(1 for t in all_torrents if t["discount"] == "_2X_FREE")

    state.cached_data = {
        "torrents": all_torrents,
        "categories": categories,
        "last_update": datetime.now(BEIJING_TZ).strftime("%Y-%m-%d %H:%M:%S"),
        "error": None,
        "total": len(all_torrents),
        "free_count": free_count,
        "free_2x_count": free_2x_count
    }

    logger.info(f"找到 {len(all_torrents)} 个免费种子 (Free: {free_count}, 2xFree: {free_2x_count})")

    # 检查紧急情况（免费即将到期/免费变收费）并执行自动删除
    from app.core.alerts import check_emergency_alerts
    await check_emergency_alerts(all_torrents)

    return state.cached_data


async def background_refresh():
    """后台定时刷新任务"""
    while True:
        start_time = asyncio.get_event_loop().time()
        await fetch_all_free_torrents()

        # 采集 PANEL 数据
        try:
            from app.services.panel_collector import collect_panel_data
            await collect_panel_data()
        except Exception as e:
            logger.error(f"PANEL 数据采集异常: {e}")

        elapsed = asyncio.get_event_loop().time() - start_time
        sleep_time = max(60, REFRESH_INTERVAL - elapsed)  # 至少等待60秒
        logger.info(f"数据刷新完成，耗时 {elapsed:.1f}秒，下次刷新在 {sleep_time:.0f}秒后")
        await asyncio.sleep(sleep_time)
