"""add overall_balance to delivery_bills

Revision ID: a1b2c3d40003
Revises: a1b2c3d40002
Create Date: 2026-09-09 21:05:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = 'a1b2c3d40003'
down_revision = 'a1b2c3d40002'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add overall_balance column to delivery_bills
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    columns = [c['name'] for c in inspector.get_columns('delivery_bills')]
    
    if 'overall_balance' not in columns:
        op.add_column('delivery_bills', sa.Column('overall_balance', sa.Numeric(precision=12, scale=2), server_default=sa.text('0.00'), nullable=False))

def downgrade() -> None:
    op.drop_column('delivery_bills', 'overall_balance')
