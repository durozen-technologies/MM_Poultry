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
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    from app.core.ids import uuid7

    year = order_date.year
    stmt = (
        pg_insert(OrderSequence)
        .values(id=uuid7(), year=year, last_value=1)
        .on_conflict_do_update(
            constraint="uq_order_sequence_year",
            set_={"last_value": OrderSequence.last_value + 1},
        )
        .returning(OrderSequence.last_value)
    )
    last_val = await db.scalar(stmt)
    yy = str(year)[-2:]
    return f"ORD-{yy}-{(last_val or 1):06d}"


async def upsert_today_order(
    db: AsyncSession,
    *,
    retailer_id: UUID,
    payload: DailyOrderCreate,
    user_id: UUID | None,
) -> DailyOrderOut:
    day = today_ist()
    existing = None

    if payload.order_id:
        existing = await db.scalar(
            select(RetailerDailyOrder)
            .options(
                selectinload(RetailerDailyOrder.items).selectinload(RetailerDailyOrderItem.item)
            )
            .where(
                RetailerDailyOrder.id == payload.order_id,
                RetailerDailyOrder.retailer_id == retailer_id,
            )
        )
    else:
        # Fallback for older clients: Try to find an existing PLACED order for today
        existing = await db.scalar(
            select(RetailerDailyOrder)
            .options(
                selectinload(RetailerDailyOrder.items).selectinload(RetailerDailyOrderItem.item)
            )
            .where(
                RetailerDailyOrder.retailer_id == retailer_id,
                RetailerDailyOrder.order_date == day,
                RetailerDailyOrder.status == OrderStatus.PLACED,
            )
        )

    if existing:
        if existing.status != OrderStatus.PLACED and existing.status != OrderStatus.CANCELLED:
            raise ValueError("Cannot update a confirmed order. Please place a new order.")

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

    item_ids = [item_in.item_id for item_in in payload.items if item_in.item_id]
    if item_ids:
        from fastapi import HTTPException, status

        from app.models.domain import Item

        existing_items = set(await db.scalars(select(Item.id).where(Item.id.in_(item_ids))))
        missing = set(item_ids) - existing_items
        if missing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Item {next(iter(missing))} not found",
            )

    from sqlalchemy.exc import IntegrityError as _IE

    for item_in in payload.items:
        order_item = RetailerDailyOrderItem(
            order_id=order.id,
            item_id=item_in.item_id,
            total_boxes=item_in.total_boxes,
            requested_kg=q_kg(item_in.requested_kg) if item_in.requested_kg else None,
            bird_size=item_in.bird_size,
            notes=item_in.notes,
        )
        db.add(order_item)

    try:
        await db.flush()
    except _IE as e:
        # Retryable FK or deadlock — surface as 409 so test can retry
        msg = str(getattr(e, "orig", e)).lower()
        if "foreign key" in msg or "item_id" in msg:
            from fastapi import HTTPException, status

            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found (concurrent provisioning)") from e
        if "deadlock" in msg:
            from fastapi import HTTPException, status

            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Deadlock, please retry") from e
        raise

    # Reload to ensure all relationships are fresh
    reloaded = await db.scalar(
        select(RetailerDailyOrder)
        .options(selectinload(RetailerDailyOrder.items).selectinload(RetailerDailyOrderItem.item))
        .where(RetailerDailyOrder.id == order.id)
        .execution_options(populate_existing=True)
    )
    assert reloaded is not None
    order = reloaded

    retailer = await get_retailer(db, retailer_id)
    out = DailyOrderOut.model_validate(order, from_attributes=True)
    out.retailer_name = retailer.name
    out.shop_name = retailer.shop_name
    for i, model_item in enumerate(order.items):
        if model_item.item:
            out.items[i].item_name = model_item.item.name
    return out


async def get_today_orders_for_retailer(db: AsyncSession, retailer_id: UUID) -> list[DailyOrderOut]:
    day = today_ist()
    res = await db.execute(
        select(RetailerDailyOrder)
        .options(selectinload(RetailerDailyOrder.items).selectinload(RetailerDailyOrderItem.item))
        .where(
            RetailerDailyOrder.retailer_id == retailer_id,
            RetailerDailyOrder.order_date == day,
        )
        .order_by(RetailerDailyOrder.created_at.desc())
    )
    orders = res.scalars().all()
    if not orders:
        return []

    retailer = await get_retailer(db, retailer_id)
    out_list = []
    for order in orders:
        out = DailyOrderOut.model_validate(order, from_attributes=True)
        out.retailer_name = retailer.name
        out.shop_name = retailer.shop_name
        for i, model_item in enumerate(order.items):
            if model_item.item:
                out.items[i].item_name = model_item.item.name
        out_list.append(out)

    return out_list


async def list_today_orders(db: AsyncSession) -> TodayOrdersResponse:
    day = today_ist()

    res = await db.execute(
        select(RetailerDailyOrder, Retailer.name, Retailer.shop_name)
        .options(selectinload(RetailerDailyOrder.items).selectinload(RetailerDailyOrderItem.item))
        .join(Retailer, Retailer.id == RetailerDailyOrder.retailer_id)
        .where(
            RetailerDailyOrder.order_date == day,
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
        for i, model_item in enumerate(order.items):
            if model_item.item:
                out.items[i].item_name = model_item.item.name
        items.append(out)
        if order.status != OrderStatus.CANCELLED:
            for i in order.items:
                if i.requested_kg:
                    total_kg += i.requested_kg
                if i.total_boxes:
                    total_bx += i.total_boxes

    return TodayOrdersResponse(items=items, total_requested_kg=q_kg(total_kg), total_boxes=total_bx)


async def confirm_order(
    db: AsyncSession, order_id: UUID, expected_delivery_date: date
) -> DailyOrderOut:
    from fastapi import HTTPException, status

    try:
        order = await db.scalar(
            select(RetailerDailyOrder)
            .options(selectinload(RetailerDailyOrder.items).selectinload(RetailerDailyOrderItem.item))
            .where(RetailerDailyOrder.id == order_id)
        )
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

        if order.status != OrderStatus.PLACED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot confirm order in {order.status.name} state",
            )

        order.status = OrderStatus.ACKNOWLEDGED
        order.expected_delivery_date = expected_delivery_date
        await db.flush()

        retailer = await get_retailer(db, order.retailer_id)
        out = DailyOrderOut.model_validate(order, from_attributes=True)
        out.retailer_name = retailer.name
        out.shop_name = retailer.shop_name
        for i, model_item in enumerate(order.items):
            if model_item.item:
                out.items[i].item_name = model_item.item.name
        return out
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to confirm order: {str(e)}")


async def cancel_order(db: AsyncSession, order_id: UUID) -> DailyOrderOut:
    from fastapi import HTTPException, status
    try:
        order = await db.scalar(
            select(RetailerDailyOrder)
            .options(selectinload(RetailerDailyOrder.items).selectinload(RetailerDailyOrderItem.item))
            .where(RetailerDailyOrder.id == order_id)
        )
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        if order.status == OrderStatus.CANCELLED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order already cancelled")
        if order.status == OrderStatus.FULFILLED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot cancel fulfilled order")
        # Only PLACED or ACKNOWLEDGED can be cancelled
        if order.status not in (OrderStatus.PLACED, OrderStatus.ACKNOWLEDGED, OrderStatus.PARTIAL):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot cancel order in {order.status.name} state")
        order.status = OrderStatus.CANCELLED
        await db.flush()
        retailer = await get_retailer(db, order.retailer_id)
        out = DailyOrderOut.model_validate(order, from_attributes=True)
        out.retailer_name = retailer.name
        out.shop_name = retailer.shop_name
        return out
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to cancel order: {str(e)}")


async def list_orders_by_date(db: AsyncSession, target_date: date) -> TodayOrdersResponse:
    try:
        res = await db.execute(
            select(RetailerDailyOrder, Retailer.name, Retailer.shop_name)
            .options(selectinload(RetailerDailyOrder.items).selectinload(RetailerDailyOrderItem.item))
            .join(Retailer, Retailer.id == RetailerDailyOrder.retailer_id)
            .where(
                RetailerDailyOrder.order_date == target_date,
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
            for i, model_item in enumerate(order.items):
                if model_item.item:
                    out.items[i].item_name = model_item.item.name
            items.append(out)
            if order.status != OrderStatus.CANCELLED:
                for i in order.items:
                    if i.requested_kg:
                        total_kg += i.requested_kg
                    if i.total_boxes:
                        total_bx += i.total_boxes
        return TodayOrdersResponse(items=items, total_requested_kg=q_kg(total_kg), total_boxes=total_bx)
    except Exception as e:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to list orders by date: {str(e)}")
