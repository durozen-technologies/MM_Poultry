import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.db.tenant_schema import set_search_path
import json
from uuid import UUID
from decimal import Decimal
from datetime import date as DateType

class CustomEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, UUID): return str(obj)
        if isinstance(obj, Decimal): return float(obj)
        if isinstance(obj, DateType): return str(obj)
        return super().default(obj)

async def main():
    e = create_async_engine('postgresql+asyncpg://postgres:root@localhost:5432/mmbroilers')
    s = async_sessionmaker(e)()
    await set_search_path(s, 'tenant_demo')
    print("Delivery runs feature has been removed.")
    await s.close()

asyncio.run(main())
