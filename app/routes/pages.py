"""
HTML 页面路由
"""

from fastapi import Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.config import MT_SITE_URL, REFRESH_INTERVAL
from app.state import user_profile, rival_profile
from app.constants import FILTER_OPTIONS
import app.state as state


templates = Jinja2Templates(directory="app/templates")


def get_radar_page(request: Request) -> HTMLResponse:
    """雷达页面"""
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "active_page": "radar",
            "site_url": MT_SITE_URL,
            "user_profile": user_profile,
            "rival_profile": rival_profile,
            "filter_options": FILTER_OPTIONS
        }
    )


def get_sonar_page(request: Request) -> HTMLResponse:
    """声呐页面"""
    return templates.TemplateResponse(
        "sonar.html",
        {
            "request": request,
            "active_page": "sonar",
            "data": state.cached_data,
            "refresh_interval": REFRESH_INTERVAL,
            "site_url": MT_SITE_URL,
            "user_profile": user_profile,
            "rival_profile": rival_profile
        }
    )
