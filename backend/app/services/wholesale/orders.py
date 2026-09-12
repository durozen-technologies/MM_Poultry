from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.timezone import now_ist
from app.models.domain import (
    DeliveryBill,
    DeliveryStop,
    DeliveryStopItem,
    OrderSequence,
    Retailer,
    RetailerDailyOrder,
    RetailerDailyOrderItem,
    Route,
)
from app.models.enums import (
    DeliveryStopStatus,
    OrderStatus,
)
from app.schemas.billing import DeliveryBillOut
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
    day = now_ist().date()
    existing = None

    if payload.order_id:
        from fastapi import HTTPException, status

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
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    else:
        # Only find today's editable order (PLACED/CANCELLED).
        existing = await db.scalar(
            select(RetailerDailyOrder)
            .options(
                selectinload(RetailerDailyOrder.items).selectinload(RetailerDailyOrderItem.item)
            )
            .where(
                RetailerDailyOrder.retailer_id == retailer_id,
                RetailerDailyOrder.order_date == day,
                RetailerDailyOrder.status.in_((OrderStatus.PLACED, OrderStatus.CANCELLED)),
            )
            .order_by(RetailerDailyOrder.created_at.desc())
            .limit(1)
        )

        # If no editable order exists, we will create a new one (existing = None)

    # Block non-placed orders from being modified (safety guard for explicit order_id path)
    _blocked = (OrderStatus.ACKNOWLEDGED, OrderStatus.DISPATCHED, OrderStatus.PARTIAL)
    if existing:
        if existing.status in _blocked:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot update a confirmed or dispatched order. Please place a new order.",
            )

        if existing.status != OrderStatus.PLACED:
            existing.status = OrderStatus.PLACED
        if not existing.order_number:
            existing.order_number = await _next_order_number(db, day)
        if payload.notes is not None:
            existing.notes = payload.notes
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
            notes=payload.notes,
        )
        db.add(order)
        await db.flush()

    item_ids = [item_in.item_id for item_in in payload.items if item_in.item_id]
    if item_ids:
        from fastapi import HTTPException, status

        from app.models.domain import Item

        existing_items = set((await db.scalars(select(Item.id).where(Item.id.in_(item_ids)))).all())
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
            notes=item_in.notes,
            locked_rate_per_kg=q_money(item_in.locked_rate_per_kg) if item_in.locked_rate_per_kg else None,
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
    day = now_ist().date()
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


async def list_today_orders(
    db: AsyncSession,
    *,
    route_id: UUID | None = None,
    unassigned_only: bool = False,
) -> TodayOrdersResponse:
    day = now_ist().date()

    stmt = (
        select(RetailerDailyOrder, Retailer, Route)
        .options(selectinload(RetailerDailyOrder.items).selectinload(RetailerDailyOrderItem.item))
        .join(Retailer, Retailer.id == RetailerDailyOrder.retailer_id)
        .outerjoin(Route, Route.id == Retailer.route_id)
        .where(RetailerDailyOrder.order_date == day)
        .order_by(RetailerDailyOrder.created_at.asc())
    )
    if route_id is not None:
        stmt = stmt.where(Retailer.route_id == route_id)
    if unassigned_only:
        stmt = stmt.where(Retailer.route_id.is_(None))

    res = await db.execute(stmt)
    raw_results = res.all()

    fulfilled_ids = [order.id for order, _, _ in raw_results if order.status in (OrderStatus.FULFILLED, OrderStatus.PARTIAL)]
    delivered_weights = {}
    billed_order_ids = set()
    if fulfilled_ids:
        stop_stmt = (
            select(DeliveryStop.daily_order_id, DeliveryStop.status, DeliveryStopItem.item_id, DeliveryStopItem.delivered_weight_kg)
            .join(DeliveryStopItem, DeliveryStop.id == DeliveryStopItem.delivery_stop_id)
            .where(DeliveryStop.daily_order_id.in_(fulfilled_ids))
        )
        stop_res = await db.execute(stop_stmt)
        for ord_id, st_status, it_id, del_kg in stop_res:
            delivered_weights[(ord_id, it_id)] = del_kg
            if st_status == DeliveryStopStatus.BILLED:
                billed_order_ids.add(ord_id)

    items: list[DailyOrderOut] = []
    total_kg = Decimal("0.000")
    total_bx = 0
    for order, retailer, route in raw_results:
        out = DailyOrderOut.model_validate(order, from_attributes=True)
        out.is_billed = order.id in billed_order_ids
        out.retailer_name = retailer.name
        out.shop_name = retailer.shop_name
        out.route_id = retailer.route_id
        out.route_name = route.name if route else retailer.route_name
        out.route_area = route.area if route else None
        out.retailer_area = None
        for i, model_item in enumerate(order.items):
            if model_item.item:
                out.items[i].item_name = model_item.item.name
            out.items[i].delivered_kg = delivered_weights.get((order.id, model_item.item_id))
        items.append(out)
        if order.status != OrderStatus.CANCELLED:
            for i in order.items:
                if i.requested_kg:
                    total_kg += i.requested_kg
                if i.total_boxes:
                    total_bx += i.total_boxes

    return TodayOrdersResponse(items=items, total_requested_kg=q_kg(total_kg), total_boxes=total_bx)


async def confirm_order(
    db: AsyncSession, order_id: UUID, payload: ConfirmOrderRequest
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
        order.expected_delivery_date = payload.expected_delivery_date
        
        if payload.item_prices:
            from app.services.wholesale.common import q_money
            price_map = {p.item_id: p.locked_rate_per_kg for p in payload.item_prices}
            for item in order.items:
                if item.item_id in price_map:
                    rate = price_map[item.item_id]
                    item.locked_rate_per_kg = q_money(rate) if rate is not None else None

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


async def set_order_prices(
    db: AsyncSession, order_id: UUID, payload: 'SetOrderPricesRequest'
) -> DailyOrderOut:
    from fastapi import HTTPException, status
    from app.services.wholesale.common import q_money
    from app.models.domain import DeliveryStopItem, DeliveryStop
    from app.models.enums import DeliveryStopStatus

    try:
        order = await db.scalar(
            select(RetailerDailyOrder)
            .options(selectinload(RetailerDailyOrder.items).selectinload(RetailerDailyOrderItem.item))
            .where(RetailerDailyOrder.id == order_id)
        )
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        
        price_map = {p.item_id: p.locked_rate_per_kg for p in payload.item_prices}
        for item in order.items:
            if item.item_id in price_map:
                rate = price_map[item.item_id]
                item.locked_rate_per_kg = q_money(rate) if rate is not None else None
        
        await db.flush()

        # Update any pending DeliveryStopItems corresponding to this order
        stops = await db.scalars(
            select(DeliveryStop)
            .options(selectinload(DeliveryStop.items))
            .where(DeliveryStop.daily_order_id == order_id)
        )
        for stop in stops:
            for s_item in stop.items:
                if s_item.item_id in price_map:
                    rate = price_map[s_item.item_id]
                    s_item.rate_per_kg = q_money(rate) if rate is not None else None
                    if s_item.rate_per_kg is not None and s_item.delivered_weight_kg is not None:
                        s_item.gross_amount = q_money(s_item.delivered_weight_kg * s_item.rate_per_kg)
                    else:
                        s_item.gross_amount = None

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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to set prices: {str(e)}")


async def make_order_billed(
    db: AsyncSession, order_id: UUID
) -> 'DeliveryBillOut':
    from fastapi import HTTPException, status
    from app.models.domain import DeliveryStop
    from app.models.enums import DeliveryStopStatus
    from app.services.wholesale.billing import commit_bill
    from app.schemas.billing import BillCommitRequest
    from uuid import uuid4
    from decimal import Decimal

    stop = await db.scalar(
        select(DeliveryStop)
        .options(selectinload(DeliveryStop.items))
        .where(DeliveryStop.daily_order_id == order_id)
    )
    if not stop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No delivery stop found for this order")
    
    if stop.status not in {DeliveryStopStatus.WEIGHED, DeliveryStopStatus.BILLED}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Stop must be weighed or already billed (current: {stop.status})")

    if not all(i.rate_per_kg is not None for i in stop.items):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not all items have prices set.")

    try:
        return await commit_bill(db, stop.id, BillCommitRequest(
            cash_payment=Decimal("0.0"),
            upi_payment=Decimal("0.0"),
            checkout_id=str(uuid4())
        ))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to make bill: {str(e)}")


async def list_orders_by_date(
    db: AsyncSession, 
    target_date: date | None = None, 
    start_date: date | None = None,
    end_date: date | None = None,
    retailer_id: UUID | None = None
) -> TodayOrdersResponse:
    try:
        query = (
            select(RetailerDailyOrder, Retailer.name, Retailer.shop_name)
            .options(selectinload(RetailerDailyOrder.items).selectinload(RetailerDailyOrderItem.item))
            .join(Retailer, Retailer.id == RetailerDailyOrder.retailer_id)
        )
        if start_date is not None and end_date is not None:
            query = query.where(RetailerDailyOrder.order_date.between(start_date, end_date))
        elif target_date is not None:
            query = query.where(RetailerDailyOrder.order_date == target_date)
            
        if retailer_id is not None:
            query = query.where(RetailerDailyOrder.retailer_id == retailer_id)
            
        res = await db.execute(query.order_by(RetailerDailyOrder.created_at.desc()))
        raw_results = res.all()

        fulfilled_ids = [order.id for order, _, _ in raw_results if order.status in (OrderStatus.FULFILLED, OrderStatus.PARTIAL)]
        delivered_weights = {}
        billed_order_ids = set()
        if fulfilled_ids:
            stop_stmt = (
                select(DeliveryStop.daily_order_id, DeliveryStop.status, DeliveryStopItem.item_id, DeliveryStopItem.delivered_weight_kg)
                .join(DeliveryStopItem, DeliveryStop.id == DeliveryStopItem.delivery_stop_id)
                .where(DeliveryStop.daily_order_id.in_(fulfilled_ids))
            )
            stop_res = await db.execute(stop_stmt)
            for ord_id, st_status, it_id, del_kg in stop_res:
                delivered_weights[(ord_id, it_id)] = del_kg
                if st_status == DeliveryStopStatus.BILLED:
                    billed_order_ids.add(ord_id)

        items: list[DailyOrderOut] = []
        total_kg = Decimal("0.000")
        total_bx = 0
        for order, r_name, r_shop in raw_results:
            out = DailyOrderOut.model_validate(order, from_attributes=True)
            out.is_billed = order.id in billed_order_ids
            out.retailer_name = r_name
            out.shop_name = r_shop
            for i, model_item in enumerate(order.items):
                if model_item.item:
                    out.items[i].item_name = model_item.item.name
                out.items[i].delivered_kg = delivered_weights.get((order.id, model_item.item_id))
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

async def get_bill_by_order_id(db: AsyncSession, order_id: UUID) -> DeliveryBillOut | None:
    from sqlalchemy.orm import selectinload
    from app.models.domain import DeliveryStopItem
    from app.services.wholesale.common import q_money, q_kg

    stmt = (
        select(DeliveryBill)
        .options(selectinload(DeliveryBill.items))
        .join(DeliveryStop, DeliveryStop.id == DeliveryBill.delivery_stop_id)
        .where(DeliveryStop.daily_order_id == order_id)
    )
    res = await db.scalar(stmt)
    if not res:
        return None

    # Fetch the current stop items to recalculate amounts from latest rate_per_kg
    stop_items = await db.scalars(
        select(DeliveryStopItem).where(DeliveryStopItem.delivery_stop_id == res.delivery_stop_id)
    )
    rate_map = {si.item_id: si for si in stop_items}

    out = DeliveryBillOut.model_validate(res, from_attributes=True)
    recalc_total = Decimal("0.00")
    for bi in out.items:
        si = rate_map.get(bi.item_id)
        if si and si.rate_per_kg is not None and si.delivered_weight_kg is not None:
            bi.amount = q_money(si.delivered_weight_kg * si.rate_per_kg)
        recalc_total += bi.amount or Decimal("0.00")
    out.total_amount = q_money(recalc_total)
    out.balance_amount = q_money(recalc_total - (out.cash_payment or Decimal("0")) - (out.upi_payment or Decimal("0")))
    return out
