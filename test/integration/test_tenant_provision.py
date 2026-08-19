import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.db.database import dispose_engine, get_session_factory
from app.db.tenant_schema import derive_schema_name, set_search_path
from app.models.organization import Organization
from test.factories import create_org_with_admin


@pytest.mark.asyncio
async def test_tenant_schema_provisioned(client: AsyncClient) -> None:
    await create_org_with_admin(client, slug="tenantprov")
    await dispose_engine()
    session = get_session_factory()()
    try:
        await set_search_path(session, None)
        org = await session.scalar(select(Organization).where(Organization.slug == "tenantprov"))
        assert org is not None
        assert org.schema_name == derive_schema_name("tenantprov")
    finally:
        await session.close()
        await dispose_engine()
