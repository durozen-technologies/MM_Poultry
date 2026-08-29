import asyncio
from sqlalchemy import text
from app.db.database import get_session_factory

async def main():
    session_factory = get_session_factory()
    async with session_factory() as session:
        result = await session.execute(text("""
            SELECT n.nspname, c.conname
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE c.conname = 'uq_retailer_daily_order';
        """))
        print("Constraints found in schemas:", [(r[0], r[1]) for r in result.all()])

        result = await session.execute(text("""
            SELECT schemaname, indexname
            FROM pg_indexes
            WHERE indexname = 'uq_retailer_daily_order';
        """))
        print("Indexes found in schemas:", [(r[0], r[1]) for r in result.all()])

asyncio.run(main())
