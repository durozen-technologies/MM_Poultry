"""drop bird_size from retailer_daily_order_items

Revision ID: a1b2c3d40005
Revises: a1b2c3d40004
Create Date: 2026-09-10 11:38:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = 'a1b2c3d40006'
down_revision = 'a1b2c3d40005'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    columns = [c['name'] for c in inspector.get_columns('retailer_daily_order_items')]
    if 'bird_size' in columns:
        op.drop_column('retailer_daily_order_items', 'bird_size')

def downgrade() -> None:
    op.add_column('retailer_daily_order_items', sa.Column('bird_size', sa.String(length=50), nullable=True))
