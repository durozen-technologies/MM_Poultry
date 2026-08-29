import asyncio
from sqlalchemy import text, select
from app.db.database import get_session_factory
from app.models.organization import Organization

async def main():
    session_factory = get_session_factory()
    async with session_factory() as session:
        result = await session.execute(select(Organization.schema_name))
        schemas = result.scalars().all()
        print(f"Schemas: {schemas}")
        for schema in schemas:
            print(f"Altering {schema}")
            try:
                await session.execute(text(f"SET search_path TO {schema}"))
                await session.execute(text("ALTER TABLE delivery_runs ALTER COLUMN farm_load_id DROP NOT NULL"))
            except Exception as e:
                print(f"Error in {schema}: {e}")
        await session.commit()

if __name__ == "__main__":
    asyncio.run(main())
