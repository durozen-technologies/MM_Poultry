import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:postgres@localhost:5432/MM_Poultry')
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT table_name, table_schema FROM information_schema.tables WHERE table_name = 'delivery_stop_items';"))
        print(result.fetchall())
        
        result2 = await conn.execute(text("SELECT table_name, table_schema FROM information_schema.tables WHERE table_name = 'alembic_version';"))
        print("Alembic version tables:", result2.fetchall())
        
        result3 = await conn.execute(text("SELECT * FROM public.alembic_version;"))
        print("public alembic version:", result3.fetchall())
        
        result4 = await conn.execute(text("SELECT * FROM tenant_anbu_chicken.alembic_version;"))
        print("tenant alembic version:", result4.fetchall())

asyncio.run(main())
