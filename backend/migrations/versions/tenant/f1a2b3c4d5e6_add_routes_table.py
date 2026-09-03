"""add routes table and retailer route_id

Revision ID: f1a2b3c4d5e6
Revises: d85bf12c9678
Create Date: 2026-09-03 14:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "d85bf12c9678"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "routes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("area", sa.String(length=120), nullable=True),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_routes_created_at"), "routes", ["created_at"], unique=False)
    op.create_index(
        "uq_routes_name_lower",
        "routes",
        [sa.text("lower(name)")],
        unique=True,
    )

    op.add_column("retailers", sa.Column("route_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_retailers_route_id",
        "retailers",
        "routes",
        ["route_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_retailers_route_id"), "retailers", ["route_id"], unique=False)

    # Backfill routes from legacy route_name and link retailers
    op.execute(
        """
        INSERT INTO routes (id, name, is_active, created_at, updated_at)
        SELECT gen_random_uuid(), n.name, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM (
            SELECT DISTINCT trim(route_name) AS name
            FROM retailers
            WHERE route_name IS NOT NULL AND trim(route_name) <> ''
        ) n
        WHERE NOT EXISTS (
            SELECT 1 FROM routes r WHERE lower(r.name) = lower(n.name)
        )
        """
    )
    op.execute(
        """
        UPDATE retailers r
        SET route_id = rt.id
        FROM routes rt
        WHERE r.route_name IS NOT NULL
          AND trim(r.route_name) <> ''
          AND lower(trim(r.route_name)) = lower(rt.name)
        """
    )
    op.execute(
        """
        UPDATE retailers r
        SET route_name = rt.name
        FROM routes rt
        WHERE r.route_id = rt.id
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_retailers_route_id"), table_name="retailers")
    op.drop_constraint("fk_retailers_route_id", "retailers", type_="foreignkey")
    op.drop_column("retailers", "route_id")
    op.drop_index("uq_routes_name_lower", table_name="routes")
    op.drop_index(op.f("ix_routes_created_at"), table_name="routes")
    op.drop_table("routes")
