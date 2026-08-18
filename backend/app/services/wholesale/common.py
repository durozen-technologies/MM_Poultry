from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import (
    OrgSettings,
)

ZERO = Decimal("0.00")
KG_Q = Decimal("0.001")
MONEY_Q = Decimal("0.01")


def q_money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_Q, rounding=ROUND_HALF_UP)


def q_kg(value: Decimal) -> Decimal:
    return value.quantize(KG_Q, rounding=ROUND_HALF_UP)



async def _get_org_settings(db: AsyncSession) -> OrgSettings:
    settings = await db.scalar(select(OrgSettings).limit(1))
    if settings is None:
        settings = OrgSettings()
        db.add(settings)
        await db.flush()
    return settings


