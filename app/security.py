"""Shared API authentication dependencies."""

import hmac
import os
from typing import Optional

from fastapi import Header, HTTPException, Security, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer

import app.config as config

_API_KEY_ENV = "MT_ENGINE_API_KEY"
_BEARER_PREFIX = "Bearer "
_BEARER_AUTH = HTTPBearer(
    auto_error=False,
    scheme_name="BearerAuth",
    description="MT Engine API key sent as an Authorization bearer token.",
)
_API_KEY_HEADER_AUTH = APIKeyHeader(
    name="X-MT-ENGINE-Key",
    auto_error=False,
    scheme_name="ApiKeyAuth",
    description="MT Engine API key sent in the X-MT-ENGINE-Key header.",
)


async def require_api_key(
    authorization: Optional[str] = Header(default=None, include_in_schema=False),
    x_mt_engine_key: Optional[str] = Header(
        default=None,
        alias="X-MT-ENGINE-Key",
        include_in_schema=False,
    ),
    _bearer_auth: Optional[HTTPAuthorizationCredentials] = Security(_BEARER_AUTH),
    _api_key_auth: Optional[str] = Security(_API_KEY_HEADER_AUTH),
) -> None:
    """Require the configured API key for mutating API endpoints."""
    if config.DEBUG:
        return

    expected_key = os.getenv(_API_KEY_ENV)
    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API key is not configured",
        )

    if authorization and authorization.startswith(_BEARER_PREFIX):
        if hmac.compare_digest(authorization[len(_BEARER_PREFIX):], expected_key):
            return
    if x_mt_engine_key and hmac.compare_digest(x_mt_engine_key, expected_key):
        return

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing API key",
    )
