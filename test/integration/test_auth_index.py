import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.db.database import dispose_engine, get_session_factory
from app.db.tenant_schema import set_search_path
from app.models.organization import UserAuthIndex
from test.factories import create_org_with_admin


@pytest.mark.asyncio
async def test_auth_index_created_for_admin(client: AsyncClient) -> None:
    await create_org_with_admin(client, slug="authidx", admin_username="authadmin")
    await dispose_engine()
    session = get_session_factory()()
    try:
        await set_search_path(session, None)
        row = await session.scalar(
            select(UserAuthIndex).where(UserAuthIndex.username_lower == "authadmin")
        )
        assert row is not None
        assert row.schema_name == "tenant_authidx"
    finally:
        await session.close()
        await dispose_engine()
