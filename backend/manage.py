#!/usr/bin/env python3
import argparse
import asyncio
import sys
from getpass import getpass

from app.core.security import get_password_hash
from app.db.database import get_session_factory
from app.db.tenant_schema import set_search_path
from app.models.enums import UserRole
from app.models.user import User


async def setup_db():
    from app.db.tenant_schema import create_platform_tables
    print("Setting up platform tables...")
    await create_platform_tables()
    print("Platform tables created successfully.")


async def create_superadmin(username: str, password: str | None = None):
    session = get_session_factory()()
    try:
        from app.services.auth import check_global_username_available
        await set_search_path(session, None)
        
        if not await check_global_username_available(session, username):
            print(f"Superadmin '{username}' already exists.")
            return

        if not password:
            password = getpass("Password: ")
            confirm_password = getpass("Password (again): ")
            if password != confirm_password:
                print("Error: Your passwords didn't match.")
                sys.exit(1)

        user = User(
            username=username,
            password_hash=get_password_hash(password),
            role=UserRole.SUPER_ADMIN,
            organization_id=None,
        )
        session.add(user)
        await session.commit()
        print(f"Superadmin '{username}' created successfully.")
    except Exception as e:
        await session.rollback()
        print(f"Error creating superadmin: {e}")
        sys.exit(1)
    finally:
        await session.close()


def main():
    parser = argparse.ArgumentParser(description="MM Poultry Backend Management CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Setup command
    setup_parser = subparsers.add_parser("setup", help="Create platform tables")

    # Create superadmin command
    sa_parser = subparsers.add_parser("createsuperadmin", help="Create a superadmin user")
    sa_parser.add_argument("--username", required=True, help="Username for the superadmin")
    sa_parser.add_argument("--password", help="Password (will prompt if not provided)")

    args = parser.parse_args()

    if args.command == "setup":
        asyncio.run(setup_db())
    elif args.command == "createsuperadmin":
        asyncio.run(create_superadmin(args.username, args.password))


if __name__ == "__main__":
    main()
