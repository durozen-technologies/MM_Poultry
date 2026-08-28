import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    engine = create_async_engine("postgresql+asyncpg://postgres:root@localhost:5432/MM_Poultry", echo=False)
    async with engine.begin() as conn:
        print("Altering tenant_demo delivery_runs")
        await conn.execute(text("ALTER TABLE tenant_demo.delivery_runs ALTER COLUMN farm_load_id DROP NOT NULL;"))
        print("Success")

if __name__ == "__main__":
    asyncio.run(main())
