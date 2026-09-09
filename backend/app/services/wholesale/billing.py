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
    FarmLoad,
    Payment,
    Retailer,
    RetailerDailyOrder,
    RetailerDailyOrderItem,
)
from app.models.enums import (
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
from app.schemas.report import OpsDashboard
from app.services.wholesale.common import ZERO, _get_org_settings, q_kg, q_money
from app.services.wholesale.retailers import get_retailer


async def _order_out(db: AsyncSession, order: RetailerDailyOrder) -> RetailerDailyOrder:
    """Re-fetch order with items eager-loaded."""
    refreshed = await db.scalar(
        select(RetailerDailyOrder)
        .options(selectinload(RetailerDailyOrder.items))
        .where(RetailerDailyOrder.id == order.id)
    )
    return refreshed or order


async def weigh_order_items(
    db: AsyncSession,
    order_id: UUID,
    items_payload: list[dict],
    *,
    actor_role: UserRole,
) -> None:
    """Weigh items for an order (replaces weigh_stop)."""
    from app.services.wholesale.rates import resolve_rate

    order = await db.scalar(
        select(RetailerDailyOrder)
        .options(selectinload(RetailerDailyOrder.items))
        .where(RetailerDailyOrder.id == order_id)
    )
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if order.status not in (OrderStatus.ACKNOWLEDGED, OrderStatus.DISPATCHED):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Order in status {order.status.value} cannot be weighed",
        )

    payload_item_map = {UUID(pi["item_id"]): pi for pi in items_payload}

    for item in order.items:
        pi = payload_item_map.get(item.item_id)
        if pi:
            weight = q_kg(Decimal(str(pi.get("weight_kg", 0))))
            if weight <= ZERO:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Weight must be > 0 for item {item.item_id}",
                )
            boxes = int(pi.get("delivered_boxes", 1))
            if boxes <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Delivered boxes must be > 0 for item {item.item_id}",
                )
            live_rate = await resolve_rate(db, item.item_id, order.retailer_id, today_ist())
            item.locked_rate_per_kg = live_rate

    await db.flush()


def _preview_from_order(order: RetailerDailyOrder, payload: BillPreviewRequest) -> BillPreviewOut:
    items_out = []
    total_amount = ZERO
    for item in order.items:
        if item.locked_rate_per_kg is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Order items not weighed/locked"
            )
        requested_kg = item.requested_kg or ZERO
        amount = q_money(requested_kg * item.locked_rate_per_kg)
        total_amount += amount
        items_out.append(
            BillItemPreviewOut(
                item_id=item.item_id,
                weight_kg=requested_kg,
                rate_per_kg=item.locked_rate_per_kg,
                amount=amount,
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
        stop_id=order.id,
        retailer_id=order.retailer_id,
        items=items_out,
        total_amount=total_amount,
        cash_payment=cash,
        upi_payment=upi,
        balance_amount=balance,
    )


async def preview_bill(
    db: AsyncSession, order_id: UUID, payload: BillPreviewRequest
) -> BillPreviewOut:
    order = await db.scalar(
        select(RetailerDailyOrder)
        .options(selectinload(RetailerDailyOrder.items))
        .where(RetailerDailyOrder.id == order_id)
    )
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.status not in (OrderStatus.ACKNOWLEDGED, OrderStatus.DISPATCHED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order must be acknowledged before billing",
        )
    return _preview_from_order(order, payload)


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
    db: AsyncSession, order_id: UUID, payload: BillCommitRequest
) -> DeliveryBillOut:
    order = await db.scalar(
        select(RetailerDailyOrder)
        .options(selectinload(RetailerDailyOrder.items))
        .where(RetailerDailyOrder.id == order_id)
    )
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    checkout_id = (payload.checkout_id or "").strip() or str(uuid4())

    by_checkout = await db.scalar(
        select(DeliveryBill)
        .options(selectinload(DeliveryBill.items))
        .where(DeliveryBill.checkout_id == checkout_id)
    )
    if by_checkout:
        if by_checkout.retailer_daily_order_id != order_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="checkout_id already used for different order",
            )
        return DeliveryBillOut.model_validate(by_checkout, from_attributes=True)

    existing = await db.scalar(
        select(DeliveryBill)
        .options(selectinload(DeliveryBill.items))
        .where(DeliveryBill.retailer_daily_order_id == order_id)
    )
    if existing and order.status == OrderStatus.FULFILLED:
        return DeliveryBillOut.model_validate(existing, from_attributes=True)

    if order.status not in (OrderStatus.ACKNOWLEDGED, OrderStatus.DISPATCHED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order must be acknowledged before commit",
        )

    preview = _preview_from_order(
        order, BillPreviewRequest(cash_payment=payload.cash_payment, upi_payment=payload.upi_payment)
    )
    retailer = await get_retailer(db, order.retailer_id)
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
        order.status = OrderStatus.FULFILLED
        await db.flush()
        return DeliveryBillOut.model_validate(existing, from_attributes=True)

    bill_date = today_ist()
    bill_number = await _next_bill_number(db, bill_date)
    print_status = payload.print_status or PrintStatus.PENDING

    bill = DeliveryBill(
        bill_number=bill_number,
        checkout_id=checkout_id,
        retailer_daily_order_id=order.id,
        retailer_id=order.retailer_id,
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
        existing_race = await db.scalar(
            select(DeliveryBill)
            .options(selectinload(DeliveryBill.items))
            .where(
                (DeliveryBill.checkout_id == checkout_id)
                | (DeliveryBill.retailer_daily_order_id == order_id)
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
            retailer_id=order.retailer_id,
            delivery_bill_id=None,
            payment_date=bill_date,
            cash_amount=preview.cash_payment,
            upi_amount=preview.upi_payment,
            total_amount=q_money(collected),
            type=PaymentType.RECEIVED,
            notes=f"Collected on bill {bill_number}",
        )
        db.add(payment)

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
                ),
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

    completed = 0
    skipped = 0
    pending = 0

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
