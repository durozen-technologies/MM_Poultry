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




class OrgSettingsUpdate(BaseModel):
    weight_loss_warn_pct: Decimal | None = Field(default=None, ge=Decimal("0"), le=Decimal("100"))
    weight_loss_alert_pct: Decimal | None = Field(default=None, ge=Decimal("0"), le=Decimal("100"))
    enforce_credit_limit: bool | None = None
