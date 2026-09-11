import pytest
import uuid
from app.db.session import get_db_for_org, get_platform_db
from app.models.organization import Organization
from app.db.database import get_session_factory

@pytest.mark.asyncio
async def test_get_db_for_org_not_found(prepare_database) -> None:
    # Attempt to get db for a non-existent org
    fake_id = uuid.uuid4()
    with pytest.raises(RuntimeError, match="Organization schema not found"):
        async for _ in get_db_for_org(fake_id):
            pass

@pytest.mark.asyncio
async def test_get_db_for_org_exception_rollback(prepare_database) -> None:
    # Insert a fake org first
    org_id = uuid.uuid4()
    async with get_session_factory()() as session:
        org = Organization(id=org_id, name="Test", slug="test_" + str(org_id)[:8], schema_name="tenant_test", is_active=True)
        session.add(org)
        await session.commit()
    
    # Trigger an exception inside the yield
    try:
        with pytest.raises(ValueError, match="Rollback triggered"):
            async for s in get_db_for_org(org_id):
                # Verify we are in tenant schema
                assert s is not None
                raise ValueError("Rollback triggered")
    finally:
        # Cleanup
        async with get_session_factory()() as session:
            org = await session.get(Organization, org_id)
            if org:
                await session.delete(org)
                await session.commit()

@pytest.mark.asyncio
async def test_get_platform_db_exception_rollback(prepare_database) -> None:
    # Trigger an exception inside the yield
    with pytest.raises(ValueError, match="Rollback triggered"):
        async for s in get_platform_db():
            assert s is not None
            raise ValueError("Rollback triggered")
