"""
Automation API endpoints (AutoFarm)
"""
from fastapi import APIRouter, HTTPException, status

from app.models import AutomationConfig
from app.core.automation import auto_manager
from app.core.rules import RuleEngine
from app.services.qbittorrent import qb_login, qb_get_torrents
from app.config import logger
import app.state as state


# Router without authentication
router = APIRouter(
    prefix="/api/automation"
)


@router.get("/config")
async def get_config():
    """
    Get current automation configuration

    Returns:
        dict: Current configuration
    """
    return auto_manager.config.model_dump()


@router.post("/config")
async def update_config(config: AutomationConfig):
    """
    Update automation configuration

    Args:
        config: New configuration

    Returns:
        dict: Status message
    """
    auto_manager.config = config
    auto_manager.rule_engine = RuleEngine(config)
    auto_manager.save_config()
    logger.info("Automation config updated via API")
    return {"status": "ok", "message": "Configuration updated successfully"}


@router.get("/stats")
async def get_stats():
    """
    Get automation statistics

    Returns:
        dict: Current stats (active tasks, pending downloads, etc.)
    """
    sid = await qb_login()
    tasks = await qb_get_torrents(sid) if sid else []
    auto_tasks = [t for t in tasks if 'MT_AUTO' in t.get('tags', '')]

    return {
        "active_tasks": len(auto_tasks),
        "pending_downloads": len(auto_manager.pending_downloads),
        "download_enabled": auto_manager.config.download.enabled,
        "cleanup_enabled": auto_manager.config.cleanup.enabled,
        "interval_seconds": auto_manager.config.download.interval_seconds,
    }


@router.get("/dry-run")
async def dry_run():
    """
    Simulate run - returns what would be downloaded/cleaned

    Returns:
        dict: Download candidates and cleanup candidates
    """
    # Get download candidates
    torrents = state.cached_data.get('torrents', [])
    download_candidates = []

    for t in torrents:
        tid = t.get('id', '')
        if tid in auto_manager.pending_downloads:
            continue

        should_dl, score, reason = auto_manager.rule_engine.evaluate_download(t)
        if should_dl:
            download_candidates.append({
                "id": tid,
                "name": t.get('name', ''),
                "size_gb": round(t.get('size', 0) / (1024**3), 2),
                "score": score,
                "reason": reason
            })

    # Sort by score
    download_candidates.sort(key=lambda x: x['score'], reverse=True)

    # Get cleanup candidates
    sid = await qb_login()
    tasks = await qb_get_torrents(sid) if sid else []
    auto_tasks = [t for t in tasks if 'MT_AUTO' in t.get('tags', '')]
    cleanup_candidates = []

    for task in auto_tasks:
        meta = auto_manager._get_torrent_meta(task)
        should_delete, reason = auto_manager.rule_engine.evaluate_cleanup(task, meta)
        if should_delete:
            cleanup_candidates.append({
                "name": task.get('name', ''),
                "hash": task.get('hash', ''),
                "ratio": round(task.get('ratio', 0), 2),
                "reason": reason
            })

    return {
        "download_candidates": download_candidates[:20],  # Top 20
        "total_download_candidates": len(download_candidates),
        "cleanup_candidates": cleanup_candidates,
        "total_cleanup_candidates": len(cleanup_candidates),
    }


@router.post("/run-download")
async def trigger_download():
    """
    Manually trigger download cycle

    Returns:
        dict: Status message
    """
    logger.info("Manual download cycle triggered via API")
    try:
        await auto_manager.run_download_cycle()
        return {"status": "completed", "message": "Download cycle completed"}
    except Exception as e:
        logger.error(f"Manual download cycle failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Download cycle failed: {str(e)}"
        )


@router.post("/run-cleanup")
async def trigger_cleanup():
    """
    Manually trigger cleanup cycle

    Returns:
        dict: Status message
    """
    logger.info("Manual cleanup cycle triggered via API")
    try:
        await auto_manager.run_cleanup_cycle()
        return {"status": "completed", "message": "Cleanup cycle completed"}
    except Exception as e:
        logger.error(f"Manual cleanup cycle failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cleanup cycle failed: {str(e)}"
        )
