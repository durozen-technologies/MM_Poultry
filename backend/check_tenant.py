import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:postgres@localhost:5432/MM_Poultry')
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'tenant_anbu_chicken';"))
        tables = [row[0] for row in result.fetchall()]
        print(tables)

asyncio.run(main())
