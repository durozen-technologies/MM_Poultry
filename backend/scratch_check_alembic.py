import asyncio
from app.db.database import get_engine
from sqlalchemy import text

async def main():
    engine = get_engine()
    async with engine.begin() as conn:
        print(await conn.scalar(text("SELECT version_num FROM tenant_anbu_chicken.alembic_version")))

asyncio.run(main())
