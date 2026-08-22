import asyncio
import os
from collections.abc import AsyncGenerator, Generator
from uuid import UUID

import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Must set env vars BEFORE importing anything that instantiates settings
os.environ["POSTGRES_DB"] = "MM_Poultry_test"
os.environ["POSTGRES_USER"] = "postgres"
os.environ["POSTGRES_PASSWORD"] = "root"
os.environ["POSTGRES_SERVER"] = "localhost"
os.environ["POSTGRES_PORT"] = "5432"
# Disable auth verification in tests for speed, we mock it anyway
os.environ["SECRET_KEY"] = "testsecret"

from app.auth.dependencies import AuthContext, get_current_auth
from app.core.config import get_settings
from app.db.database import get_engine
from app.db.tenant_schema import create_platform_tables, provision_tenant_schema_async, reset_test_database_async
from app.main import app
from app.models.enums import UserRole
from app.models.user import User


@pytest.fixture(scope="session", autouse=True)
def setup_test_db() -> Generator[None, None, None]:
    """Setup the test database with platform and tenant schemas."""
    # Ensure we're at backend root
    original_dir = os.getcwd()
    if not os.path.exists("pyproject.toml"):
        os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    async def init_db():
        try:
            await reset_test_database_async()
        except Exception:
            pass
        await create_platform_tables()
        await provision_tenant_schema_async("tenant_test")
        
        # Insert mock organization
        from app.db.database import get_session_factory
        from app.models.organization import Organization
        async with get_session_factory()() as session:
            org = Organization(
                id=UUID("00000000-0000-0000-0000-000000000002"),
                name="Test Org",
                slug="test_org",
                schema_name="tenant_test",
                is_active=True,
            )
            session.add(org)
            await session.commit()
        
    # Create tables
    asyncio.run(init_db())
    
    yield
    
    async def teardown_db():
        await reset_test_database_async()
        
    asyncio.run(teardown_db())
    os.chdir(original_dir)


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as c:
        yield c


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    engine = get_engine()
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        yield session
        await session.rollback()


from app.db.tenant_schema import set_search_path

@pytest.fixture
def mock_admin_auth() -> Generator[None, None, None]:
    admin_user = User(
        id=UUID("00000000-0000-0000-0000-000000000001"),
        username="admin_test",
        password_hash="test",
        role=UserRole.ADMIN,
        is_active=True,
        organization_id=UUID("00000000-0000-0000-0000-000000000002"),
    )
    
    async def _mock_auth() -> AsyncGenerator[AuthContext, None]:
        from app.db.database import get_session_factory
        session = get_session_factory()()
        from app.models.organization import Organization
        admin_org = Organization(
            id=UUID("00000000-0000-0000-0000-000000000002"),
            name="Test Org",
            slug="test_org",
            schema_name="tenant_test",
            is_active=True,
        )
        try:
            await set_search_path(session, "tenant_test")
            yield AuthContext(
                user=admin_user,
                organization=admin_org,
                schema_name="tenant_test",
                db=session
            )
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

    app.dependency_overrides[get_current_auth] = _mock_auth
    yield
    app.dependency_overrides.pop(get_current_auth, None)

@pytest.fixture
def mock_super_admin_auth() -> Generator[None, None, None]:
    super_admin_user = User(
        id=UUID("00000000-0000-0000-0000-000000000301"),
        username="super_admin_test",
        password_hash="test",
        role=UserRole.SUPER_ADMIN,
        is_active=True,
    )
    
    async def _mock_auth() -> AsyncGenerator[AuthContext, None]:
        from app.db.database import get_session_factory
        session = get_session_factory()()
        try:
            await set_search_path(session, "public")
            yield AuthContext(
                user=super_admin_user,
                organization=None,
                schema_name="public",
                db=session
            )
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

    app.dependency_overrides[get_current_auth] = _mock_auth
    yield
    app.dependency_overrides.pop(get_current_auth, None)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
