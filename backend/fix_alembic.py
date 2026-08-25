import asyncio
from app.db.database import get_engine
from sqlalchemy import text

async def main():
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.execute(text("UPDATE tenant_anbu_chicken.alembic_version SET version_num='f08f9cc44324'"))
        print("Updated tenant_anbu_chicken")

if __name__ == "__main__":
    asyncio.run(main())
