"""add vehicle_name to users

Revision ID: a1b2c3d40004
Revises: a1b2c3d40003
Create Date: 2026-09-10 10:35:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = 'a1b2c3d40005'
down_revision = 'a1b2c3d40004'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    columns = [c['name'] for c in inspector.get_columns('users')]
    if 'vehicle_name' not in columns:
        op.add_column('users', sa.Column('vehicle_name', sa.String(length=120), nullable=True))

def downgrade() -> None:
    op.drop_column('users', 'vehicle_name')
