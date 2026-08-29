import asyncio
from sqlalchemy import text
from app.db.database import get_session_factory

async def main():
    session_factory = get_session_factory()
    async with session_factory() as session:
        result = await session.execute(text("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'retailer_daily_orders' 
            AND schemaname = 'tenant_anbu_chicken';
        """))
        print("Indexes:", [r[0] for r in result.all()])

asyncio.run(main())
