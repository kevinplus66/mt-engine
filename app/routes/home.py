"""Read-only Home media wall API."""

from fastapi import APIRouter

from app.models import MediaWallResponse
from app.services.media_wall import media_wall_service

router = APIRouter()


@router.get("/api/home/media-wall", response_model=MediaWallResponse)
async def get_home_media_wall():
    """Return the cached Home media wall snapshot without refreshing M-Team."""
    return media_wall_service.get_snapshot()
