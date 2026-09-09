from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.dates import IstDate, IstDateTime


class OpsDashboard(BaseModel):
    order_count: int
    ordered_kg: Decimal
    ordered_boxes: int = 0
    loaded_kg: Decimal
    delivered_kg: Decimal
    pending_kg: Decimal
    total_sales: Decimal
    total_collection: Decimal
    outstanding: Decimal
    loss_kg: Decimal
    loss_pct: Decimal
    loss_status: str
    retailer_count: int
    completed_deliveries: int
    pending_deliveries: int
    skipped_deliveries: int
    weight_loss_warn_pct: Decimal
    weight_loss_alert_pct: Decimal


class TripWeightLossOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    farm_load_id: UUID
    delivery_run_id: UUID
    loaded_kg: Decimal
    delivered_kg: Decimal
    loss_kg: Decimal
    loss_pct: Decimal
    computed_at: IstDateTime


class ReportSummary(BaseModel):
    period_start: IstDate
    period_end: IstDate
    total_ordered_kg: Decimal
    total_delivered_kg: Decimal
    total_sales_amount: Decimal
    total_collections: Decimal
    total_loss_kg: Decimal
