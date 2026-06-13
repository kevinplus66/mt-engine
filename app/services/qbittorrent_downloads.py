"""
M-Team torrent download helpers used before adding torrents to qBittorrent.
"""

from typing import Optional

from app.config import MT_SITE_URL, USER_AGENT, logger
from app.services.http_client import get_http_client
from app.services.mteam_api import mt_client


async def get_torrent_download_url(torrent_id: str) -> Optional[str]:
    """
    Get a torrent download URL from the M-Team API.
    """
    from app.config import MT_TOKEN

    if not MT_TOKEN:
        logger.error(f"[下载] MT_TOKEN 未配置，无法获取种子 {torrent_id} 的下载链接")
        return None

    try:
        logger.info(f"[下载] 请求种子下载链接: ID={torrent_id}")

        token = await mt_client.get_torrent_download_token(torrent_id)
        if not token:
            logger.error(f"[下载] 未能获取下载令牌: ID={torrent_id}")
            return None

        if token.startswith("http"):
            logger.info(f"[下载] 检测到 V2 下载链接: ID={torrent_id}")
            download_url = token
        else:
            download_url = f"{MT_SITE_URL}/api/rss/dl?id={torrent_id}&token={token}"

        logger.info(f"[下载] 成功获取下载链接: {torrent_id}")
        return download_url
    except Exception as e:
        logger.error(
            f"[下载] 获取下载链接异常 - ID={torrent_id}, "
            f"error={type(e).__name__}"
        )
        return None


async def download_torrent_file(torrent_id: str) -> Optional[bytes]:
    """
    Download .torrent file content server-side.
    """
    download_url = await get_torrent_download_url(torrent_id)
    if not download_url:
        return None

    try:
        client = await get_http_client()
        logger.info(f"[下载] 服务器端下载 .torrent 文件: ID={torrent_id}")

        response = await client.get(
            download_url,
            headers={"User-Agent": USER_AGENT},
            follow_redirects=True,
            timeout=30.0,
        )

        if response.status_code == 200:
            content = response.content
            if content and len(content) > 0 and content[0:1] == b"d":
                logger.info(
                    f"[下载] 成功下载 .torrent 文件: "
                    f"ID={torrent_id}, 大小={len(content)} bytes"
                )
                return content

            logger.error(f"[下载] 下载内容不是有效的 .torrent 文件: ID={torrent_id}")
            logger.debug(
                f"[下载] 响应内容前100字节: {content[:100] if content else 'empty'}"
            )
            return None

        logger.error(
            f"[下载] 下载 .torrent 文件失败: "
            f"ID={torrent_id}, status={response.status_code}"
        )
        return None
    except Exception as e:
        logger.error(
            f"[下载] 下载 .torrent 文件异常: ID={torrent_id}, "
            f"error={type(e).__name__}"
        )
        return None
