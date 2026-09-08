"""Create platform tables and repair existing tenant schemas (IDEA expand)."""

from __future__ import annotations

import asyncio

from app.db.tenant_schema import (
    create_platform_tables,
    repair_all_tenant_schemas_async,
    repair_platform_schema_async,
)


async def main() -> None:
    await create_platform_tables()
    print("Platform tables ready.")
    await repair_platform_schema_async()
    print("Platform schema repaired.")

    await repair_all_tenant_schemas_async()
    print("Tenant schemas repaired.")


if __name__ == "__main__":
    asyncio.run(main())
