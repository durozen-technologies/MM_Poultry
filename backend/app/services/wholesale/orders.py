from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.timezone import today_ist
from app.models.domain import OrderSequence, Retailer, RetailerDailyOrder, RetailerDailyOrderItem
from app.models.enums import (
    OrderStatus,
)
from app.schemas.order import (
    DailyOrderCreate,
    DailyOrderOut,
    TodayOrdersResponse,
)
from app.services.wholesale.common import q_kg
from app.services.wholesale.retailers import get_retailer


async def _next_order_number(db: AsyncSession, order_date: date) -> str:
    year = order_date.year
    seq = await db.scalar(select(OrderSequence).where(OrderSequence.year == year))
    if seq is None:
        seq = OrderSequence(year=year, last_value=0)
        db.add(seq)
        await db.flush()
    seq.last_value += 1
    await db.flush()
    # Format: ORD-YY-000000
    yy = str(year)[-2:]
    return f"ORD-{yy}-{seq.last_value:06d}"


async def upsert_today_order(
    db: AsyncSession,
    *,
    retailer_id: UUID,
    payload: DailyOrderCreate,
    user_id: UUID | None,
) -> DailyOrderOut:
    day = today_ist()
    existing = await db.scalar(
        select(RetailerDailyOrder)
        .options(selectinload(RetailerDailyOrder.items))
        .where(
            RetailerDailyOrder.retailer_id == retailer_id,
            RetailerDailyOrder.order_date == day,
        )
    )
    if existing:
        if existing.status == OrderStatus.CANCELLED:
            existing.status = OrderStatus.PLACED
        if not existing.order_number:
            existing.order_number = await _next_order_number(db, day)
        order = existing
        
        # Clear existing items and replace with new cart payload
        for item in existing.items:
            await db.delete(item)
        existing.items.clear()
        await db.flush()
    else:
        order_number = await _next_order_number(db, day)
        order = RetailerDailyOrder(
            retailer_id=retailer_id,
            order_date=day,
            order_number=order_number,
            status=OrderStatus.PLACED,
            created_by_user_id=user_id,
        )
        db.add(order)
        await db.flush()
        
    for item_in in payload.items:
        order_item = RetailerDailyOrderItem(
            order_id=order.id,
            item_id=item_in.item_id,
            total_boxes=item_in.total_boxes,
            requested_kg=q_kg(item_in.requested_kg) if item_in.requested_kg else None,
            bird_size=item_in.bird_size,
            notes=item_in.notes
        )
        db.add(order_item)

    await db.flush()
    
    # Reload to ensure all relationships are fresh
    reloaded = await db.scalar(
        select(RetailerDailyOrder)
        .options(selectinload(RetailerDailyOrder.items))
        .where(RetailerDailyOrder.id == order.id)
        .execution_options(populate_existing=True)
    )
    assert reloaded is not None
    order = reloaded
    
    retailer = await get_retailer(db, retailer_id)
    out = DailyOrderOut.model_validate(order, from_attributes=True)
    out.retailer_name = retailer.name
    out.shop_name = retailer.shop_name
    return out


async def get_today_order_for_retailer(db: AsyncSession, retailer_id: UUID) -> DailyOrderOut | None:
    day = today_ist()
    order = await db.scalar(
        select(RetailerDailyOrder)
        .options(selectinload(RetailerDailyOrder.items))
        .where(
            RetailerDailyOrder.retailer_id == retailer_id,
            RetailerDailyOrder.order_date == day,
        )
    )
    if order is None:
        return None
    retailer = await get_retailer(db, retailer_id)
    out = DailyOrderOut.model_validate(order, from_attributes=True)
    out.retailer_name = retailer.name
    out.shop_name = retailer.shop_name
    return out


async def list_today_orders(db: AsyncSession) -> TodayOrdersResponse:
    day = today_ist()

    res = await db.execute(
        select(RetailerDailyOrder, Retailer.name, Retailer.shop_name)
        .options(selectinload(RetailerDailyOrder.items))
        .join(Retailer, Retailer.id == RetailerDailyOrder.retailer_id)
        .where(
            RetailerDailyOrder.order_date == day,
            RetailerDailyOrder.status != OrderStatus.CANCELLED,
        )
        .order_by(RetailerDailyOrder.created_at.asc())
    )

    items: list[DailyOrderOut] = []
    total_kg = Decimal("0.000")
    total_bx = 0
    for order, r_name, r_shop in res:
        out = DailyOrderOut.model_validate(order, from_attributes=True)
        out.retailer_name = r_name
        out.shop_name = r_shop
        items.append(out)
        for i in order.items:
            if i.requested_kg:
                total_kg += i.requested_kg
            if i.total_boxes:
                total_bx += i.total_boxes

    return TodayOrdersResponse(items=items, total_requested_kg=q_kg(total_kg), total_boxes=total_bx)
