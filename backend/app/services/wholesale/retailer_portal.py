from __future__ import annotations

from datetime import timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.timezone import today_ist
from app.models.domain import DeliveryBill, DeliveryRun, DeliveryStop, Payment, RetailerDailyOrder
from app.models.enums import DeliveryRunStatus, OrderStatus, PaymentType
from app.schemas import (
    DailyOrderOut,
    DeliveryBillOut,
    OrderTrackingStage,
    RetailerBillsPage,
    RetailerBillsSummary,
    RetailerDashboardOut,
    RetailerLastPayment,
    RetailerOrderDetailOut,
    RetailerOrdersPage,
    RetailerProfileOut,
    RetailerOut,
)
from app.services.wholesale.common import ZERO, q_money
from app.services.wholesale.orders import get_today_order_for_retailer
from app.services.wholesale.retailers import get_retailer


def _estimated_delivery_date(order_date) -> object:
    return order_date + timedelta(days=1)


def build_tracking_stages(
    order_status: OrderStatus,
    *,
    run_in_progress: bool = False,
) -> list[OrderTrackingStage]:
    if order_status == OrderStatus.CANCELLED:
        return [
            OrderTrackingStage(
                key="cancelled", label="Cancelled", completed=True, active=True
            )
        ]

    stage_defs = [
        ("pending", "Pending"),
        ("confirmed", "Confirmed"),
        ("preparing", "Preparing"),
        ("out_for_delivery", "Out for Delivery"),
        ("delivered", "Delivered"),
    ]
    progress = {
        OrderStatus.PLACED: 0,
        OrderStatus.ACKNOWLEDGED: 1,
        OrderStatus.PARTIAL: 2,
        OrderStatus.FULFILLED: 4,
    }.get(order_status, 0)

    if run_in_progress and progress >= 1:
        progress = max(progress, 3)

    return [
        OrderTrackingStage(
            key=key,
            label=label,
            completed=i < progress,
            active=i == progress,
        )
        for i, (key, label) in enumerate(stage_defs)
    ]


async def get_retailer_dashboard(db: AsyncSession, retailer_id: UUID) -> RetailerDashboardOut:
    retailer = await get_retailer(db, retailer_id)
    today_order = await get_today_order_for_retailer(db, retailer_id)

    last_pay = await db.scalar(
        select(Payment)
        .where(
            Payment.retailer_id == retailer_id,
            Payment.type == PaymentType.RECEIVED,
        )
        .order_by(Payment.payment_date.desc(), Payment.created_at.desc())
        .limit(1)
    )
    last_payment = None
    if last_pay:
        method = "UPI" if last_pay.upi_amount > ZERO else "Cash"
        if last_pay.cash_amount > ZERO and last_pay.upi_amount > ZERO:
            method = "Mixed"
        last_payment = RetailerLastPayment(
            amount=last_pay.total_amount,
            payment_date=last_pay.payment_date,
            method=method,
        )

    month_start = today_ist().replace(day=1)
    month_purchase = await db.scalar(
        select(func.coalesce(func.sum(DeliveryBill.total_amount), 0)).where(
            DeliveryBill.retailer_id == retailer_id,
            DeliveryBill.bill_date >= month_start,
        )
    )
    month_payments = await db.scalar(
        select(func.coalesce(func.sum(Payment.total_amount), 0)).where(
            Payment.retailer_id == retailer_id,
            Payment.type == PaymentType.RECEIVED,
            Payment.payment_date >= month_start,
        )
    )

    return RetailerDashboardOut(
        today_order=today_order,
        outstanding=retailer.credit_balance,
        last_payment=last_payment,
        month_purchase_total=q_money(month_purchase or ZERO),
        month_payment_total=q_money(month_payments or ZERO),
    )


async def list_retailer_orders(
    db: AsyncSession,
    retailer_id: UUID,
    *,
    scope: str = "today",
    cursor: str | None = None,
    limit: int = 50,
) -> RetailerOrdersPage:
    day = today_ist()
    stmt = (
        select(RetailerDailyOrder)
        .where(RetailerDailyOrder.retailer_id == retailer_id)
        .order_by(RetailerDailyOrder.order_date.desc(), RetailerDailyOrder.id.desc())
        .limit(limit + 1)
    )
    if scope == "today":
        stmt = stmt.where(RetailerDailyOrder.order_date == day)
    else:
        stmt = stmt.where(RetailerDailyOrder.order_date < day)
    if cursor:
        stmt = stmt.where(RetailerDailyOrder.id < UUID(cursor))

    rows = list(await db.scalars(stmt))
    has_more = len(rows) > limit
    rows = rows[:limit]
    retailer = await get_retailer(db, retailer_id)
    items: list[DailyOrderOut] = []
    for order in rows:
        out = DailyOrderOut.model_validate(order, from_attributes=True)
        out.retailer_name = retailer.name
        out.shop_name = retailer.shop_name
        items.append(out)

    next_cursor = str(rows[-1].id) if has_more and rows else None
    return RetailerOrdersPage(items=items, has_more=has_more, next_cursor=next_cursor)


async def get_retailer_order_detail(
    db: AsyncSession, retailer_id: UUID, order_id: UUID
) -> RetailerOrderDetailOut:
    order = await db.scalar(
        select(RetailerDailyOrder).where(
            RetailerDailyOrder.id == order_id,
            RetailerDailyOrder.retailer_id == retailer_id,
        )
    )
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    run_in_progress = False
    if order.id:
        stop = await db.scalar(
            select(DeliveryStop).where(DeliveryStop.daily_order_id == order.id)
        )
        if stop:
            run = await db.scalar(
                select(DeliveryRun).where(DeliveryRun.id == stop.delivery_run_id)
            )
            if run and run.status == DeliveryRunStatus.IN_PROGRESS:
                run_in_progress = True

    retailer = await get_retailer(db, retailer_id)
    base = DailyOrderOut.model_validate(order, from_attributes=True)
    base.retailer_name = retailer.name
    base.shop_name = retailer.shop_name
    return RetailerOrderDetailOut(
        **base.model_dump(),
        estimated_delivery_date=_estimated_delivery_date(order.order_date),
        tracking_stages=build_tracking_stages(
            order.status, run_in_progress=run_in_progress
        ),
    )


async def _bills_summary(db: AsyncSession, retailer_id: UUID) -> RetailerBillsSummary:
    count = int(
        await db.scalar(
            select(func.count()).select_from(DeliveryBill).where(
                DeliveryBill.retailer_id == retailer_id
            )
        )
        or 0
    )
    totals = await db.execute(
        select(
            func.coalesce(func.sum(DeliveryBill.total_amount), 0),
            func.coalesce(func.sum(DeliveryBill.cash_payment + DeliveryBill.upi_payment), 0),
            func.coalesce(func.sum(DeliveryBill.balance_amount), 0),
        ).where(DeliveryBill.retailer_id == retailer_id)
    )
    total_amount, total_paid, outstanding = totals.one()
    return RetailerBillsSummary(
        count=count,
        total_amount=q_money(total_amount),
        total_paid=q_money(total_paid),
        outstanding=q_money(outstanding),
    )


async def list_retailer_bills(
    db: AsyncSession,
    retailer_id: UUID,
    *,
    cursor: str | None = None,
    limit: int = 50,
) -> RetailerBillsPage:
    stmt = (
        select(DeliveryBill)
        .where(DeliveryBill.retailer_id == retailer_id)
        .order_by(DeliveryBill.bill_date.desc(), DeliveryBill.id.desc())
        .limit(limit + 1)
    )
    if cursor:
        stmt = stmt.where(DeliveryBill.id < UUID(cursor))
    rows = list(await db.scalars(stmt))
    has_more = len(rows) > limit
    rows = rows[:limit]
    summary = await _bills_summary(db, retailer_id)
    items = [DeliveryBillOut.model_validate(r, from_attributes=True) for r in rows]
    next_cursor = str(rows[-1].id) if has_more and rows else None
    return RetailerBillsPage(
        items=items, summary=summary, has_more=has_more, next_cursor=next_cursor
    )


async def get_retailer_bill(
    db: AsyncSession, retailer_id: UUID, bill_id: UUID
) -> DeliveryBillOut:
    bill = await db.scalar(
        select(DeliveryBill).where(
            DeliveryBill.id == bill_id,
            DeliveryBill.retailer_id == retailer_id,
        )
    )
    if bill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    return DeliveryBillOut.model_validate(bill, from_attributes=True)


async def get_retailer_profile(db: AsyncSession, retailer_id: UUID, username: str) -> RetailerProfileOut:
    retailer = await get_retailer(db, retailer_id)
    return RetailerProfileOut(
        retailer=RetailerOut.model_validate(retailer, from_attributes=True),
        username=username,
    )
