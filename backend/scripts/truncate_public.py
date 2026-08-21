import asyncio
from sqlalchemy import text
from app.db.database import get_session_factory

async def main():
    async with get_session_factory()() as session:
        await session.execute(text('SET search_path TO public'))
        tables_res = await session.execute(text(
            """
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename != 'alembic_version'
            """
        ))
        tables = [row[0] for row in tables_res]
        if tables:
            stmt = 'TRUNCATE TABLE ' + ', '.join(f'"{t}"' for t in tables) + ' RESTART IDENTITY CASCADE'
            await session.execute(text(stmt))
        await session.commit()
        print('Truncated:', tables)

if __name__ == "__main__":
    asyncio.run(main())
