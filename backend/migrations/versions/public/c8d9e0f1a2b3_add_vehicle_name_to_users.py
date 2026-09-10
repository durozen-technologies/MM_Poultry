"""add vehicle_name to users

Revision ID: c8d9e0f1a2b3
Revises: 27ac4bfd297d
Create Date: 2026-09-10 10:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision: str = 'c8d9e0f1a2b3'
down_revision: Union[str, Sequence[str], None] = '27ac4bfd297d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    columns = [c['name'] for c in inspector.get_columns('users')]
    if 'vehicle_name' not in columns:
        op.add_column('users', sa.Column('vehicle_name', sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'vehicle_name')
