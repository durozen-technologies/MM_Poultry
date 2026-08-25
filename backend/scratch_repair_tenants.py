import asyncio
import os
from app.db.database import get_engine
from app.db.tenant_schema import repair_tenant_schema_async, derive_schema_name
from sqlalchemy import text

async def main():
    engine = get_engine()
    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT slug FROM organizations"))
        tenant_schemas = [derive_schema_name(row[0]) for row in result.fetchall()]
    
    for schema in tenant_schemas:
        print(f"Repairing {schema}...")
        await repair_tenant_schema_async(schema)
        print(f"Done repairing {schema}.")

if __name__ == "__main__":
    asyncio.run(main())
