"""add vehicle name

Revision ID: b3c4d5e6f7g8
Revises: a2b3c4d5e6f7
Create Date: 2026-09-04 22:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b3c4d5e6f7g8"
down_revision: Union[str, Sequence[str], None] = "a2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    import os

    if os.environ.get("ALEMBIC_MODE") == "public":
        return
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS name VARCHAR(120)"))


def downgrade() -> None:
    import os

    if os.environ.get("ALEMBIC_MODE") == "public":
        return
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE vehicles DROP COLUMN IF EXISTS name"))
