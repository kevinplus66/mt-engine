"""
qBittorrent 集成服务
"""

import re
from typing import Optional, List, Dict, Set

import httpx

from app.config import QBITTORRENT_URL, logger
from app.models import normalize_download_save_path
from app.services.runtime_status import runtime_status
from app.services.qbittorrent_downloads import (
    download_torrent_file,
    get_torrent_download_url,
)
from app.services.qbittorrent_helpers import (
    calculate_torrent_health,
    extract_mteam_id_from_trackers,
    is_qb_add_success,
)
from app.services.qbittorrent_session import (
    qb_clear_session,
    qb_is_session_valid,
    qb_login,
)
from app.utils import format_size


MANAGED_TORRENT_TAGS = {"声呐做种", "雷达下载", "PILOT"}
INFO_HASH_RE = re.compile(r"^[0-9a-fA-F]{40}$")


def _split_qb_tags(tags: str) -> set[str]:
    if not isinstance(tags, str):
        return set()
    return {tag.strip() for tag in tags.split(",") if tag.strip()}


def _is_managed_torrent(torrent: Dict) -> bool:
    return bool(_split_qb_tags(torrent.get("tags", "")).intersection(MANAGED_TORRENT_TAGS))


def _normalize_info_hashes(hashes: List[str]) -> tuple[List[tuple[str, str]], List[str]]:
    valid_hashes: List[tuple[str, str]] = []
    invalid_hashes: List[str] = []

    for hash_value in hashes:
        if not isinstance(hash_value, str):
            invalid_hashes.append(str(hash_value))
            continue

        normalized_hash = hash_value.strip()
        if not INFO_HASH_RE.fullmatch(normalized_hash):
            invalid_hashes.append(hash_value)
            continue

        valid_hashes.append((normalized_hash.lower(), hash_value))

    return valid_hashes, invalid_hashes


async def _select_managed_hashes(
    sid: str,
    requested_hashes: List[tuple[str, str]],
) -> tuple[List[tuple[str, str]], List[str]]:
    managed_hashes = {
        torrent_hash.strip().lower()
        for torrent in await qb_get_torrents(sid)
        if isinstance((torrent_hash := torrent.get("hash")), str)
        and INFO_HASH_RE.fullmatch(torrent_hash.strip())
        and _is_managed_torrent(torrent)
    }

    selected_hashes: List[tuple[str, str]] = []
    failed_hashes: List[str] = []
    for normalized_hash, original_hash in requested_hashes:
        if normalized_hash in managed_hashes:
            selected_hashes.append((normalized_hash, original_hash))
        else:
            failed_hashes.append(original_hash)

    return selected_hashes, failed_hashes


async def _post_qb_mutation_with_retry(
    sid: str,
    endpoint: str,
    data: Dict[str, str],
    *,
    files: Optional[Dict[str, tuple[str, bytes, str]]] = None,
    timeout: float = 10.0,
) -> httpx.Response:
    url = f"{QBITTORRENT_URL.rstrip('/')}/{endpoint}"
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            url,
            data=data,
            files=files,
            cookies={"SID": sid},
        )

        if response.status_code not in (401, 403):
            return response

        logger.warning("qBittorrent 会话已过期，清除缓存并重试")
        runtime_status.mark_error("qbittorrent", f"HTTP {response.status_code}")
        qb_clear_session()

        fresh_sid = await qb_login(force_new=True)
        if not fresh_sid:
            return response

        return await client.post(
            url,
            data=data,
            files=files,
            cookies={"SID": fresh_sid},
        )


async def _get_qb_with_retry(sid: str, endpoint: str) -> httpx.Response:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{QBITTORRENT_URL.rstrip('/')}/{endpoint}",
            cookies={"SID": sid},
        )

        if response.status_code not in (401, 403):
            return response

        logger.warning("qBittorrent 会话已过期，清除缓存并重试")
        runtime_status.mark_error("qbittorrent", f"HTTP {response.status_code}")
        qb_clear_session()

        fresh_sid = await qb_login(force_new=True)
        if not fresh_sid:
            return response

        return await client.get(
            f"{QBITTORRENT_URL.rstrip('/')}/{endpoint}",
            cookies={"SID": fresh_sid},
        )


async def _qb_batch_torrent_mutation(
    sid: str,
    hashes: List[str],
    endpoint: str,
    count_key: str,
    success_log: str,
    data_extra: Optional[Dict[str, str]] = None,
) -> Dict:
    if not sid or not hashes:
        return {"success": False, count_key: 0, "failed": hashes or [], "error": "无效的会话或哈希"}

    normalized_hashes, invalid_hashes = _normalize_info_hashes(hashes)
    if invalid_hashes:
        return {"success": False, count_key: 0, "failed": hashes, "error": "无效的哈希选择器"}

    selected_hashes, failed_hashes = await _select_managed_hashes(sid, normalized_hashes)
    if not selected_hashes:
        return {"success": False, count_key: 0, "failed": failed_hashes, "error": "没有可操作的 MT-Engine 种子"}

    data = {"hashes": "|".join(normalized_hash for normalized_hash, _ in selected_hashes)}
    if data_extra:
        data.update(data_extra)

    response = await _post_qb_mutation_with_retry(sid, endpoint, data)
    if response.status_code == 200:
        logger.info(success_log, len(selected_hashes))
        runtime_status.mark_success("qbittorrent")
        return {"success": True, count_key: len(selected_hashes), "failed": failed_hashes}

    error_msg = f"qBittorrent API 错误: HTTP {response.status_code}"
    logger.error(error_msg)
    runtime_status.mark_error("qbittorrent", error_msg)
    return {"success": False, count_key: 0, "failed": [original_hash for _, original_hash in selected_hashes] + failed_hashes, "error": error_msg}


async def qb_get_torrents(sid: str) -> List[Dict]:
    """
    获取 qBittorrent 中的所有种子

    Args:
        sid: qBittorrent 会话 ID

    Returns:
        List[Dict]: 种子列表
    """
    if not sid:
        return []

    try:
        response = await _get_qb_with_retry(sid, "api/v2/torrents/info")
        if response.status_code != 200:
            logger.warning("qBittorrent 获取种子失败: HTTP %s", response.status_code)
            runtime_status.mark_error("qbittorrent", f"HTTP {response.status_code}")
            return []

        torrents = response.json()
        runtime_status.mark_success("qbittorrent")
        return torrents
    except Exception as e:
        logger.error(f"获取 qBittorrent 种子列表失败: {e}")
        runtime_status.mark_error("qbittorrent", e)
        return []


async def qb_get_torrent_trackers(torrent_hash: str, sid: str) -> List[Dict]:
    """
    获取指定种子的 tracker 列表

    Args:
        torrent_hash: 种子哈希值
        sid: qBittorrent 会话 ID

    Returns:
        List[Dict]: Tracker 列表
    """
    if not sid:
        return []

    try:
        # 使用独立的客户端，避免 cookie 干扰
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{QBITTORRENT_URL.rstrip('/')}/api/v2/torrents/trackers",
                params={"hash": torrent_hash},
                cookies={"SID": sid},
            )

            # 检查认证失败
            if response.status_code in (401, 403):
                logger.warning("qBittorrent 会话已过期，清除缓存")
                runtime_status.mark_error("qbittorrent", f"HTTP {response.status_code}")
                qb_clear_session()
                return []

            trackers = response.json()
            runtime_status.mark_success("qbittorrent")
            return trackers
    except Exception as e:
        logger.error(f"获取种子 tracker 失败: {e}")
        runtime_status.mark_error("qbittorrent", e)
        return []


async def qb_pause_torrents(sid: str, hashes: List[str]) -> Dict:
    """
    批量暂停种子（单次 API 调用）

    Args:
        sid: qBittorrent 会话 ID
        hashes: 种子哈希列表

    Returns:
        Dict: {"success": bool, "paused_count": int, "failed": List[str]}
    """
    try:
        return await _qb_batch_torrent_mutation(
            sid,
            hashes,
            "api/v2/torrents/stop",
            "paused_count",
            "批量暂停成功: %s 个种子",
        )
    except Exception as e:
        error_msg = f"暂停异常: {str(e)}"
        logger.error(f"批量暂停异常: {e}")
        runtime_status.mark_error("qbittorrent", e)
        return {"success": False, "paused_count": 0, "failed": hashes or [], "error": error_msg}


async def qb_resume_torrents(sid: str, hashes: List[str]) -> Dict:
    """
    批量恢复种子（单次 API 调用）

    Args:
        sid: qBittorrent 会话 ID
        hashes: 种子哈希列表

    Returns:
        Dict: {"success": bool, "resumed_count": int, "failed": List[str]}
    """
    try:
        return await _qb_batch_torrent_mutation(
            sid,
            hashes,
            "api/v2/torrents/start",
            "resumed_count",
            "批量恢复成功: %s 个种子",
        )
    except Exception as e:
        error_msg = f"恢复异常: {str(e)}"
        logger.error(f"批量恢复异常: {e}")
        runtime_status.mark_error("qbittorrent", e)
        return {"success": False, "resumed_count": 0, "failed": hashes or [], "error": error_msg}


async def qb_delete_torrents(sid: str, hashes: List[str], delete_files: bool = True) -> Dict:
    """
    批量删除种子（单次 API 调用）

    Args:
        sid: qBittorrent 会话 ID
        hashes: 种子哈希列表
        delete_files: 是否同时删除文件（默认 True）

    Returns:
        Dict: {"success": bool, "deleted_count": int, "failed": List[str]}
    """
    try:
        return await _qb_batch_torrent_mutation(
            sid,
            hashes,
            "api/v2/torrents/delete",
            "deleted_count",
            "批量删除成功: %s 个种子",
            {"deleteFiles": "true" if delete_files else "false"},
        )
    except Exception as e:
        logger.error(f"批量删除异常: {e}")
        runtime_status.mark_error("qbittorrent", e)
        return {"success": False, "deleted_count": 0, "failed": hashes or [], "error": str(e)}


async def qb_get_mteam_torrents(sid: str, tag_filter: Optional[str] = None,
                                status_filter: Optional[str] = None) -> List[Dict]:
    """
    获取所有 MT-Engine 管理的种子（带健康度监控）

    Args:
        sid: qBittorrent 会话 ID
        tag_filter: 标签筛选（需匹配 MANAGED_TORRENT_TAGS）
        status_filter: 状态筛选 ("downloading" | "seeding" | "paused" | "completed")

    Returns:
        List[Dict]: 种子列表
    """
    if not sid:
        return []

    try:
        # 获取所有种子
        all_torrents = await qb_get_torrents(sid)

        result = []
        for torrent in all_torrents:
            # 筛选 MT-Engine 标签
            torrent_tags = _split_qb_tags(torrent.get('tags', ''))
            managed_tags = torrent_tags.intersection(MANAGED_TORRENT_TAGS)

            if not managed_tags:
                continue

            # 标签筛选
            if tag_filter and tag_filter not in torrent_tags:
                continue

            # 状态筛选
            state = torrent.get('state', '')
            if status_filter:
                if status_filter == "downloading" and state not in ('downloading', 'stalledDL', 'metaDL'):
                    continue
                elif status_filter == "seeding" and state not in ('uploading', 'stalledUP'):
                    continue
                elif status_filter == "paused" and state not in ('pausedDL', 'pausedUP'):
                    continue
                elif status_filter == "completed" and torrent.get('progress', 0) < 1.0:
                    continue

            # 计算健康度
            trackers = await qb_get_torrent_trackers(torrent.get('hash', ''), sid)
            health = calculate_torrent_health(torrent, trackers)

            # 提取 M-Team ID
            mteam_id = extract_mteam_id_from_trackers(trackers)

            # 格式化种子信息
            formatted = {
                "hash": torrent.get('hash', ''),
                "name": torrent.get('name', ''),
                "size": torrent.get('size', 0),
                "size_display": format_size(torrent.get('size', 0)),
                "progress": torrent.get('progress', 0),
                "status": state,
                "tags": list(managed_tags),
                "ratio": round(torrent.get('ratio', 0), 2),
                "uploaded": torrent.get('uploaded', 0),
                "downloaded": torrent.get('downloaded', 0),
                "upload_speed": torrent.get('upspeed', 0),
                "download_speed": torrent.get('dlspeed', 0),
                "seeders": torrent.get('num_complete', 0),  # Total seeders in swarm
                "leechers": torrent.get('num_incomplete', 0),  # Total leechers in swarm
                "added_on": torrent.get('added_on', 0),
                "eta": torrent.get('eta', 8640000) if torrent.get('eta', 8640000) < 8640000 else None,
                "health": health,
                "mteam_id": mteam_id
            }

            result.append(formatted)

        logger.info(f"获取到 {len(result)} 个 MT-Engine 种子")
        runtime_status.mark_success("qbittorrent")
        return result

    except Exception as e:
        logger.error(f"获取 MT-Engine 种子失败: {e}")
        runtime_status.mark_error("qbittorrent", e)
        return []


async def qb_get_storage_info(sid: str) -> Optional[Dict]:
    """
    获取存储空间信息（从 qBittorrent API）

    Args:
        sid: qBittorrent 会话 ID

    Returns:
        Optional[Dict]: 存储信息，失败返回包含 error 的 Dict
    """
    logger.info(f"qb_get_storage_info called, sid={'present' if sid else 'None'}")

    if not sid:
        logger.warning("qb_get_storage_info: sid is None")
        return {"error": "sid is None"}

    try:
        # 使用 qBittorrent API 的 /sync/maindata 端点
        # 这个端点包含 free_space_on_disk 和 server_state 信息
        response = await _get_qb_with_retry(sid, "api/v2/sync/maindata")

        if response.status_code != 200:
            error_msg = f"qBittorrent API 返回错误: HTTP {response.status_code}"
            logger.warning(error_msg)
            runtime_status.mark_error("qbittorrent", error_msg)
            return {"error": error_msg}

        data = response.json()
        logger.info(f"Received maindata keys: {data.keys()}")

        # 获取服务器状态信息
        server_state = data.get('server_state', {})
        free_space = server_state.get('free_space_on_disk', 0)

        if free_space == 0:
            logger.warning("free_space_on_disk is 0, may not be available")

        # 由于 API 只提供剩余空间，我们需要计算总空间
        # 使用 shutil 作为后备方案来获取总空间
        try:
            import shutil
            stat = shutil.disk_usage('/downloads')
            total = stat.total
            used = total - free_space
        except Exception as e:
            logger.warning(f"无法使用 shutil 获取总空间，仅使用剩余空间: {e}")
            # 如果无法获取总空间，假设一个合理的值（避免除零错误）
            used = 0
            total = free_space * 2 if free_space > 0 else 1

        percent = (used / total) * 100 if total > 0 else 0

        logger.info(f"获取存储信息成功: {percent:.1f}% 已使用, 剩余 {format_size(free_space)}")
        runtime_status.mark_success("qbittorrent")

        result = {
            "total": total,
            "used": used,
            "free": free_space,
            "percent": round(percent, 1),
            "total_display": format_size(total),
            "used_display": format_size(used),
            "free_display": format_size(free_space),
            "save_path": "/downloads"
        }

        return result
    except Exception as e:
        error_msg = f"获取存储信息失败: {str(e)}"
        logger.error(error_msg, exc_info=True)
        runtime_status.mark_error("qbittorrent", e)
        return {"error": error_msg}


async def qb_find_torrent_by_mteam_id(
    mteam_id: str,
    sid: str,
    managed_only: bool = False,
    allowed_tags: Optional[Set[str]] = None,
    excluded_tags: Optional[Set[str]] = None,
) -> Optional[str]:
    """
    通过 M-Team ID 查找 qBittorrent 中的种子

    Args:
        mteam_id: M-Team 种子 ID
        sid: qBittorrent 会话 ID
        managed_only: 为 True 时仅匹配带有精确托管标签的种子
        allowed_tags: 限定可匹配的标签集合（仅在 managed_only 时生效）。
            默认 None 表示沿用全部托管标签 MANAGED_TORRENT_TAGS。
        excluded_tags: 带有任一排除标签时不匹配（仅在 managed_only 时生效）。

    Returns:
        Optional[str]: 找到返回种子哈希值，否则返回 None
    """
    eligible_tags = allowed_tags if allowed_tags is not None else MANAGED_TORRENT_TAGS
    torrents = await qb_get_torrents(sid)

    for torrent in torrents:
        torrent_hash = torrent.get("hash")
        if not torrent_hash:
            continue

        if managed_only:
            tags = _split_qb_tags(torrent.get("tags", ""))
            if not tags.intersection(eligible_tags):
                continue
            if excluded_tags is not None and tags.intersection(excluded_tags):
                continue

        # 获取该种子的 trackers
        trackers = await qb_get_torrent_trackers(torrent_hash, sid)

        tracker_mteam_id = extract_mteam_id_from_trackers(trackers)
        if tracker_mteam_id == mteam_id:
            logger.info(
                f"找到 M-Team 种子 {mteam_id} 对应的 qBittorrent 种子: {torrent.get('name')}"
            )
            return torrent_hash

    return None


async def qb_delete_torrent(torrent_hash: str, sid: str, delete_files: bool = False) -> bool:
    """
    从 qBittorrent 删除种子

    Args:
        torrent_hash: 种子哈希值
        sid: qBittorrent 会话 ID
        delete_files: 是否同时删除文件（默认 False，仅删除种子）

    Returns:
        bool: 删除成功返回 True，否则返回 False
    """
    if not sid:
        return False

    try:
        response = await _post_qb_mutation_with_retry(
            sid,
            "api/v2/torrents/delete",
            {"hashes": torrent_hash, "deleteFiles": "true" if delete_files else "false"},
        )

        if response.status_code in (401, 403):
            return False

        if response.status_code == 200:
            logger.info(f"成功从 qBittorrent 删除种子: {torrent_hash}")
            runtime_status.mark_success("qbittorrent")
            return True
        else:
            logger.error(f"从 qBittorrent 删除种子失败: {response.text}")
            runtime_status.mark_error("qbittorrent", response.text)
            return False
    except Exception as e:
        logger.error(f"删除 qBittorrent 种子异常: {e}")
        runtime_status.mark_error("qbittorrent", e)
        return False


async def qb_add_torrent_by_url(torrent_url: str, sid: str, tag: str = "") -> bool:
    """
    通过 URL 添加种子到 qBittorrent

    Args:
        torrent_url: 种子下载 URL
        sid: qBittorrent 会话 ID
        tag: 种子标签（可选）

    Returns:
        bool: 添加成功返回 True
    """
    if not sid or not torrent_url:
        return False

    try:
        data = {"urls": torrent_url}
        if tag:
            data["tags"] = tag  # qBittorrent 支持在添加时设置标签

        response = await _post_qb_mutation_with_retry(
            sid,
            "api/v2/torrents/add",
            data,
            timeout=30.0,
        )

        if response.status_code in (401, 403):
            return False

        # qBittorrent API 返回 "Ok." 表示成功
        if is_qb_add_success(response):
            logger.info(f"成功添加种子到 qBittorrent (标签: {tag}): {torrent_url[:50]}...")
            runtime_status.mark_success("qbittorrent")
            return True
        else:
            logger.error(f"添加种子失败: HTTP={response.status_code}, body={response.text!r}")
            runtime_status.mark_error("qbittorrent", f"HTTP={response.status_code}, body={response.text!r}")
            return False
    except Exception as e:
        logger.error(f"添加种子异常: {e}")
        runtime_status.mark_error("qbittorrent", e)
        return False


async def qb_add_torrent_file(torrent_content: bytes, sid: str, tag: str = "", savepath: str = "") -> bool:
    """
    通过文件内容添加种子到 qBittorrent

    Args:
        torrent_content: 种子文件二进制内容
        sid: qBittorrent 会话 ID
        tag: 种子标签（可选）
        savepath: 下载路径（可选）

    Returns:
        bool: 添加成功返回 True
    """
    if not sid or not torrent_content:
        return False

    normalized_savepath = ""
    if savepath:
        try:
            normalized_savepath = normalize_download_save_path(savepath)
        except ValueError as e:
            logger.error(f"拒绝不安全的下载路径: {e}")
            runtime_status.mark_error("qbittorrent", e)
            return False

    try:
        # Construct multipart/form-data payload
        files = {'torrents': ('meta.torrent', torrent_content, 'application/x-bittorrent')}
        data: Dict[str, str] = {}
        if tag:
            data["tags"] = tag
        if normalized_savepath:
            data["savepath"] = normalized_savepath

        response = await _post_qb_mutation_with_retry(
            sid,
            "api/v2/torrents/add",
            data,
            files=files,
            timeout=30.0,
        )

        if response.status_code in (401, 403):
            return False

        if is_qb_add_success(response):
            logger.info(f"成功通过文件添加种子到 qBittorrent (标签: {tag})")
            runtime_status.mark_success("qbittorrent")
            return True
        else:
            logger.error(f"添加种子文件失败: HTTP={response.status_code}, body={response.text!r}")
            runtime_status.mark_error("qbittorrent", f"HTTP={response.status_code}, body={response.text!r}")
            return False
    except Exception as e:
        logger.error(f"添加种子文件异常: {e}")
        runtime_status.mark_error("qbittorrent", e)
        return False


async def qb_get_mteam_stats(sid: str) -> Dict:
    """
    统计 M-Team 相关标签的种子流量和数量

    Args:
        sid: qBittorrent 会话 ID

    Returns:
        Dict: 包含上传下载总量、速率、做种数和下载数
    """
    torrents = await qb_get_torrents(sid)

    total_uploaded = 0
    total_downloaded = 0
    upload_speed = 0
    download_speed = 0
    seeding_count = 0
    leeching_count = 0

    # qBittorrent 种子状态定义
    seeding_states = ('uploading', 'stalledUP', 'pausedUP', 'queuedUP', 'forcedUP', 'checkingUP')
    leeching_states = ('downloading', 'stalledDL', 'metaDL', 'pausedDL', 'queuedDL', 'forcedDL', 'checkingDL')

    for torrent in torrents:
        if _is_managed_torrent(torrent):
            total_uploaded += torrent.get('uploaded', 0)
            total_downloaded += torrent.get('downloaded', 0)
            upload_speed += torrent.get('upspeed', 0)
            download_speed += torrent.get('dlspeed', 0)

            # 统计做种和下载数量
            state = torrent.get('state', '')
            if state in seeding_states:
                seeding_count += 1
            elif state in leeching_states:
                leeching_count += 1

    logger.debug(f"M-Team 标签统计: 上传={total_uploaded}, 下载={total_downloaded}, 做种={seeding_count}, 下载中={leeching_count}")
    return {
        'uploaded': total_uploaded,
        'downloaded': total_downloaded,
        'upload_speed': upload_speed,
        'download_speed': download_speed,
        'seeding_count': seeding_count,
        'leeching_count': leeching_count
    }


async def qb_get_existing_mteam_ids(sid: str) -> set:
    """
    批量获取 qBittorrent 中所有种子的 M-Team ID

    用于 PILOT 下载前检查，避免重复添加已存在的种子。

    Args:
        sid: qBittorrent 会话 ID

    Returns:
        set: 已存在种子的 M-Team ID 集合
    """
    existing_ids = set()

    if not sid:
        return existing_ids

    try:
        torrents = await qb_get_torrents(sid)

        for torrent in torrents:
            torrent_hash = torrent.get("hash")
            if not torrent_hash:
                continue

            # 获取 tracker 信息
            trackers = await qb_get_torrent_trackers(torrent_hash, sid)

            mteam_id = extract_mteam_id_from_trackers(trackers)
            if mteam_id:
                existing_ids.add(mteam_id)

        logger.debug(f"找到 {len(existing_ids)} 个已存在的 M-Team 种子")
        runtime_status.mark_success("qbittorrent")

    except Exception as e:
        logger.error(f"获取已存在 M-Team ID 失败: {e}")
        runtime_status.mark_error("qbittorrent", e)

    return existing_ids
