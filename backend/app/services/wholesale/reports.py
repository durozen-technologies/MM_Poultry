from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.timezone import now_ist
from app.models.domain import (
    DeliveryBill,
    DeliveryRun,
    DeliveryRunFarmLoad,
    DeliveryStop,
    DeliveryStopItem,
    FarmLoad,
    Payment,
    RetailerDailyOrder,
    RetailerDailyOrderItem,
    StockQuantityEvent,
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
    DeliveryRunReconcile,
    ReportSummary,
    StockAdjustmentCreate,
    TripWeightLossOut,
)
from app.services.wholesale.common import q_kg, q_money
from app.services.wholesale.delivery_runs import get_delivery_run
from app.services.wholesale.stock_audit import log_quantity_change

_RECONCILE_TOLERANCE = Decimal("0.05")
_ACTIVE_RUN = (DeliveryRunStatus.PLANNED, DeliveryRunStatus.IN_PROGRESS)
_TERMINAL_STOP = (
    DeliveryStopStatus.BILLED,
    DeliveryStopStatus.SKIPPED,
    DeliveryStopStatus.FAILED,
)
_ZERO = Decimal("0")


async def _run_delivered_kg(db: AsyncSession, run_id: UUID) -> Decimal:
    val = await db.scalar(
        select(func.coalesce(func.sum(DeliveryStopItem.delivered_weight_kg), 0))
        .join(DeliveryStop, DeliveryStop.id == DeliveryStopItem.delivery_stop_id)
        .where(
            DeliveryStop.delivery_run_id == run_id,
            DeliveryStop.status == DeliveryStopStatus.BILLED,
        )
    )
    return q_kg(Decimal(str(val or 0)))


async def _run_adjustment_sum(db: AsyncSession, run_id: UUID) -> Decimal:
    val = await db.scalar(
        select(func.coalesce(func.sum(StockQuantityEvent.new_value), 0))
        .where(
            StockQuantityEvent.ref_type == "delivery_run",
            StockQuantityEvent.ref_id == run_id,
            StockQuantityEvent.field == "adjustment_kg",
        )
    )
    return q_kg(Decimal(str(val or 0)))


async def reconcile_delivery_run(
    db: AsyncSession,
    run_id: UUID,
    payload: DeliveryRunReconcile,
    *,
    actor_user_id: UUID | None = None,
) -> DeliveryRunOut:
    run = await db.scalar(
        select(DeliveryRun)
        .options(selectinload(DeliveryRun.farm_load_links))
        .where(DeliveryRun.id == run_id)
        .with_for_update()
    )
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery run not found")
    if run.status not in (DeliveryRunStatus.IN_PROGRESS, DeliveryRunStatus.PLANNED):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Run must be active to reconcile",
        )

    actual = payload.actual_loaded_kg
    if actual is None:
        if run.farm_load_links:
            actual = q_kg(sum(link.allocated_kg for link in run.farm_load_links))
        else:
            actual = run.actual_loaded_kg or run.planned_kg or _ZERO

    old_returned = run.returned_kg
    old_wastage = run.wastage_kg
    old_actual = run.actual_loaded_kg

    run.returned_kg = q_kg(payload.returned_kg)
    run.wastage_kg = q_kg(payload.wastage_kg)
    run.actual_loaded_kg = q_kg(actual)
    run.reconciliation_notes = payload.notes
    run.reconciled_at = now_ist()

    await log_quantity_change(
        db,
        entity_type="delivery_run",
        entity_id=run.id,
        field="returned_kg",
        old_value=old_returned,
        new_value=run.returned_kg,
        reason=payload.notes,
        actor_user_id=actor_user_id,
        ref_type="delivery_run",
        ref_id=run.id,
    )
    await log_quantity_change(
        db,
        entity_type="delivery_run",
        entity_id=run.id,
        field="wastage_kg",
        old_value=old_wastage,
        new_value=run.wastage_kg,
        reason=payload.notes,
        actor_user_id=actor_user_id,
        ref_type="delivery_run",
        ref_id=run.id,
    )
    await log_quantity_change(
        db,
        entity_type="delivery_run",
        entity_id=run.id,
        field="actual_loaded_kg",
        old_value=old_actual,
        new_value=run.actual_loaded_kg,
        reason=payload.notes,
        actor_user_id=actor_user_id,
        ref_type="delivery_run",
        ref_id=run.id,
    )
    await db.flush()
    return await get_delivery_run(db, run.id)


async def create_stock_adjustment(
    db: AsyncSession,
    payload: StockAdjustmentCreate,
    *,
    actor_user_id: UUID | None = None,
) -> None:
    await log_quantity_change(
        db,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        field="adjustment_kg",
        old_value=_ZERO,
        new_value=q_kg(payload.adjustment_kg),
        reason=payload.reason,
        actor_user_id=actor_user_id,
        ref_type=payload.entity_type,
        ref_id=payload.entity_id,
    )


async def compute_trip_weight_loss(db: AsyncSession, run_id: UUID) -> TripWeightLossOut | None:
    run = await db.scalar(
        select(DeliveryRun)
        .options(selectinload(DeliveryRun.farm_load_links))
        .where(DeliveryRun.id == run_id)
        .with_for_update()
    )
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery run not found")

    primary_load_id = run.farm_load_id
    if not primary_load_id:
        primary_load_id = await db.scalar(
            select(DeliveryRunFarmLoad.farm_load_id)
            .where(DeliveryRunFarmLoad.delivery_run_id == run_id)
            .limit(1)
        )
    if not primary_load_id:
        return None

    load = await db.scalar(
        select(FarmLoad).where(FarmLoad.id == primary_load_id).with_for_update()
    )
    if load is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm load not found")

    delivered_kg = await _run_delivered_kg(db, run_id)
    loaded_kg = q_kg(run.actual_loaded_kg or run.planned_kg or _ZERO)
    returned = q_kg(run.returned_kg or _ZERO)
    wastage = q_kg(run.wastage_kg or _ZERO)
    raw_loss = loaded_kg - delivered_kg - returned - wastage
    loss_kg = q_kg(raw_loss if raw_loss > _ZERO else _ZERO)
    loss_pct = q_money((loss_kg / loaded_kg) * Decimal("100")) if loaded_kg > _ZERO else Decimal("0.00")

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
    run = await db.scalar(
        select(DeliveryRun)
        .options(selectinload(DeliveryRun.farm_load_links))
        .where(DeliveryRun.id == run_id)
        .with_for_update()
    )
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery run not found")
    if run.status == DeliveryRunStatus.COMPLETED:
        return await get_delivery_run(db, run.id)
    if run.status == DeliveryRunStatus.CANCELLED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Run is cancelled")

    non_terminal = await db.scalar(
        select(func.count())
        .select_from(DeliveryStop)
        .where(
            DeliveryStop.delivery_run_id == run_id,
            DeliveryStop.status.notin_(_TERMINAL_STOP),
        )
    )
    if non_terminal and non_terminal > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All stops must be billed, skipped, or failed before completing",
        )

    if run.reconciled_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reconciliation required before completing run",
        )

    delivered = await _run_delivered_kg(db, run_id)
    returned = q_kg(run.returned_kg or _ZERO)
    wastage = q_kg(run.wastage_kg or _ZERO)
    actual = q_kg(run.actual_loaded_kg or _ZERO)
    adjustment = await _run_adjustment_sum(db, run_id)
    expected = q_kg(delivered + returned + wastage + adjustment)
    diff = abs(actual - expected)
    if diff > _RECONCILE_TOLERANCE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Stock not reconciled: loaded {actual}kg != "
                f"delivered {delivered} + returned {returned} + wastage {wastage} "
                f"+ adjustments {adjustment} (= {expected}kg), diff {diff}kg"
            ),
        )

    run.status = DeliveryRunStatus.COMPLETED
    run.completed_at = now_ist()

    load_ids = [link.farm_load_id for link in run.farm_load_links]
    if run.farm_load_id and run.farm_load_id not in load_ids:
        load_ids.append(run.farm_load_id)

    for load_id in load_ids:
        other_active = await db.scalar(
            select(func.count())
            .select_from(DeliveryRunFarmLoad)
            .join(DeliveryRun, DeliveryRun.id == DeliveryRunFarmLoad.delivery_run_id)
            .where(
                DeliveryRunFarmLoad.farm_load_id == load_id,
                DeliveryRun.status.in_(_ACTIVE_RUN),
                DeliveryRun.id != run.id,
            )
        )
        if other_active and other_active > 0:
            continue
        load = await db.scalar(select(FarmLoad).where(FarmLoad.id == load_id).with_for_update())
        if load:
            load.status = FarmLoadStatus.CLOSED

    await compute_trip_weight_loss(db, run_id)
    await db.flush()
    return await get_delivery_run(db, run_id)


async def report_summary(db: AsyncSession, start: date, end: date) -> ReportSummary:
    ordered = await db.scalar(
        select(func.coalesce(func.sum(RetailerDailyOrderItem.requested_kg), 0))
        .join(RetailerDailyOrder, RetailerDailyOrder.id == RetailerDailyOrderItem.order_id)
        .where(
            RetailerDailyOrder.order_date >= start,
            RetailerDailyOrder.order_date <= end,
            RetailerDailyOrder.status != OrderStatus.CANCELLED,
        )
    )
    from app.models.domain import DeliveryBillItem

    delivered = await db.scalar(
        select(func.coalesce(func.sum(DeliveryBillItem.weight_kg), 0))
        .join(DeliveryBill, DeliveryBill.id == DeliveryBillItem.delivery_bill_id)
        .where(
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
    total_loss_val = await db.scalar(
        select(func.coalesce(func.sum(TripWeightLoss.loss_kg), 0))
        .join(DeliveryRun, DeliveryRun.id == TripWeightLoss.delivery_run_id)
        .where(
            DeliveryRun.run_date >= start,
            DeliveryRun.run_date <= end,
        )
    )
    total_loss = q_kg(Decimal(str(total_loss_val or 0)))

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

    from reportlab.lib.pagesizes import A4  # type: ignore[import-untyped]
    from reportlab.pdfgen import canvas  # type: ignore[import-untyped]

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
