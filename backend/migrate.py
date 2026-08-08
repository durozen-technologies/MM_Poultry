"""Create platform tables and repair existing tenant schemas (IDEA expand)."""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.db.database import get_session_factory
from app.db.tenant_schema import (
    create_platform_tables,
    repair_tenant_schema_async,
    set_search_path,
)
from app.models.organization import Organization


async def main() -> None:
    await create_platform_tables()
    print("Platform tables ready.")

    session = get_session_factory()()
    try:
        await set_search_path(session, None)
        orgs = list(await session.scalars(select(Organization)))
        for org in orgs:
            await repair_tenant_schema_async(org.schema_name)
            print(f"Repaired tenant schema {org.schema_name}")
    finally:
        await session.close()


if __name__ == "__main__":
    asyncio.run(main())
