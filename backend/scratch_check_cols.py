import asyncio, pprint
from app.db.database import get_engine
from sqlalchemy import text

async def main():
    engine = get_engine()
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_schema = 'tenant_anbu_chicken' AND table_name = 'retailer_daily_orders'"))
        pprint.pprint(res.all())

asyncio.run(main())
