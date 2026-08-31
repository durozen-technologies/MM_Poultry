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


def q_money(value: Decimal | None) -> Decimal:
    if value is None:
        return ZERO
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return value.quantize(MONEY_Q, rounding=ROUND_HALF_UP)


def q_kg(value: Decimal | None) -> Decimal:
    if value is None:
        return Decimal("0.000")
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return value.quantize(KG_Q, rounding=ROUND_HALF_UP)


async def _get_org_settings(db: AsyncSession) -> OrgSettings:
    try:
        settings = await db.scalar(select(OrgSettings).limit(1))
        if settings is None:
            settings = OrgSettings()
            db.add(settings)
            await db.flush()
        return settings
    except Exception as e:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to get org settings: {str(e)}")


async def get_org_settings_out(db: AsyncSession) -> OrgSettings:
    return await _get_org_settings(db)


async def update_org_settings(db: AsyncSession, payload) -> OrgSettings:
    from fastapi import HTTPException, status
    try:
        settings = await _get_org_settings(db)
        data = payload.model_dump(exclude_unset=True)
        # Validate warn < alert
        warn = data.get("weight_loss_warn_pct", settings.weight_loss_warn_pct)
        alert = data.get("weight_loss_alert_pct", settings.weight_loss_alert_pct)
        if warn is not None and alert is not None and warn >= alert:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="weight_loss_warn_pct must be less than weight_loss_alert_pct")
        for key, value in data.items():
            setattr(settings, key, value)
        await db.flush()
        return settings
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update org settings: {str(e)}")
