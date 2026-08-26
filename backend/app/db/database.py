from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker | None = None


def get_engine() -> AsyncEngine:
    global _engine, _session_factory
    if _engine is None:
        settings = get_settings()

        # Use NullPool in tests to avoid cross-loop connection pooling issues
        poolclass = NullPool if settings.postgres_db.endswith("_test") else None

        _engine = create_async_engine(
            settings.async_database_url,
            pool_pre_ping=True,
            echo=False,
            poolclass=poolclass,
        )

        from sqlalchemy import event

        @event.listens_for(_engine.sync_engine, "connect")
        def _set_ist(dbapi_connection, _connection_record) -> None:  # type: ignore[no-untyped-def]
            cursor = dbapi_connection.cursor()
            cursor.execute("SET TIME ZONE 'Asia/Kolkata'")
            cursor.close()

        @event.listens_for(_engine.sync_engine, "checkout")
        def _reset_search_path(dbapi_connection, _connection_record, _connection_proxy) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("RESET search_path")
            cursor.close()

        _session_factory = async_sessionmaker(_engine, expire_on_commit=False)
    return _engine


def get_session_factory() -> async_sessionmaker:
    get_engine()
    assert _session_factory is not None
    return _session_factory


async def dispose_engine() -> None:
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _session_factory = None
