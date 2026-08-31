from __future__ import annotations

import os
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.db.database import dispose_engine
from app.db.tenant_schema import (
    create_platform_tables,
    repair_platform_schema_async,
    reset_test_database_async,
)

TEST_DB = os.environ.get("POSTGRES_DB", "mmbroilers_test")


@pytest.fixture(scope="session", autouse=True)
def _configure_test_db() -> None:
    os.environ.setdefault("POSTGRES_DB", TEST_DB)
    os.environ.setdefault("SECRET_KEY", "test-secret-key-with-32-chars-minimum")
    get_settings.cache_clear()


import asyncio as _asyncio

_db_setup_lock = _asyncio.Lock()
_db_prepared = False


@pytest_asyncio.fixture(scope="session")
async def prepare_database() -> AsyncIterator[None]:
    global _db_prepared
    async with _db_setup_lock:
        if not _db_prepared:
            await dispose_engine()
            get_settings.cache_clear()
            # Retry reset with advisory lock to avoid deadlock with parallel suites
            for attempt in range(3):
                try:
                    await reset_test_database_async()
                    break
                except Exception as e:
                    if "deadlock" in str(e).lower() and attempt < 2:
                        await _asyncio.sleep(0.5 * (attempt + 1))
                        continue
                    raise
            await create_platform_tables()
            await repair_platform_schema_async()
            _db_prepared = True
    yield
    # Teardown only once at session end
    # (dispose handled by last client fixture)


@pytest_asyncio.fixture
async def client(prepare_database) -> AsyncIterator[AsyncClient]:
    from app.main import create_app

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api/v1") as ac:
        yield ac
