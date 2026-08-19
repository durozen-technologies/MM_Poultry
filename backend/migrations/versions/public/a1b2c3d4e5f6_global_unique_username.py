"""Add global unique username_lower and user profile columns."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "d6944ad5e8b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT username_lower FROM user_auth_index
            GROUP BY username_lower HAVING COUNT(*) > 1
          ) THEN
            RAISE EXCEPTION 'Duplicate username_lower values exist; resolve before unique constraint';
          END IF;
        END $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'uq_auth_index_user_org'
          ) THEN
            ALTER TABLE user_auth_index DROP CONSTRAINT uq_auth_index_user_org;
          END IF;
        END $$;
        """
    )
    op.execute("DROP INDEX IF EXISTS ix_user_auth_index_username_lower")
    op.create_index(
        "ix_user_auth_index_username_lower",
        "user_auth_index",
        ["username_lower"],
        unique=True,
    )
    op.add_column("users", sa.Column("full_name", sa.String(length=120), nullable=True))
    op.add_column("users", sa.Column("mobile_number", sa.String(length=30), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "mobile_number")
    op.drop_column("users", "full_name")
    op.drop_index("ix_user_auth_index_username_lower", table_name="user_auth_index")
    op.create_index(
        "ix_user_auth_index_username_lower",
        "user_auth_index",
        ["username_lower"],
        unique=False,
    )
    op.create_unique_constraint(
        "uq_auth_index_user_org", "user_auth_index", ["username_lower", "organization_id"]
    )
