from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.timezone import today_ist
from app.models.domain import (
    RetailerDailyOrder,
    OrderSequence,
)
from app.models.enums import (
    OrderStatus,
)
from app.schemas import (
    DailyOrderCreate,
    DailyOrderOut,
    TodayOrdersResponse,
)
from app.services.wholesale.common import q_kg
from app.services.wholesale.retailers import get_retailer
from datetime import date


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
        select(RetailerDailyOrder).where(
            RetailerDailyOrder.retailer_id == retailer_id,
            RetailerDailyOrder.order_date == day,
        )
    )
    if existing:
        if existing.status == OrderStatus.CANCELLED:
            existing.status = OrderStatus.PLACED
        existing.requested_kg = q_kg(payload.requested_kg)
        existing.bird_size = payload.bird_size
        existing.notes = payload.notes
        if not existing.order_number:
            existing.order_number = await _next_order_number(db, day)
        order = existing
    else:
        order_number = await _next_order_number(db, day)
        order = RetailerDailyOrder(
            retailer_id=retailer_id,
            order_date=day,
            order_number=order_number,
            requested_kg=q_kg(payload.requested_kg),
            bird_size=payload.bird_size,
            notes=payload.notes,
            status=OrderStatus.PLACED,
            created_by_user_id=user_id,
        )
        db.add(order)
    await db.flush()
    retailer = await get_retailer(db, retailer_id)
    out = DailyOrderOut.model_validate(order, from_attributes=True)
    out.retailer_name = retailer.name
    out.shop_name = retailer.shop_name
    return out


async def get_today_order_for_retailer(
    db: AsyncSession, retailer_id: UUID
) -> DailyOrderOut | None:
    day = today_ist()
    order = await db.scalar(
        select(RetailerDailyOrder).where(
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
    
    from app.models.domain import Retailer
    
    res = await db.execute(
        select(RetailerDailyOrder, Retailer.name, Retailer.shop_name)
        .join(Retailer, Retailer.id == RetailerDailyOrder.retailer_id)
        .where(
            RetailerDailyOrder.order_date == day,
            RetailerDailyOrder.status != OrderStatus.CANCELLED,
        )
        .order_by(RetailerDailyOrder.created_at.asc())
    )
    
    items: list[DailyOrderOut] = []
    total = Decimal("0.000")
    for order, r_name, r_shop in res:
        out = DailyOrderOut.model_validate(order, from_attributes=True)
        out.retailer_name = r_name
        out.shop_name = r_shop
        items.append(out)
        total += order.requested_kg
        
    return TodayOrdersResponse(items=items, total_requested_kg=q_kg(total))


