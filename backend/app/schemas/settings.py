from __future__ import annotations

from decimal import Decimal

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OrgSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    weight_loss_warn_pct: Decimal
    weight_loss_alert_pct: Decimal
    enforce_credit_limit: bool

    @classmethod
    def _validate_warn_alert(cls, warn, alert):
        if warn is not None and alert is not None and warn >= alert:
            raise ValueError("warn_pct must be less than alert_pct")
        return warn, alert


class OrgSettingsUpdate(BaseModel):
    weight_loss_warn_pct: Decimal | None = Field(default=None, ge=Decimal("0"), le=Decimal("100"))
    weight_loss_alert_pct: Decimal | None = Field(default=None, ge=Decimal("0"), le=Decimal("100"))
    enforce_credit_limit: bool | None = None
