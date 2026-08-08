from __future__ import annotations

from collections.abc import AsyncIterator
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session_factory
from app.db.tenant_context_var import reset_active_tenant_schema, set_active_tenant_schema
from app.db.tenant_schema import set_search_path
from app.models.organization import Organization


async def get_platform_db() -> AsyncIterator[AsyncSession]:
    token = set_active_tenant_schema(None)
    session = get_session_factory()()
    try:
        await set_search_path(session, None)
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
        reset_active_tenant_schema(token)


async def get_db_for_org(org_id: UUID) -> AsyncIterator[AsyncSession]:
    session = get_session_factory()()
    token = None
    try:
        await set_search_path(session, None)
        org = await session.scalar(select(Organization).where(Organization.id == org_id))
        if org is None or not org.schema_name:
            raise RuntimeError("Organization schema not found")
        token = set_active_tenant_schema(org.schema_name)
        await set_search_path(session, org.schema_name)
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
        if token is not None:
            reset_active_tenant_schema(token)
