
import asyncio
from app.db.database import get_db_session
from app.db.tenant_schema import tenant_schema_scope
from sqlalchemy import text
async def run():
    async for db in get_db_session():
        with tenant_schema_scope('demo'):
            res = await db.execute(text('SELECT * FROM farm_loads LIMIT 1'))
            row = res.mappings().first()
            if row:
                print(dict(row))
            else:
                print('No farm loads found')
        break
asyncio.run(run())


import asyncio
from app.db.database import get_session_factory
from app.db.tenant_schema import tenant_schema_scope
from sqlalchemy import text
async def run():
    session_factory = get_session_factory()
    async with session_factory() as db:
        with tenant_schema_scope('demo'):
            res = await db.execute(text('SELECT * FROM farm_loads LIMIT 1'))
            row = res.mappings().first()
            if row:
                print(dict(row))
asyncio.run(run())

