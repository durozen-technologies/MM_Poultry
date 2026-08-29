import asyncio
from sqlalchemy import select, text
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
                await session.execute(text("ALTER TABLE delivery_runs ADD COLUMN IF NOT EXISTS driver_user_id UUID"))
                await session.execute(text("ALTER TABLE delivery_runs ADD COLUMN IF NOT EXISTS driver_name VARCHAR(120)"))
                await session.execute(text("ALTER TABLE delivery_runs ADD COLUMN IF NOT EXISTS vehicle_id UUID"))
                await session.execute(text("ALTER TABLE delivery_runs ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(40)"))
                try:
                    await session.execute(text("ALTER TABLE delivery_runs ADD CONSTRAINT fk_delivery_runs_vehicle_id FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)"))
                except Exception as ex:
                    print(f"Constraint might already exist in {schema}: {ex}")
            except Exception as e:
                print(f"Error in {schema}: {e}")
        await session.commit()

if __name__ == "__main__":
    asyncio.run(main())
