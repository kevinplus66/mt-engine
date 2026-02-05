"""
M-Team API 集成服务
"""

from typing import List, Dict, Optional, Any
from app.config import (
    MT_TOKEN, MT_USER_ID, MT_API_BASE, MT_SEARCH_URL, MT_CATEGORY_URL,
    MT_USER_TORRENT_URL, MT_PROFILE_URL, USER_AGENT, logger
)
from app.services.http_client import get_http_client
from app.utils import is_api_success, format_size, _safe_int
import asyncio


class MTClient:
    """M-Team API 客户端，封装所有 API 调用"""

    def _headers(self, content_type: Optional[str] = "application/json") -> Dict[str, str]:
        headers = {
            "User-Agent": USER_AGENT,
            "x-api-key": MT_TOKEN.strip(),
            "Accept": "application/json",
        }
        if content_type:
            headers["Content-Type"] = content_type
        return headers

    async def _request(
        self,
        url: str,
        *,
        json: Optional[Dict] = None,
        data: Optional[Dict] = None,
        headers: Optional[Dict] = None,
        timeout: Optional[float] = None,
        label: str = "",
    ) -> Optional[Any]:
        """统一请求：token 检查 → post → parse JSON → is_api_success → return data 字段 or None"""
        if not MT_TOKEN:
            return None

        try:
            client = await get_http_client()
            kwargs: Dict[str, Any] = {"headers": headers or self._headers()}
            if json is not None:
                kwargs["json"] = json
            if data is not None:
                kwargs["data"] = data
            if timeout is not None:
                kwargs["timeout"] = timeout

            response = await client.post(url, **kwargs)

            try:
                result = response.json()
                # 临时变量
                _r = {
                    'code': result.get('code'),
                    'message': result.get('message'),
                }
                logger.info(f"label <{label}> API 响应:<{_r}>")
            except Exception as e:
                logger.error(f"{label} JSON解析错误: {e}")
                return None

            if is_api_success(result.get("code")):
                return result.get("data")
            else:
                logger.error(f"{label} 失败: {result.get('message')}")
                return None
        except Exception as e:
            logger.error(f"{label} 异常: {e}")
            return None

    # ── 业务方法 ──────────────────────────────────────────────

    async def fetch_categories(self) -> List[Dict]:
        """获取种子类别列表"""
        data = await self._request(MT_CATEGORY_URL, json={}, label="获取类别")
        return data if isinstance(data, list) else []

    async def search_free_torrents(
        self,
        discount_type: str = "FREE",
        mode: str = "normal",
        page: int = 1,
        page_size: int = 200,
    ) -> List[Dict]:
        """搜索免费种子"""
        payload = {
            "mode": mode,
            "discount": discount_type,
            "pageNumber": page,
            "pageSize": page_size,
        }
        label = f"搜索 {discount_type} (mode={mode})"
        data = await self._request(MT_SEARCH_URL, json=payload, label=label)
        if isinstance(data, dict):
            return data.get("data", [])
        return []

    async def fetch_user_torrent_status(self) -> Dict[str, Dict]:
        """获取用户的做种和下载中的种子状态"""
        from app.config import API_DELAY

        if not MT_USER_ID:
            return {"seeding": {}, "leeching": {}}

        userid = int(MT_USER_ID)
        result: Dict[str, Dict] = {"seeding": {}, "leeching": {}}

        # 做种中
        seeding_data = await self._request(
            MT_USER_TORRENT_URL,
            json={"userid": userid, "type": "SEEDING", "pageNumber": 1, "pageSize": 200},
            label="获取做种中种子",
        )
        if isinstance(seeding_data, dict):
            for item in seeding_data.get("data", []):
                tid = str(item.get("torrent", {}).get("id", item.get("id", "")))
                result["seeding"][tid] = item
            logger.info(f"获取到 {len(result['seeding'])} 个做种中种子")

        await asyncio.sleep(max(API_DELAY, 2))

        # 下载中
        leeching_data = await self._request(
            MT_USER_TORRENT_URL,
            json={"userid": userid, "type": "LEECHING", "pageNumber": 1, "pageSize": 200},
            label="获取下载中种子",
        )
        if isinstance(leeching_data, dict):
            for item in leeching_data.get("data", []):
                tid = str(item.get("torrent", {}).get("id", item.get("id", "")))
                result["leeching"][tid] = item
            logger.info(f"获取到 {len(result['leeching'])} 个下载中种子")

        return result

    async def fetch_user_profile(self) -> Optional[Dict[str, Any]]:
        """获取用户资料（分享率、上传、下载）"""
        if not MT_USER_ID:
            logger.warning("未配置 MT_USER_ID，无法获取用户资料")
            return None

        try:
            profile_data = await self._fetch_profile_by_uid(MT_USER_ID)
            if profile_data:
                logger.debug(f"获取用户资料: 分享率={profile_data['share_ratio']:.2f}")
                return profile_data
        except Exception as e:
            logger.error(f"获取用户资料失败: {e}")
        return None

    async def _fetch_profile_by_uid(self, uid: str) -> Optional[Dict[str, Any]]:
        """根据用户ID获取资料"""
        # profile 接口使用 form data，不设 Content-Type
        headers = self._headers(content_type=None)
        member_data = await self._request(
            MT_PROFILE_URL,
            data={"uid": str(uid)},
            headers=headers,
            label=f"获取用户资料 (uid={uid})",
        )
        if member_data is None:
            return None
        if not isinstance(member_data, dict):
            return None

        # 尝试多种数据结构路径
        member_count = member_data.get("memberCount", {})

        uploaded = _safe_int(member_count.get("uploaded", 0))
        downloaded = _safe_int(member_count.get("downloaded", 0))
        share_ratio_from_api = member_count.get("shareRate")

        if uploaded == 0 and downloaded == 0:
            uploaded = _safe_int(member_data.get("uploaded", 0))
            downloaded = _safe_int(member_data.get("downloaded", 0))
            if share_ratio_from_api is None:
                share_ratio_from_api = member_data.get("shareRate")

        if uploaded == 0 and downloaded == 0:
            member = member_data.get("member", {})
            uploaded = _safe_int(member.get("uploaded", 0))
            downloaded = _safe_int(member.get("downloaded", 0))
            if share_ratio_from_api is None:
                share_ratio_from_api = member.get("shareRate")

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
            "downloaded_display": format_size(downloaded),
        }

    async def fetch_country_list(self) -> Dict[int, str]:
        """获取国家列表并返回ID到名称的映射"""
        data = await self._request(
            f"{MT_API_BASE}/system/countryList",
            json={},
            headers={"x-api-key": MT_TOKEN},
            timeout=10,
            label="获取国家列表",
        )
        if not isinstance(data, list):
            return {}
        countries = {int(c["id"]): c.get("name", "") for c in data}
        logger.info(f"成功获取 {len(countries)} 个国家")
        return countries


# 单例
mt_client = MTClient()
