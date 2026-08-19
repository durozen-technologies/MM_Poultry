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


@pytest_asyncio.fixture
async def prepare_database() -> AsyncIterator[None]:
    await dispose_engine()
    get_settings.cache_clear()
    await reset_test_database_async()
    await create_platform_tables()
    await repair_platform_schema_async()
    yield
    await dispose_engine()


@pytest_asyncio.fixture
async def client(prepare_database) -> AsyncIterator[AsyncClient]:
    from app.main import create_app

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api/v1") as ac:
        yield ac
