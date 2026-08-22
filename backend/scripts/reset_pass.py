import asyncio
from app.db.database import get_session_factory
from sqlalchemy import text
from app.core.security import get_password_hash

async def main():
    async with get_session_factory()() as db:
        new_hash = get_password_hash('password123')
        await db.execute(text(f"UPDATE public.users SET password_hash = '{new_hash}' WHERE username = '9080177'"))
        await db.commit()
        print('Password reset successful')

asyncio.run(main())
