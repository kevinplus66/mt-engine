"""
Pilot API endpoints (领航)
"""
from fastapi import APIRouter, HTTPException, status

from app.models import AutomationConfig
from app.core.pilot import pilot_manager
from app.core.rules import RuleEngine
from app.services.qbittorrent import qb_login, qb_get_torrents
from app.config import logger
import app.state as state


# Router without authentication
router = APIRouter(
    prefix="/api/pilot"
)


@router.get("/config")
async def get_config():
    """
    Get current pilot configuration

    Returns:
        dict: Current configuration
    """
    return pilot_manager.config.model_dump()


@router.post("/config")
async def update_config(config: AutomationConfig):
    """
    Update pilot configuration

    Args:
        config: New configuration

    Returns:
        dict: Status message
    """
    pilot_manager.config = config
    pilot_manager.rule_engine = RuleEngine(config)
    pilot_manager.save_config()
    logger.info("Pilot config updated via API")
    return {"status": "ok", "message": "Configuration updated successfully"}


@router.get("/stats")
async def get_stats():
    """
    Get pilot statistics

    Returns:
        dict: Current stats (active tasks, pending downloads, disk usage, totals, run times)
    """
    sid = await qb_login()
    tasks = await qb_get_torrents(sid) if sid else []
    auto_tasks = [t for t in tasks if 'PILOT' in t.get('tags', '')]

    return {
        "active_tasks": len(auto_tasks),
        "pending_downloads": len(pilot_manager.pending_downloads),
        "download_enabled": pilot_manager.config.download.enabled,
        "cleanup_enabled": pilot_manager.config.cleanup.enabled,
        "interval_seconds": pilot_manager.config.download.interval_seconds,
        "total_downloads": pilot_manager.total_downloads,
        "total_cleanups": pilot_manager.total_cleanups,
        "disk_usage_percent": pilot_manager.get_disk_usage_percent(),
        "last_run": pilot_manager.last_run,
        "next_run": pilot_manager.next_run,
        "is_running": pilot_manager.config.download.enabled or pilot_manager.config.cleanup.enabled,
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
        if tid in pilot_manager.pending_downloads:
            continue

        should_dl, score, reason = pilot_manager.rule_engine.evaluate_download(t)
        if should_dl:
            download_candidates.append({
                "id": tid,
                "name": t.get('name', ''),
                "size_gb": round(t.get('size', 0) / (1000**3), 2),  # Decimal (1000) to match backend format_size
                "score": score,
                "reason": reason
            })

    # Sort by score
    download_candidates.sort(key=lambda x: x['score'], reverse=True)

    # Get cleanup candidates
    sid = await qb_login()
    tasks = await qb_get_torrents(sid) if sid else []
    auto_tasks = [t for t in tasks if 'PILOT' in t.get('tags', '')]
    cleanup_candidates = []

    for task in auto_tasks:
        meta = pilot_manager._get_torrent_meta(task)
        should_delete, reason = pilot_manager.rule_engine.evaluate_cleanup(task, meta)
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
        await pilot_manager.run_download_cycle(force=True)
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
        await pilot_manager.run_cleanup_cycle(force=True)
        return {"status": "completed", "message": "Cleanup cycle completed"}
    except Exception as e:
        logger.error(f"Manual cleanup cycle failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cleanup cycle failed: {str(e)}"
        )
