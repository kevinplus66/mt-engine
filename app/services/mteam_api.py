"""
M-Team API 集成服务
"""

from typing import List, Dict, Optional, Any
from app.config import (
    MT_TOKEN, MT_USER_ID, MT_API_BASE, MT_SEARCH_URL, MT_CATEGORY_URL,
    MT_USER_TORRENT_URL, MT_PROFILE_URL, USER_AGENT, logger
)
from app.services.http_client import get_http_client, get_headers
from app.utils import is_api_success, format_size, _safe_int
import asyncio


async def fetch_categories() -> List[Dict]:
    """获取种子类别列表"""
    if not MT_TOKEN:
        return []

    try:
        client = await get_http_client()
        response = await client.post(MT_CATEGORY_URL, headers=get_headers(), json={})
        try:
            data = response.json()
            logger.info(f'获取类别 API 响应:<{data}>')
        except Exception as e:
            logger.error(f"获取类别失败 - JSON解析错误: {e}")
            return []
        if is_api_success(data.get("code")):
            return data.get("data", [])
        else:
            logger.error(f"获取类别失败: {data.get('message')}")
    except Exception as e:
        logger.error(f"获取类别失败: {e}")
    return []


async def search_free_torrents(
    discount_type: str = "FREE",
    mode: str = "normal",
    page: int = 1,
    page_size: int = 200
) -> List[Dict]:
    """搜索免费种子"""
    if not MT_TOKEN:
        return []

    payload = {
        "mode": mode,
        "discount": discount_type,
        "pageNumber": page,
        "pageSize": page_size
    }

    try:
        client = await get_http_client()
        response = await client.post(MT_SEARCH_URL, headers=get_headers(), json=payload)
        try:
            data = response.json()
            logger.info(f'搜索 {discount_type} (mode={mode}) API 响应:<{data}>')
        except Exception as e:
            logger.error(f"搜索 {discount_type} (mode={mode}) 失败 - JSON解析错误: {e}")
            return []

        if is_api_success(data.get("code")):
            return data.get("data", {}).get("data", [])
        else:
            logger.error(f"搜索 {discount_type} (mode={mode}) 失败: {data.get('message')}")
            logger.info(f'搜索失败的详细报错:<{data}>')
    except Exception as e:
        logger.error(f"搜索 {discount_type} (mode={mode}) 异常: {e}")

    return []


async def fetch_user_torrent_status() -> Dict[str, Dict]:
    """获取用户的做种和下载中的种子状态"""
    from app.config import API_DELAY

    if not MT_TOKEN or not MT_USER_ID:
        return {"seeding": {}, "leeching": {}}

    try:
        userid = int(MT_USER_ID)
        client = await get_http_client()
        result = {"seeding": {}, "leeching": {}}

        # 获取做种中的种子
        seeding_payload = {"userid": userid, "type": "SEEDING", "pageNumber": 1, "pageSize": 200}
        seeding_response = await client.post(MT_USER_TORRENT_URL, headers=get_headers(), json=seeding_payload)
        seeding_data = seeding_response.json()
        logger.info(f'获取做种中种子 API 响应:<{seeding_data}>')

        if is_api_success(seeding_data.get("code")):
            seeding_list = seeding_data.get("data", {}).get("data", [])
            result["seeding"] = {
                str(item.get("torrent", {}).get("id", item.get("id", ""))): item
                for item in seeding_list
            }
            logger.info(f"获取到 {len(result['seeding'])} 个做种中种子")
        else:
            logger.error(f"获取做种中种子失败: code={seeding_data.get('code')}, message={seeding_data.get('message')}")

        # 增加延迟避免 API 速率限制
        await asyncio.sleep(max(API_DELAY, 2))

        # 获取下载中的种子
        leeching_payload = {"userid": userid, "type": "LEECHING", "pageNumber": 1, "pageSize": 200}
        leeching_response = await client.post(MT_USER_TORRENT_URL, headers=get_headers(), json=leeching_payload)
        leeching_data = leeching_response.json()
        logger.info(f'获取下载中种子 API 响应:<{leeching_data}>')
        logger.debug(f"LEECHING API 响应: code={leeching_data.get('code')}, data keys={list(leeching_data.get('data', {}).keys()) if isinstance(leeching_data.get('data'), dict) else type(leeching_data.get('data'))}")

        if is_api_success(leeching_data.get("code")):
            leeching_list = leeching_data.get("data", {}).get("data", [])
            result["leeching"] = {
                str(item.get("torrent", {}).get("id", item.get("id", ""))): item
                for item in leeching_list
            }
            logger.info(f"获取到 {len(result['leeching'])} 个下载中种子")
        else:
            logger.warning(f"获取下载中种子失败: code={leeching_data.get('code')}, message={leeching_data.get('message')}")

        return result

    except Exception as e:
        logger.error(f"获取用户种子状态失败: {e}")
        return {"seeding": {}, "leeching": {}}


async def fetch_user_profile() -> Optional[Dict[str, Any]]:
    """获取用户资料（分享率、上传、下载）"""
    if not MT_TOKEN or not MT_USER_ID:
        if not MT_USER_ID:
            logger.warning("未配置 MT_USER_ID，无法获取用户资料")
        return None

    try:
        profile_data = await _fetch_profile_by_uid(MT_USER_ID)
        if profile_data:
            logger.debug(f"获取用户资料: 分享率={profile_data['share_ratio']:.2f}")
            return profile_data
    except Exception as e:
        logger.error(f"获取用户资料失败: {e}")
    return None


async def _fetch_profile_by_uid(uid: str) -> Optional[Dict[str, Any]]:
    """通用函数：根据用户ID获取资料"""
    try:
        client = await get_http_client()

        headers = {
            "User-Agent": USER_AGENT,
            "x-api-key": MT_TOKEN.strip(),
            "Accept": "application/json",
        }
        form_data = {"uid": str(uid)}
        response = await client.post(MT_PROFILE_URL, headers=headers, data=form_data)
        data = response.json()
        logger.info(f'获取用户资料 (uid={uid}) API 响应:<{data}>')

        logger.debug(f"Profile API 响应 (uid={uid}): code={data.get('code')}")

        if is_api_success(data.get("code")):
            member_data = data.get("data", {})

            # 尝试多种数据结构路径
            member_count = member_data.get("memberCount", {})

            # 尝试从 memberCount 获取
            uploaded = _safe_int(member_count.get("uploaded", 0))
            downloaded = _safe_int(member_count.get("downloaded", 0))
            share_ratio_from_api = member_count.get("shareRate")

            # 如果 memberCount 没有数据，尝试从 member_data 直接获取
            if uploaded == 0 and downloaded == 0:
                uploaded = _safe_int(member_data.get("uploaded", 0))
                downloaded = _safe_int(member_data.get("downloaded", 0))
                if share_ratio_from_api is None:
                    share_ratio_from_api = member_data.get("shareRate")

            # 如果还没有，尝试从 member 字段获取
            if uploaded == 0 and downloaded == 0:
                member = member_data.get("member", {})
                uploaded = _safe_int(member.get("uploaded", 0))
                downloaded = _safe_int(member.get("downloaded", 0))
                if share_ratio_from_api is None:
                    share_ratio_from_api = member.get("shareRate")

            # 使用 API 返回的分享率，或者自己计算
            if share_ratio_from_api is not None:
                try:
                    share_ratio = float(share_ratio_from_api)
                except (ValueError, TypeError):
                    share_ratio = 0.0
            elif downloaded > 0:
                share_ratio = uploaded / downloaded
            else:
                share_ratio = 99999.99 if uploaded > 0 else 0.0

            return {
                "share_ratio": share_ratio,
                "uploaded": uploaded,
                "downloaded": downloaded,
                "uploaded_display": format_size(uploaded),
                "downloaded_display": format_size(downloaded)
            }
        else:
            logger.warning(f"获取用户资料失败 (uid={uid}): {data.get('message')}")
            return None

    except Exception as e:
        logger.error(f"获取用户资料异常 (uid={uid}): {e}")
        return None


async def fetch_country_list() -> Dict[int, str]:
    """获取国家列表并返回ID到名称的映射"""
    if not MT_TOKEN:
        return {}

    try:
        client = await get_http_client()
        response = await client.post(
            f"{MT_API_BASE}/system/countryList",
            headers={"x-api-key": MT_TOKEN},
            json={},
            timeout=10
        )
        result = response.json()
        logger.info(f'获取国家列表 API 响应:<{result}>')

        # M-Team API返回code可能是0, "0", 或"SUCCESS"
        code = result.get("code")
        if code in (0, "0", "SUCCESS"):
            countries = {}
            for country in result.get("data", []):
                countries[int(country["id"])] = country.get("name", "")
            logger.info(f"成功获取 {len(countries)} 个国家")
            return countries
        else:
            logger.error(f"获取国家列表失败: code={code}, message={result.get('message')}")
            return {}
    except Exception as e:
        logger.error(f"获取国家列表异常: {e}")
        return {}
