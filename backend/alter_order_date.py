import asyncio
from sqlalchemy import text, select
from app.db.database import get_session_factory
from app.models.organization import Organization

async def main():
    session_factory = get_session_factory()
    async with session_factory() as session:
        result = await session.execute(select(Organization.schema_name))
        schemas = result.scalars().all()
        for schema in schemas:
            print(f"Altering schema {schema}")
            try:
                await session.execute(text(f"SET search_path TO {schema}"))
                await session.execute(text("ALTER TABLE retailer_daily_orders ADD COLUMN expected_delivery_date DATE;"))
            except Exception as e:
                print(f"Error in {schema}: {e}")
        await session.commit()

if __name__ == "__main__":
    asyncio.run(main())
