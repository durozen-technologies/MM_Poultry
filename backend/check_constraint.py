import asyncio
from sqlalchemy import text
from app.db.database import get_session_factory

async def main():
    session_factory = get_session_factory()
    async with session_factory() as session:
        result = await session.execute(text("""
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'tenant_anbu_chicken.retailer_daily_orders'::regclass;
        """))
        print("Constraints:", [r[0] for r in result.all()])

asyncio.run(main())
