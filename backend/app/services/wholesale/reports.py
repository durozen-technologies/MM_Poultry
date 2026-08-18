from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.timezone import now_ist
from app.models.domain import (
    DeliveryBill,
    DeliveryRun,
    DeliveryStop,
    FarmLoad,
    Payment,
    RetailerDailyOrder,
    TripWeightLoss,
)
from app.models.enums import (
    DeliveryRunStatus,
    DeliveryStopStatus,
    FarmLoadStatus,
    OrderStatus,
    PaymentType,
)
from app.schemas import (
    DeliveryRunOut,
    ReportSummary,
    TripWeightLossOut,
)
from app.services.wholesale.common import q_kg, q_money
from app.services.wholesale.delivery_runs import get_delivery_run


async def compute_trip_weight_loss(db: AsyncSession, run_id: UUID) -> TripWeightLossOut:
    run = await db.scalar(select(DeliveryRun).where(DeliveryRun.id == run_id))
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery run not found")
    load = await db.scalar(select(FarmLoad).where(FarmLoad.id == run.farm_load_id))
    if load is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm load not found")

    delivered = await db.scalar(
        select(func.coalesce(func.sum(DeliveryStop.delivered_weight_kg), 0)).where(
            DeliveryStop.delivery_run_id == run_id,
            DeliveryStop.status.in_(
                [DeliveryStopStatus.WEIGHED, DeliveryStopStatus.BILLED]
            ),
        )
    )
    delivered_kg = q_kg(Decimal(str(delivered or 0)))
    loaded_kg = q_kg(load.loaded_weight_kg)
    loss_kg = q_kg(loaded_kg - delivered_kg)
    loss_pct = (
        q_money((loss_kg / loaded_kg) * Decimal("100")) if loaded_kg > 0 else Decimal("0.00")
    )

    existing = await db.scalar(
        select(TripWeightLoss).where(TripWeightLoss.delivery_run_id == run_id)
    )
    if existing:
        existing.loaded_kg = loaded_kg
        existing.delivered_kg = delivered_kg
        existing.loss_kg = loss_kg
        existing.loss_pct = loss_pct
        existing.computed_at = now_ist()
        row = existing
    else:
        row = TripWeightLoss(
            farm_load_id=load.id,
            delivery_run_id=run.id,
            loaded_kg=loaded_kg,
            delivered_kg=delivered_kg,
            loss_kg=loss_kg,
            loss_pct=loss_pct,
        )
        db.add(row)
    await db.flush()
    return TripWeightLossOut.model_validate(row, from_attributes=True)


async def complete_delivery_run(db: AsyncSession, run_id: UUID) -> DeliveryRunOut:
    run = await db.scalar(select(DeliveryRun).where(DeliveryRun.id == run_id))
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery run not found")
    run.status = DeliveryRunStatus.COMPLETED
    run.completed_at = now_ist()
    load = await db.scalar(select(FarmLoad).where(FarmLoad.id == run.farm_load_id))
    if load:
        load.status = FarmLoadStatus.CLOSED
    await compute_trip_weight_loss(db, run_id)
    await db.flush()
    return await get_delivery_run(db, run_id)


async def report_summary(db: AsyncSession, start: date, end: date) -> ReportSummary:
    ordered = await db.scalar(
        select(func.coalesce(func.sum(RetailerDailyOrder.requested_kg), 0)).where(
            RetailerDailyOrder.order_date >= start,
            RetailerDailyOrder.order_date <= end,
            RetailerDailyOrder.status != OrderStatus.CANCELLED,
        )
    )
    delivered = await db.scalar(
        select(func.coalesce(func.sum(DeliveryBill.weight_kg), 0)).where(
            DeliveryBill.bill_date >= start,
            DeliveryBill.bill_date <= end,
        )
    )
    sales = await db.scalar(
        select(func.coalesce(func.sum(DeliveryBill.total_amount), 0)).where(
            DeliveryBill.bill_date >= start,
            DeliveryBill.bill_date <= end,
        )
    )
    collections = await db.scalar(
        select(func.coalesce(func.sum(Payment.total_amount), 0)).where(
            Payment.payment_date >= start,
            Payment.payment_date <= end,
            Payment.type == PaymentType.RECEIVED,
        )
    )
    loss_rows = list(await db.scalars(select(TripWeightLoss)))
    run_ids = {row.delivery_run_id for row in loss_rows}
    runs = {}
    if run_ids:
        for r in await db.scalars(select(DeliveryRun).where(DeliveryRun.id.in_(run_ids))):
            runs[r.id] = r
    total_loss = Decimal("0.000")
    for row in loss_rows:
        run = runs.get(row.delivery_run_id)
        if run and start <= run.run_date <= end:
            total_loss += row.loss_kg

    return ReportSummary(
        period_start=start,
        period_end=end,
        total_ordered_kg=q_kg(Decimal(str(ordered or 0))),
        total_delivered_kg=q_kg(Decimal(str(delivered or 0))),
        total_sales_amount=q_money(Decimal(str(sales or 0))),
        total_collections=q_money(Decimal(str(collections or 0))),
        total_loss_kg=q_kg(total_loss),
    )


def build_report_pdf(summary: ReportSummary) -> bytes:
    from io import BytesIO

    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, 800, "Broiler Wholesale Report")
    c.setFont("Helvetica", 11)
    y = 770
    lines = [
        f"Period: {summary.period_start} to {summary.period_end}",
        f"Ordered kg: {summary.total_ordered_kg}",
        f"Delivered kg: {summary.total_delivered_kg}",
        f"Sales amount: {summary.total_sales_amount}",
        f"Collections: {summary.total_collections}",
        f"Weight loss kg: {summary.total_loss_kg}",
    ]
    for line in lines:
        c.drawString(50, y, line)
        y -= 22
    c.showPage()
    c.save()
    return buffer.getvalue()
