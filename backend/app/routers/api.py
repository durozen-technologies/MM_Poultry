from __future__ import annotations

from app.main import create_app
from app.routers import api_router, health_router

# Backward-compatible re-exports for `main.py` and tests.
router = api_router

__all__ = ["router", "health_router", "create_app"]
