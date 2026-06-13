"""
M-Team API 集成服务
"""

from dataclasses import dataclass
from typing import List, Dict, Optional, Any
from app.config import (
    API_DELAY, MT_TOKEN, MT_USER_ID, MT_API_BASE, MT_SEARCH_URL, MT_CATEGORY_URL,
    MT_USER_TORRENT_URL, MT_PROFILE_URL, USER_AGENT, logger
)
from app.services.http_client import get_http_client
from app.services.runtime_status import runtime_status
from app.utils import is_api_success, format_size, _safe_int
import asyncio
import time


FREE_SEARCH_MAX_PAGES = 20


@dataclass(frozen=True)
class FreeTorrentSearchResult:
    """Status-bearing result for one free-search shard."""

    items: List[Dict]
    succeeded: bool
    complete: bool
    pages_fetched: int
    total: Optional[int] = None
    error: Optional[str] = None


class MTClient:
    """M-Team API 客户端，封装所有 API 调用"""

    def __init__(
        self,
        request_delay: Optional[float] = None,
        sleeper=asyncio.sleep,
        monotonic=time.monotonic,
    ):
        self._request_lock = asyncio.Lock()
        self._last_request_at: Optional[float] = None
        self._request_delay = API_DELAY if request_delay is None else request_delay
        self._sleeper = sleeper
        self._monotonic = monotonic
        self._last_error: Optional[str] = None

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
        params: Optional[Dict] = None,
        headers: Optional[Dict] = None,
        timeout: Optional[float] = None,
        label: str = "",
    ) -> Optional[Any]:
        """统一请求：token 检查 → post → HTTP 状态检查 → parse JSON → is_api_success → return data 字段 or None"""
        if not MT_TOKEN:
            self._last_error = "MT_TOKEN 未配置"
            logger.error(f'{label} 失败: MT_TOKEN 未配置')
            runtime_status.mark_error("mteam", "MT_TOKEN 未配置")
            return None

        try:
            client = await get_http_client()
            kwargs: Dict[str, Any] = {"headers": headers or self._headers()}
            if json is not None:
                kwargs["json"] = json
            if data is not None:
                kwargs["data"] = data
            if params is not None:
                kwargs["params"] = params
            if timeout is not None:
                kwargs["timeout"] = timeout

            async with self._request_lock:
                await self._wait_for_request_slot()
                try:
                    response = await client.post(url, **kwargs)
                finally:
                    self._last_request_at = self._monotonic()

            if response.status_code >= 400:
                error = f"HTTP {response.status_code}"
                self._last_error = error
                logger.error(f"{label} 失败: {error}")
                runtime_status.mark_error("mteam", error)
                return None

            try:
                result = response.json()
                # 临时变量
                _r = {
                    'code': result.get('code'),
                    'message': result.get('message'),
                }
                logger.info(f"label <{label}> API 响应:<{_r}>")
            except Exception as e:
                error = f"响应非 JSON: {type(e).__name__}: {e}"
                self._last_error = error
                logger.error(f"{label} JSON解析错误: {e}")
                runtime_status.mark_error("mteam", error)
                return None

            if is_api_success(result.get("code")):
                self._last_error = None
                runtime_status.mark_success("mteam")
                return result.get("data")
            else:
                error = result.get('message') or f"API code {result.get('code')}"
                self._last_error = error
                logger.error(f"{label} 失败: {error}")
                runtime_status.mark_error("mteam", error)
                return None
        except Exception as e:
            error = f"{type(e).__name__}: {e}"
            self._last_error = error
            logger.error(f"{label} 异常: {e}")
            runtime_status.mark_error("mteam", error)
            return None

    async def _wait_for_request_slot(self) -> None:
        """Serialize M-Team requests and keep a minimum gap between calls."""
        if self._request_delay <= 0 or self._last_request_at is None:
            return

        elapsed = self._monotonic() - self._last_request_at
        wait_for = self._request_delay - elapsed
        if wait_for > 0:
            await self._sleeper(wait_for)

    # ── 业务方法 ──────────────────────────────────────────────

    @staticmethod
    def _extract_user_torrent_id(item: Any) -> Optional[str]:
        """Return the torrent id from an M-Team user-torrent item, if usable."""
        if not isinstance(item, dict):
            return None

        torrent = item.get("torrent")
        if isinstance(torrent, dict):
            torrent_id = torrent.get("id")
            if torrent_id:
                return str(torrent_id)

        item_id = item.get("id")
        if item_id:
            return str(item_id)
        return None

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
        sort_field: Optional[str] = None,
        sort_direction: Optional[str] = None,
    ) -> List[Dict]:
        """搜索免费种子（兼容旧调用：只返回指定页列表）"""
        page_result = await self._search_free_torrents_page(
            discount_type,
            mode=mode,
            page=page,
            page_size=page_size,
            sort_field=sort_field,
            sort_direction=sort_direction,
        )
        return page_result.items if page_result.succeeded else []

    async def search_free_torrents_page_one_with_status(
        self,
        discount_type: str = "FREE",
        mode: str = "normal",
        page_size: int = 200,
        sort_field: Optional[str] = None,
        sort_direction: Optional[str] = None,
    ) -> FreeTorrentSearchResult:
        """搜索免费种子 page 1 only，并报告单页是否覆盖 API total。"""
        return await self._search_free_torrents_page(
            discount_type,
            mode=mode,
            page=1,
            page_size=page_size,
            sort_field=sort_field,
            sort_direction=sort_direction,
        )

    async def search_free_torrents_with_status(
        self,
        discount_type: str = "FREE",
        mode: str = "normal",
        page_size: int = 200,
        max_pages: int = FREE_SEARCH_MAX_PAGES,
        sort_field: Optional[str] = None,
        sort_direction: Optional[str] = None,
    ) -> FreeTorrentSearchResult:
        """搜索免费种子并报告分页是否完整。"""
        all_items: List[Dict] = []
        total: Optional[int] = None
        page = 1

        while page <= max_pages:
            page_result = await self._search_free_torrents_page(
                discount_type,
                mode=mode,
                page=page,
                page_size=page_size,
                sort_field=sort_field,
                sort_direction=sort_direction,
            )
            if not page_result.succeeded:
                return FreeTorrentSearchResult(
                    items=all_items,
                    succeeded=False,
                    complete=False,
                    pages_fetched=page - 1,
                    total=total,
                    error=page_result.error,
                )

            all_items.extend(page_result.items)
            if page_result.total is not None:
                total = page_result.total

            has_more_by_total = total is not None and len(all_items) < total
            has_more_by_full_page = len(page_result.items) >= page_size
            if not has_more_by_total and not (total is None and has_more_by_full_page):
                return FreeTorrentSearchResult(
                    items=all_items,
                    succeeded=True,
                    complete=True,
                    pages_fetched=page,
                    total=total,
                )

            page += 1

        error = (
            f"搜索 {discount_type} (mode={mode}) 分页超过 {max_pages} 页，"
            "结果可能不完整"
        )
        logger.error(error)
        return FreeTorrentSearchResult(
            items=all_items,
            succeeded=True,
            complete=False,
            pages_fetched=max_pages,
            total=total,
            error=error,
        )

    async def _search_free_torrents_page(
        self,
        discount_type: str,
        *,
        mode: str,
        page: int,
        page_size: int,
        sort_field: Optional[str],
        sort_direction: Optional[str],
    ) -> FreeTorrentSearchResult:
        payload = {
            "mode": mode,
            "discount": discount_type,
            "pageNumber": page,
            "pageSize": page_size,
        }
        if sort_field:
            payload["sortField"] = sort_field
        if sort_direction:
            payload["sortDirection"] = sort_direction
        label = f"搜索 {discount_type} (mode={mode}, page={page})"
        data = await self._request(MT_SEARCH_URL, json=payload, label=label)
        if not isinstance(data, dict):
            return FreeTorrentSearchResult(
                items=[],
                succeeded=False,
                complete=False,
                pages_fetched=0,
                error=f"{label} 失败: {self._last_error or '响应格式异常'}",
            )

        items = data.get("data", [])
        if not isinstance(items, list):
            return FreeTorrentSearchResult(
                items=[],
                succeeded=False,
                complete=False,
                pages_fetched=0,
                error=f"{label} 返回的 data 不是列表",
            )

        total_value = data.get("total")
        total = _safe_int(total_value) if total_value is not None else None
        complete = len(items) < page_size if total is None else len(items) >= total
        return FreeTorrentSearchResult(
            items=items,
            succeeded=True,
            complete=complete,
            pages_fetched=1,
            total=total,
        )

    async def search_torrents(self, payload: Dict[str, Any], label: str = "搜索种子") -> Dict[str, Any]:
        """Search torrents with an arbitrary read-only TorrentSearch payload."""
        data = await self._request(MT_SEARCH_URL, json=payload, label=label)
        return data if isinstance(data, dict) else {}

    async def fetch_douban_media_info(
        self,
        code: str,
        refresh: bool = False,
    ) -> Optional[Dict[str, Any]]:
        """Fetch read-only Douban metadata for poster/year/intro enrichment."""
        if not code:
            return None

        data = await self._request(
            f"{MT_API_BASE}/media/douban/infoV2",
            params={"code": code, "refresh": str(refresh).lower()},
            headers=self._headers(content_type=None),
            timeout=15,
            label="获取豆瓣媒体信息",
        )
        return data if isinstance(data, dict) else None

    async def fetch_imdb_media_info(
        self,
        code: str,
        refresh: bool = False,
    ) -> Optional[Dict[str, Any]]:
        """Fetch read-only IMDb metadata for poster/year/intro enrichment."""
        if not code:
            return None

        data = await self._request(
            f"{MT_API_BASE}/media/imdb/info",
            params={"code": code, "refresh": str(refresh).lower()},
            headers=self._headers(content_type=None),
            timeout=15,
            label="获取 IMDb 媒体信息",
        )
        return data if isinstance(data, dict) else None

    async def get_torrent_download_token(self, torrent_id: str) -> Optional[str]:
        """Generate a torrent download token or signed URL."""
        data = await self._request(
            f"{MT_API_BASE}/torrent/genDlToken",
            params={"id": torrent_id},
            headers=self._headers(content_type=None),
            label=f"生成下载令牌 (torrent_id={torrent_id})",
        )
        return data if isinstance(data, str) and data else None

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
            for item in seeding_data.get("data") or []:
                tid = self._extract_user_torrent_id(item)
                if not tid:
                    continue
                result["seeding"][tid] = item
            logger.info(f"获取到 {len(result['seeding'])} 个做种中种子")

        await asyncio.sleep(max(API_DELAY, 3))

        # 下载中
        leeching_data = await self._request(
            MT_USER_TORRENT_URL,
            json={"userid": userid, "type": "LEECHING", "pageNumber": 1, "pageSize": 200},
            label="获取下载中种子",
        )
        if isinstance(leeching_data, dict):
            for item in leeching_data.get("data") or []:
                tid = self._extract_user_torrent_id(item)
                if not tid:
                    continue
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
            data={"id": str(uid)},
            headers=headers,
            label=f"获取用户资料 (uid={uid})",
        )
        if member_data is None:
            return None
        if not isinstance(member_data, dict):
            return None

        # 调试：记录 API 返回的数据结构
        logger.debug(f"[DEBUG] API 返回的数据字段: {list(member_data.keys())}")
        logger.debug(f"[DEBUG] memberCount 字段: {member_data.get('memberCount', {})}")

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
            logger.error(f'获取失败, data: {data}')
            return {}
        countries = {int(c["id"]): c.get("name", "") for c in data}
        logger.info(f"成功获取 {len(countries)} 个国家")
        return countries


# 单例
mt_client = MTClient()
