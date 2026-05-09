from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status

from .backend_config import BackendSettings, get_backend_settings


def require_backend_token(
    authorization: str | None = Header(default=None),
    settings: BackendSettings = Depends(get_backend_settings),
) -> None:
    token = settings.backend_token
    if not token:
        return

    expected = f"Bearer {token}"
    if authorization != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid backend token",
        )
