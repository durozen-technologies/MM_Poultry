from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.timezone import today_ist
from app.models.domain import (
    RetailerItemRate,
)
from app.schemas import (
    RateOut,
    RateUpsert,
)
from app.services.wholesale.common import q_money


async def resolve_rate(
    db: AsyncSession, retailer_id: UUID, on_date: date | None = None
) -> Decimal:
    day = on_date or today_ist()
    retailer_rate = await db.scalar(
        select(RetailerItemRate)
        .where(
            RetailerItemRate.retailer_id == retailer_id,
            RetailerItemRate.effective_from <= day,
            (RetailerItemRate.effective_to.is_(None)) | (RetailerItemRate.effective_to >= day),
        )
        .order_by(RetailerItemRate.effective_from.desc())
        .limit(1)
    )
    if retailer_rate:
        return retailer_rate.rate_per_kg
    default_rate = await db.scalar(
        select(RetailerItemRate)
        .where(
            RetailerItemRate.retailer_id.is_(None),
            RetailerItemRate.effective_from <= day,
            (RetailerItemRate.effective_to.is_(None)) | (RetailerItemRate.effective_to >= day),
        )
        .order_by(RetailerItemRate.effective_from.desc())
        .limit(1)
    )
    if default_rate:
        return default_rate.rate_per_kg
    return Decimal("0.00")


async def upsert_rate(db: AsyncSession, payload: RateUpsert) -> RateOut:
    day = payload.effective_from or today_ist()
    row = RetailerItemRate(
        retailer_id=payload.retailer_id,
        rate_per_kg=q_money(payload.rate_per_kg),
        effective_from=day,
        effective_to=payload.effective_to,
    )
    db.add(row)
    await db.flush()
    return RateOut.model_validate(row, from_attributes=True)


async def list_rates(db: AsyncSession) -> list[RateOut]:
    rows = list(
        await db.scalars(select(RetailerItemRate).order_by(RetailerItemRate.effective_from.desc()))
    )
    return [RateOut.model_validate(r, from_attributes=True) for r in rows]


