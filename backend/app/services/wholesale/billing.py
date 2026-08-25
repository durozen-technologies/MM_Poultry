from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.timezone import now_ist, today_ist
from app.models.domain import (
    BillSequence,
    DeliveryBill,
    DeliveryBillItem,
    DeliveryRun,
    DeliveryStop,
    DeliveryStopItem,
    FarmLoad,
    Payment,
    Retailer,
    RetailerDailyOrder,
    RetailerDailyOrderItem,
)
from app.models.enums import (
    DeliveryStopStatus,
    OrderStatus,
    PaymentType,
    PrintStatus,
    UserRole,
)
from app.schemas.billing import (
    BillCommitRequest,
    BillItemPreviewOut,
    BillPreviewOut,
    BillPreviewRequest,
    DeliveryBillOut,
    PrintStatusUpdate,
)
from app.schemas.delivery import WeighRequest, DeliveryStopOut
from app.schemas.report import OpsDashboard
from app.services.wholesale.common import ZERO, _get_org_settings, q_kg, q_money
from app.services.wholesale.delivery_runs import _stop_out
from app.services.wholesale.retailers import get_retailer


async def weigh_stop(
    db: AsyncSession,
    stop_id: UUID,
    payload: WeighRequest,
    *,
    actor_role: UserRole,
) -> DeliveryStopOut:
    stop = await db.scalar(
        select(DeliveryStop)
        .options(selectinload(DeliveryStop.items))
        .where(DeliveryStop.id == stop_id)
    )
    if stop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stop not found")
    if stop.status in {DeliveryStopStatus.BILLED, DeliveryStopStatus.SKIPPED}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Stop not weighable")
    if payload.weight_override_reason and actor_role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin may override weight with reason",
        )
    
    payload_item_map = {pi.item_id: pi for pi in payload.items}
    for item in stop.items:
        pi = payload_item_map.get(item.item_id)
        if pi:
            item.delivered_weight_kg = q_kg(pi.delivered_weight_kg)
            item.delivered_bird_count = pi.delivered_bird_count
            item.gross_amount = q_money(item.delivered_weight_kg * item.rate_per_kg)
    
    stop.status = DeliveryStopStatus.WEIGHED
    stop.weighed_at = now_ist()
    await db.flush()
    return await _stop_out(db, stop)


def _preview_from_stop(stop: DeliveryStop, payload: BillPreviewRequest) -> BillPreviewOut:
    items_out = []
    total_amount = ZERO
    for item in stop.items:
        if item.delivered_weight_kg is None or item.gross_amount is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stop items not weighed fully")
        total_amount += item.gross_amount
        items_out.append(
            BillItemPreviewOut(
                item_id=item.item_id,
                weight_kg=item.delivered_weight_kg,
                rate_per_kg=item.rate_per_kg,
                amount=item.gross_amount
            )
        )
    
    cash = q_money(payload.cash_payment)
    upi = q_money(payload.upi_payment)
    balance = q_money(total_amount - cash - upi)
    if balance < ZERO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payments exceed bill total",
        )
    return BillPreviewOut(
        stop_id=stop.id,
        retailer_id=stop.retailer_id,
        items=items_out,
        total_amount=total_amount,
        cash_payment=cash,
        upi_payment=upi,
        balance_amount=balance,
    )


async def preview_bill(
    db: AsyncSession, stop_id: UUID, payload: BillPreviewRequest
) -> BillPreviewOut:
    stop = await db.scalar(
        select(DeliveryStop)
        .options(selectinload(DeliveryStop.items))
        .where(DeliveryStop.id == stop_id)
    )
    if stop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stop not found")
    if stop.status != DeliveryStopStatus.WEIGHED and stop.status != DeliveryStopStatus.BILLED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stop not weighed")
    return _preview_from_stop(stop, payload)


async def _next_bill_number(db: AsyncSession, bill_date: date) -> str:
    year = bill_date.year
    seq = await db.scalar(select(BillSequence).where(BillSequence.year == year))
    if seq is None:
        seq = BillSequence(year=year, last_value=0)
        db.add(seq)
        await db.flush()
    seq.last_value += 1
    await db.flush()
    yy = str(year)[-2:]
    return f"Bill-{yy}-{seq.last_value:06d}"


async def commit_bill(
    db: AsyncSession, stop_id: UUID, payload: BillCommitRequest
) -> DeliveryBillOut:
    stop = await db.scalar(
        select(DeliveryStop)
        .options(selectinload(DeliveryStop.items))
        .where(DeliveryStop.id == stop_id)
    )
    if stop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stop not found")

    checkout_id = (payload.checkout_id or "").strip() or str(uuid4())

    by_checkout = await db.scalar(
        select(DeliveryBill)
        .options(selectinload(DeliveryBill.items))
        .where(DeliveryBill.checkout_id == checkout_id)
    )
    if by_checkout:
        return DeliveryBillOut.model_validate(by_checkout, from_attributes=True)

    existing = await db.scalar(
        select(DeliveryBill)
        .options(selectinload(DeliveryBill.items))
        .where(DeliveryBill.delivery_stop_id == stop_id)
    )
    if existing:
        return DeliveryBillOut.model_validate(existing, from_attributes=True)

    if stop.status != DeliveryStopStatus.WEIGHED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stop must be weighed before commit",
        )

    preview = _preview_from_stop(
        stop, BillPreviewRequest(cash_payment=payload.cash_payment, upi_payment=payload.upi_payment)
    )
    retailer = await get_retailer(db, stop.retailer_id)
    settings = await _get_org_settings(db)
    if (
        settings.enforce_credit_limit
        and retailer.credit_limit > ZERO
        and q_money(retailer.credit_balance + preview.balance_amount) > retailer.credit_limit
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Credit limit exceeded (limit ,1{retailer.credit_limit}, "
                f"would be ,1{q_money(retailer.credit_balance + preview.balance_amount)})"
            ),
        )

    bill_date = today_ist()
    bill_number = await _next_bill_number(db, bill_date)
    print_status = payload.print_status or PrintStatus.PENDING
    
    bill = DeliveryBill(
        bill_number=bill_number,
        checkout_id=checkout_id,
        delivery_stop_id=stop.id,
        retailer_id=stop.retailer_id,
        bill_date=bill_date,
        total_amount=preview.total_amount,
        cash_payment=preview.cash_payment,
        upi_payment=preview.upi_payment,
        balance_amount=preview.balance_amount,
        print_status=print_status,
    )
    db.add(bill)
    await db.flush()
    
    for prev_item in preview.items:
        bill_item = DeliveryBillItem(
            delivery_bill_id=bill.id,
            item_id=prev_item.item_id,
            weight_kg=prev_item.weight_kg,
            rate_per_kg=prev_item.rate_per_kg,
            amount=prev_item.amount,
        )
        db.add(bill_item)

    retailer.credit_balance = q_money(retailer.credit_balance + preview.balance_amount)

    payment = None
    collected = preview.cash_payment + preview.upi_payment
    if collected > ZERO:
        payment = Payment(
            retailer_id=stop.retailer_id,
            delivery_bill_id=None,  # set after flush
            payment_date=bill_date,
            cash_amount=preview.cash_payment,
            upi_amount=preview.upi_payment,
            total_amount=q_money(collected),
            type=PaymentType.RECEIVED,
            notes=f"Collected on bill {bill_number}",
        )
        db.add(payment)

    stop.status = DeliveryStopStatus.BILLED
    if stop.daily_order_id:
        order = await db.scalar(
            select(RetailerDailyOrder).where(RetailerDailyOrder.id == stop.daily_order_id)
        )
        if order:
            order.status = OrderStatus.FULFILLED

    await db.flush()

    if payment:
        payment.delivery_bill_id = bill.id

    await db.flush()
    
    bill = await db.scalar(
        select(DeliveryBill)
        .options(selectinload(DeliveryBill.items))
        .where(DeliveryBill.id == bill.id)
    )
    return DeliveryBillOut.model_validate(bill, from_attributes=True)


async def update_bill_print_status(
    db: AsyncSession, bill_id: UUID, payload: PrintStatusUpdate
) -> DeliveryBillOut:
    bill = await db.scalar(
        select(DeliveryBill)
        .options(selectinload(DeliveryBill.items))
        .where(DeliveryBill.id == bill_id)
    )
    if bill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    bill.print_status = payload.print_status
    await db.flush()
    return DeliveryBillOut.model_validate(bill, from_attributes=True)


async def ops_dashboard(db: AsyncSession, on_date: date | None = None) -> OpsDashboard:
    day = on_date or today_ist()
    settings = await _get_org_settings(db)

    order_res = (
        await db.execute(
            select(
                func.count(func.distinct(RetailerDailyOrder.id)),
                func.coalesce(func.sum(RetailerDailyOrderItem.requested_kg), 0),
            )
            .outerjoin(RetailerDailyOrderItem, RetailerDailyOrder.id == RetailerDailyOrderItem.order_id)
            .where(RetailerDailyOrder.order_date == day)
        )
    ).first()

    order_count, ordered_kg_val = order_res or (0, ZERO)
    ordered_kg = q_kg(ordered_kg_val)

    loaded_kg_val = await db.scalar(
        select(func.coalesce(func.sum(FarmLoad.loaded_weight_kg), 0)).where(
            FarmLoad.load_date == day
        )
    )
    loaded_kg = q_kg(loaded_kg_val or ZERO)

    bill_row = (
        await db.execute(
            select(
                func.coalesce(func.sum(DeliveryBillItem.weight_kg), 0),
                func.coalesce(func.sum(DeliveryBill.total_amount), 0), # Note: this might double count if joined naively, so we separate it.
            ).select_from(DeliveryBill)
             .outerjoin(DeliveryBillItem, DeliveryBill.id == DeliveryBillItem.delivery_bill_id)
             .where(DeliveryBill.bill_date == day)
        )
    ).first()
    
    bill_totals = (
        await db.execute(
            select(
                func.coalesce(func.sum(DeliveryBill.total_amount), 0),
                func.coalesce(func.sum(DeliveryBill.cash_payment + DeliveryBill.upi_payment), 0),
            ).where(DeliveryBill.bill_date == day)
        )
    ).first()

    del_weight_kg = bill_row[0] if bill_row else ZERO
    del_total_amt, del_coll = bill_totals or (ZERO, ZERO)
    delivered_kg = q_kg(del_weight_kg)
    total_sales = q_money(del_total_amt)
    total_collection = q_money(del_coll)

    pay_total_val = await db.scalar(
        select(func.coalesce(func.sum(Payment.total_amount), 0)).where(
            Payment.payment_date == day, Payment.type == PaymentType.RECEIVED
        )
    )
    pay_total = q_money(pay_total_val or ZERO)
    if pay_total > total_collection:
        total_collection = pay_total

    outstanding = q_money(
        (await db.scalar(select(func.coalesce(func.sum(Retailer.credit_balance), 0)))) or ZERO
    )
    retailer_count = int(
        (
            await db.scalar(
                select(func.count()).select_from(Retailer).where(Retailer.is_active.is_(True))
            )
        )
        or 0
    )

    stops_res = await db.execute(
        select(DeliveryStop.status, func.count(DeliveryStop.id))
        .join(DeliveryRun, DeliveryStop.delivery_run_id == DeliveryRun.id)
        .where(DeliveryRun.run_date == day)
        .group_by(DeliveryStop.status)
    )

    stops_counts = {row.status: row.count for row in stops_res.mappings()}

    completed = stops_counts.get(DeliveryStopStatus.BILLED, 0)
    skipped = stops_counts.get(DeliveryStopStatus.SKIPPED, 0)
    pending = stops_counts.get(DeliveryStopStatus.PENDING, 0) + stops_counts.get(
        DeliveryStopStatus.WEIGHED, 0
    )

    loss_kg = q_kg(max(loaded_kg - delivered_kg, ZERO)) if loaded_kg > ZERO else ZERO
    loss_pct = (
        (loss_kg / loaded_kg * Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if loaded_kg > ZERO
        else ZERO
    )
    if loss_pct >= settings.weight_loss_alert_pct:
        loss_status = "ALERT"
    elif loss_pct >= settings.weight_loss_warn_pct:
        loss_status = "WARN"
    else:
        loss_status = "OK"

    return OpsDashboard(
        order_count=order_count,
        ordered_kg=ordered_kg,
        loaded_kg=loaded_kg,
        delivered_kg=delivered_kg,
        pending_kg=q_kg(max(ordered_kg - delivered_kg, ZERO)),
        total_sales=total_sales,
        total_collection=total_collection,
        outstanding=outstanding,
        loss_kg=loss_kg,
        loss_pct=loss_pct,
        loss_status=loss_status,
        retailer_count=retailer_count,
        completed_deliveries=completed,
        pending_deliveries=pending,
        skipped_deliveries=skipped,
        weight_loss_warn_pct=settings.weight_loss_warn_pct,
        weight_loss_alert_pct=settings.weight_loss_alert_pct,
    )


async def mark_whatsapp_shared(db: AsyncSession, bill_id: UUID) -> DeliveryBillOut:
    bill = await db.scalar(
        select(DeliveryBill)
        .options(selectinload(DeliveryBill.items))
        .where(DeliveryBill.id == bill_id)
    )
    if bill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    bill.whatsapp_shared_at = now_ist()
    await db.flush()
    return DeliveryBillOut.model_validate(bill, from_attributes=True)
