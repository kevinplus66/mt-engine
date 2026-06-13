"""
雷达相关 API 路由
"""

from fastapi import Request, HTTPException

from app.models import SearchRequest, DownloadRequest
from app.config import (
    MT_TOKEN, MT_SITE_URL, QBITTORRENT_URL,
    QBITTORRENT_USER, QBITTORRENT_PASSWORD, logger
)
from app.constants import FILTER_OPTIONS, QUALITY_LABELS, QB_TAG_RADAR, COUNTRY_NAME_ZH
from app.state import user_torrent_status
import app.state as state
from app.utils import format_size, get_discount_label, _safe_int
from app.services.mteam_api import mt_client
from app.services.qbittorrent import (
    download_torrent_file, qb_login, qb_add_torrent_file, qb_find_torrent_by_mteam_id
)


async def api_filter_options():
    """获取雷达筛选选项"""
    # 常见影视作品出产国/地区列表（中文名称）
    COMMON_COUNTRIES_ZH = [
        "中国", "中国香港", "中国台湾", "中国澳门",
        "美国", "英国", "日本", "韩国",
        "法国", "德国", "意大利", "西班牙",
        "加拿大", "澳大利亚", "俄罗斯",
        "印度", "泰国", "新加坡",
        "巴西", "墨西哥", "阿根廷"
    ]

    # Build country options from real M-Team data (only if data exists)
    if state.COUNTRY_LABELS:
        # 先翻译所有国家名称
        all_countries = [
            {
                "id": country_id,
                "name": COUNTRY_NAME_ZH.get(country_name, country_name),
                "name_zh": COUNTRY_NAME_ZH.get(country_name, country_name),
                "name_en": country_name
            }
            for country_id, country_name in state.COUNTRY_LABELS.items()
        ]

        # 只保留常见国家
        countries = [
            country for country in all_countries
            if country["name"] in COMMON_COUNTRIES_ZH
        ]

        # 按照常见国家列表的顺序排序
        countries.sort(key=lambda x: COMMON_COUNTRIES_ZH.index(x["name"]) if x["name"] in COMMON_COUNTRIES_ZH else 999)

        return {
            **FILTER_OPTIONS,
            "countries": countries
        }
    else:
        # If no country data loaded, don't include countries field
        # Frontend will use its fallback data
        return FILTER_OPTIONS


async def api_radar(request: Request, data: SearchRequest, check_rate_limit_func, radar_throttle_func):
    """雷达搜索种子"""
    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit_func(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests")

    # Search throttling (防止频繁搜索触发 M-Team API 限制)
    if not radar_throttle_func(client_ip):
        return {"success": False, "message": "搜索过于频繁，请稍后再试", "data": [], "total": 0}

    if not MT_TOKEN:
        return {"success": False, "message": "未配置 MT_TOKEN", "data": [], "total": 0}

    try:
        # 构建搜索请求
        payload = {
            "mode": data.mode,
            "pageNumber": data.pageNumber,
            "pageSize": data.pageSize,
        }

        # 添加关键词
        if data.keyword:
            payload["keyword"] = data.keyword

        # 添加筛选条件
        if data.categories:
            payload["categories"] = data.categories
        if data.standards:
            payload["standards"] = data.standards
        if data.videoCodecs:
            payload["videoCodecs"] = data.videoCodecs
        if data.audioCodecs:
            payload["audioCodecs"] = data.audioCodecs
        if data.sources:
            payload["sources"] = data.sources
        if data.countries:
            payload["countries"] = data.countries
        if data.discount:
            payload["discount"] = data.discount

        # 排序
        payload["sortField"] = data.sortField
        payload["sortDirection"] = data.sortDirection

        result_data = await mt_client.search_torrents(payload, label="雷达搜索")

        if result_data:
            raw_data = result_data.get("data", [])
            total = result_data.get("total", 0)

            # 处理每个种子数据
            torrents = []
            for item in raw_data:
                torrent_info = item if "id" in item else item.get("torrent", item)
                status_info = torrent_info.get("status") or {}

                torrent_id = str(torrent_info.get("id", ""))
                name = torrent_info.get("name", "未知")
                small_descr = torrent_info.get("smallDescr", "")
                size = _safe_int(torrent_info.get("size"))

                seeders = _safe_int(status_info.get("seeders"))
                leechers = _safe_int(status_info.get("leechers"))

                discount = status_info.get("discount", "")
                discount_end_time = status_info.get("discountEndTime")

                created_date = torrent_info.get("createdDate", "")

                # 提取质量元数据
                team_name = torrent_info.get("teamName", "")
                standard_id = _safe_int(torrent_info.get("standard"))
                video_codec_id = _safe_int(torrent_info.get("videoCodec"))
                audio_codec_id = _safe_int(torrent_info.get("audioCodec"))
                source_id = _safe_int(torrent_info.get("source"))
                times_completed = int(status_info.get("timesCompleted", 0))
                tags = torrent_info.get("tags", "")

                # 新字段
                labels_new = torrent_info.get("labelsNew", [])
                imdb = torrent_info.get("imdb", "")
                douban = torrent_info.get("douban", "")
                countries = torrent_info.get("countries", "")
                category_id = torrent_info.get("category", "")

                # 处理国家字段（ID转名称，并翻译为中文）
                country_name = ""
                if countries:
                    # countries 可能是: 单个ID字符串 "1", 逗号分隔 "1,2,3", 整数, 或数组
                    if isinstance(countries, str):
                        # 处理逗号分隔的字符串 "1,2,3"
                        country_ids = [cid.strip() for cid in countries.split(",") if cid.strip().isdigit()]
                        country_names = [
                            COUNTRY_NAME_ZH.get(state.COUNTRY_LABELS.get(int(cid), ""), state.COUNTRY_LABELS.get(int(cid), ""))
                            for cid in country_ids
                        ]
                        country_name = ", ".join(filter(None, country_names))
                    elif isinstance(countries, int):
                        english_name = state.COUNTRY_LABELS.get(countries, "")
                        country_name = COUNTRY_NAME_ZH.get(english_name, english_name)
                    elif isinstance(countries, list):
                        country_names = [
                            COUNTRY_NAME_ZH.get(state.COUNTRY_LABELS.get(int(cid), ""), state.COUNTRY_LABELS.get(int(cid), ""))
                            for cid in countries if str(cid).isdigit()
                        ]
                        country_name = ", ".join(filter(None, country_names))

                detail_url = f"{MT_SITE_URL}/detail/{torrent_id}"

                # 用户状态
                user_status = "none"
                if torrent_id in user_torrent_status["seeding"]:
                    user_status = "seeding"
                elif torrent_id in user_torrent_status["leeching"]:
                    user_status = "leeching"

                torrents.append({
                    "id": torrent_id,
                    "name": name,
                    "small_descr": small_descr,
                    "size": size,
                    "size_display": format_size(size),
                    "seeders": seeders,
                    "leechers": leechers,
                    "discount": discount,
                    "discount_label": get_discount_label(discount),
                    "discount_end_time": discount_end_time,
                    "created_date": created_date,
                    "detail_url": detail_url,
                    "user_status": user_status,
                    "category": category_id,
                    "quality_metadata": {
                        "standard": QUALITY_LABELS["standards"].get(standard_id, ""),
                        "video_codec": QUALITY_LABELS["videoCodecs"].get(video_codec_id, ""),
                        "audio_codec": QUALITY_LABELS["audioCodecs"].get(audio_codec_id, ""),
                        "source": QUALITY_LABELS["sources"].get(source_id, ""),
                        "team_name": team_name,
                        "times_completed": times_completed,
                        "tags": tags,
                        "labels_new": labels_new,
                        "imdb": imdb,
                        "douban": douban,
                        "country": country_name
                    }
                })

            return {
                "success": True,
                "data": torrents,
                "total": total,
                "pageNumber": data.pageNumber,
                "pageSize": data.pageSize
            }
        else:
            logger.error("搜索失败")
            return {"success": False, "message": "搜索失败", "data": [], "total": 0}

    except Exception as e:
        logger.error(f"搜索异常: {e}")
        return {"success": False, "message": str(e), "data": [], "total": 0}


async def radar_download_torrent(request: Request, data: DownloadRequest, check_rate_limit_func):
    """从搜索结果下载种子到 qBittorrent (标签: 个人下载)"""
    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit_func(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests")

    # 检查 qBittorrent 配置
    if not QBITTORRENT_URL or not QBITTORRENT_USER or not QBITTORRENT_PASSWORD:
        return {"success": False, "error": "qb_not_configured", "message": "qBittorrent 未配置"}

    # 1. 先登录 qBittorrent
    sid = await qb_login()
    if not sid:
        return {"success": False, "error": "qb_connection_failed", "message": "qBittorrent 连接失败"}

    # 2. 检查种子是否已存在 (避免重复消耗 M-Team API)
    existing_hash = await qb_find_torrent_by_mteam_id(data.id, sid)
    if existing_hash:
        logger.info(f"种子 {data.id} 已在 qBittorrent 中 (hash={existing_hash})，跳过下载")
        return {"success": True, "message": "种子已在下载队列中 (跳过重复下载)"}

    # 3. 服务器端下载 .torrent 文件（避免 qBittorrent 无法访问 M-Team 的问题）
    torrent_content = await download_torrent_file(data.id)
    if not torrent_content:
        return {"success": False, "error": "download_link_failed", "message": "获取种子文件失败"}

    # 4. 添加种子文件 (使用"雷达下载"标签)
    success = await qb_add_torrent_file(torrent_content, sid, tag=QB_TAG_RADAR)

    if success:
        return {"success": True, "message": "已添加到下载队列"}
    else:
        return {"success": False, "error": "add_torrent_failed", "message": "添加种子失败"}
