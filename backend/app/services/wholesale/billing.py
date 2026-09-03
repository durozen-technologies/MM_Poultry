from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.timezone import now_ist, today_ist
from app.models.domain import (
    BillSequence,
    DeliveryBill,
    DeliveryBillItem,
    DeliveryRun,
    DeliveryStop,
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
from app.schemas.delivery import DeliveryStopOut, WeighRequest
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
    if stop.status in {DeliveryStopStatus.SKIPPED, DeliveryStopStatus.FAILED}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Stop not weighable")
    if stop.status == DeliveryStopStatus.BILLED:
        has_remaining = any((it.remaining_kg or ZERO) > ZERO for it in stop.items)
        if not has_remaining:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Stop already billed")
    if payload.weight_override_reason and actor_role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin may override weight with reason",
        )
    if not stop.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Stop has no items to weigh"
        )

    payload_item_map = {pi.item_id: pi for pi in payload.items}
    # Validate all stop items are present in payload
    missing = [str(i.item_id) for i in stop.items if i.item_id not in payload_item_map]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing weigh data for items: {', '.join(missing)}",
        )
    # Validate no extra items
    unknown = [str(k) for k in payload_item_map if k not in {i.item_id for i in stop.items}]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown item_ids in payload: {', '.join(unknown)}",
        )
    for item in stop.items:
        pi = payload_item_map.get(item.item_id)
        if pi:
            if pi.gross_weight_kg <= Decimal("0"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Gross weight must be > 0 for item {item.item_id}",
                )
            if pi.delivered_boxes <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Delivered boxes must be > 0 for item {item.item_id}",
                )
            if pi.empty_box_weight_kg < Decimal("0"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Empty box weight cannot be negative for item {item.item_id}",
                )
            net_weight = pi.gross_weight_kg - (Decimal(pi.delivered_boxes) * pi.empty_box_weight_kg)
            if net_weight <= Decimal("0"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Net weight must be > 0 for item {item.item_id} (gross {pi.gross_weight_kg} - boxes {pi.delivered_boxes}*{pi.empty_box_weight_kg})",
                )
            # Guard against unrealistic values
            if net_weight > Decimal("10000"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Net weight {net_weight}kg exceeds sanity limit for item {item.item_id}",
                )
            prev_delivered = item.delivered_weight_kg or ZERO
            total_delivered = q_kg(prev_delivered + q_kg(net_weight))
            if total_delivered > item.ordered_kg:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Delivered {total_delivered}kg exceeds ordered {item.ordered_kg}kg for item {item.item_id}",
                )
            item.delivered_weight_kg = total_delivered
            item.gross_weight_kg = q_kg(pi.gross_weight_kg)
            item.delivered_boxes = pi.delivered_boxes
            item.empty_box_weight_kg = q_kg(pi.empty_box_weight_kg)
            item.delivered_bird_count = pi.delivered_bird_count
            item.gross_amount = q_money(item.delivered_weight_kg * item.rate_per_kg)
            item.remaining_kg = q_kg(max(item.ordered_kg - total_delivered, ZERO))
            if payload.weight_override_reason:
                item.weight_override_reason = payload.weight_override_reason[:500]
            if payload.scale_device_id:
                stop.scale_device_id = payload.scale_device_id[:120]

    stop.status = DeliveryStopStatus.WEIGHED
    stop.weighed_at = now_ist()
    await db.flush()
    return await _stop_out(db, stop)


def _preview_from_stop(stop: DeliveryStop, payload: BillPreviewRequest) -> BillPreviewOut:
    items_out = []
    total_amount = ZERO
    for item in stop.items:
        if item.delivered_weight_kg is None or item.gross_amount is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Stop items not weighed fully"
            )
        total_amount += item.gross_amount
        items_out.append(
            BillItemPreviewOut(
                item_id=item.item_id,
                weight_kg=item.delivered_weight_kg,
                rate_per_kg=item.rate_per_kg,
                amount=item.gross_amount,
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
    seq = await db.scalar(select(BillSequence).where(BillSequence.year == year).with_for_update())
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

    # checkout_id scoping: check by checkout_id globally for idempotency, but ensure same stop
    by_checkout = await db.scalar(
        select(DeliveryBill)
        .options(selectinload(DeliveryBill.items))
        .where(DeliveryBill.checkout_id == checkout_id)
    )
    if by_checkout:
        if by_checkout.delivery_stop_id != stop_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="checkout_id already used for different stop",
            )
        return DeliveryBillOut.model_validate(by_checkout, from_attributes=True)

    existing = await db.scalar(
        select(DeliveryBill)
        .options(selectinload(DeliveryBill.items))
        .where(DeliveryBill.delivery_stop_id == stop_id)
    )
    if existing and stop.status == DeliveryStopStatus.BILLED:
        has_remaining = any((it.remaining_kg or ZERO) > ZERO for it in stop.items)
        if not has_remaining:
            return DeliveryBillOut.model_validate(existing, from_attributes=True)

    if stop.status not in {DeliveryStopStatus.WEIGHED, DeliveryStopStatus.BILLED}:
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
                f"Credit limit exceeded: limit {retailer.credit_limit}, "
                f"current {retailer.credit_balance}, bill balance {preview.balance_amount}, "
                f"would be {q_money(retailer.credit_balance + preview.balance_amount)}"
            ),
        )

    if existing:
        old_balance = existing.balance_amount
        existing.total_amount = preview.total_amount
        existing.cash_payment = preview.cash_payment
        existing.upi_payment = preview.upi_payment
        existing.balance_amount = preview.balance_amount
        retailer.credit_balance = q_money(
            retailer.credit_balance - old_balance + preview.balance_amount
        )
        for prev_item in preview.items:
            bill_item = next(
                (bi for bi in existing.items if bi.item_id == prev_item.item_id),
                None,
            )
            if bill_item:
                bill_item.weight_kg = prev_item.weight_kg
                bill_item.amount = prev_item.amount
        stop.status = DeliveryStopStatus.WEIGHED
        has_remaining = any((it.remaining_kg or ZERO) > ZERO for it in stop.items)
        if not has_remaining:
            stop.status = DeliveryStopStatus.BILLED
        if stop.daily_order_id:
            order = await db.scalar(
                select(RetailerDailyOrder).where(RetailerDailyOrder.id == stop.daily_order_id)
            )
            if order and not has_remaining:
                order.status = OrderStatus.FULFILLED
        await db.flush()
        return DeliveryBillOut.model_validate(existing, from_attributes=True)

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
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        # Race on checkout_id or bill_number or delivery_stop_id — fetch existing
        existing_race = await db.scalar(
            select(DeliveryBill)
            .options(selectinload(DeliveryBill.items))
            .where(
                (DeliveryBill.checkout_id == checkout_id)
                | (DeliveryBill.delivery_stop_id == stop_id)
            )
        )
        if existing_race:
            return DeliveryBillOut.model_validate(existing_race, from_attributes=True)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bill already exists")

    for prev_item in preview.items:
        bill_item = DeliveryBillItem(
            delivery_bill_id=bill.id,
            item_id=prev_item.item_id,
            weight_kg=prev_item.weight_kg,
            rate_per_kg=prev_item.rate_per_kg,
            amount=prev_item.amount,
            box_charge=Decimal("0.00"),
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
    has_remaining = any((it.remaining_kg or ZERO) > ZERO for it in stop.items)
    if has_remaining:
        stop.status = DeliveryStopStatus.WEIGHED
    if stop.daily_order_id:
        order = await db.scalar(
            select(RetailerDailyOrder).where(RetailerDailyOrder.id == stop.daily_order_id)
        )
        if order:
            has_remaining = any(
                (it.remaining_kg or ZERO) > ZERO for it in stop.items
            )
            if not has_remaining:
                order.status = OrderStatus.FULFILLED

    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Concurrent bill commit conflict"
        ) from exc

    if payment:
        payment.delivery_bill_id = bill.id

    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Payment conflict"
        ) from exc

    reloaded = await db.scalar(
        select(DeliveryBill)
        .options(selectinload(DeliveryBill.items))
        .where(DeliveryBill.id == bill.id)
    )
    assert reloaded is not None
    return DeliveryBillOut.model_validate(reloaded, from_attributes=True)


_VALID_PRINT_TRANSITIONS: dict[PrintStatus, set[PrintStatus]] = {
    PrintStatus.PENDING: {PrintStatus.PRINTED, PrintStatus.FAILED, PrintStatus.SKIPPED},
    PrintStatus.FAILED: {PrintStatus.PRINTED, PrintStatus.SKIPPED, PrintStatus.PENDING},
    PrintStatus.PRINTED: set(),
    PrintStatus.SKIPPED: set(),
}


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
    current = bill.print_status
    target = payload.print_status
    if current != target:
        allowed = _VALID_PRINT_TRANSITIONS.get(current, set())
        if target not in allowed:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Invalid print status transition {current.value} -> {target.value}",
            )
        bill.print_status = target
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
                func.coalesce(func.sum(RetailerDailyOrderItem.total_boxes), 0),
            )
            .outerjoin(
                RetailerDailyOrderItem, RetailerDailyOrder.id == RetailerDailyOrderItem.order_id
            )
            .where(RetailerDailyOrder.order_date == day)
        )
    ).first()

    order_count, ordered_kg_val, ordered_boxes_val = order_res or (0, ZERO, 0)
    ordered_kg = q_kg(ordered_kg_val)
    ordered_boxes = int(ordered_boxes_val)

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
                func.coalesce(
                    func.sum(DeliveryBill.total_amount), 0
                ),  # Note: this might double count if joined naively, so we separate it.
            )
            .select_from(DeliveryBill)
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
        ordered_boxes=ordered_boxes,
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
