from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.timezone import now_ist, today_ist
from app.models.domain import (
    DeliveryRun,
    DeliveryStop,
    DeliveryStopItem,
    FarmLoad,
    Retailer,
    RetailerDailyOrder,
    Vehicle,
)
from app.models.enums import (
    DeliveryRunStatus,
    DeliveryStopStatus,
    FarmLoadStatus,
    OrderStatus,
)
from app.schemas.delivery import (
    DeliveryRunCreate,
    DeliveryRunOut,
    DeliveryStopOut,
)
from app.services.wholesale.rates import resolve_rate
from app.services.wholesale.retailers import get_retailer


async def _stop_out(db: AsyncSession, stop: DeliveryStop) -> DeliveryStopOut:
    retailer = await get_retailer(db, stop.retailer_id)
    out = DeliveryStopOut.model_validate(stop, from_attributes=True)
    out.retailer_name = retailer.name
    out.shop_name = retailer.shop_name
    out.route_name = retailer.route_name
    return out


async def create_delivery_run(db: AsyncSession, payload: DeliveryRunCreate) -> DeliveryRunOut:
    if not payload.order_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="order_ids required")
    # duplicate order_ids check
    if len(payload.order_ids) != len(set(payload.order_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Duplicate order_ids not allowed"
        )
    load = None
    if payload.farm_load_id:
        load = await db.scalar(select(FarmLoad).where(FarmLoad.id == payload.farm_load_id))
        if load is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm load not found")
        if load.status != FarmLoadStatus.OPEN:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Farm load not available (status={load.status.value})",
            )

    async with db.begin_nested():
        run = DeliveryRun(
            farm_load_id=load.id if load else None,
            run_date=payload.run_date or today_ist(),
            status=DeliveryRunStatus.PLANNED,
            driver_user_id=payload.driver_user_id,
            driver_name=payload.driver_name,
            vehicle_id=payload.vehicle_id,
            vehicle_number=payload.vehicle_number,
        )
        db.add(run)
        await db.flush()

        for idx, order_id in enumerate(payload.order_ids, start=1):
            order = await db.scalar(
                select(RetailerDailyOrder)
                .options(selectinload(RetailerDailyOrder.items))
                .where(RetailerDailyOrder.id == order_id)
            )
            if order is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
            _eligible = {OrderStatus.PLACED, OrderStatus.ACKNOWLEDGED, OrderStatus.PARTIAL}
            if order.status not in _eligible:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Order {order_id} is {order.status.value} — only PLACED/ACKNOWLEDGED/PARTIAL orders can be dispatched",
                )

            stop = DeliveryStop(
                delivery_run_id=run.id,
                retailer_id=order.retailer_id,
                daily_order_id=order.id,
                sequence=idx,
                status=DeliveryStopStatus.PENDING,
            )
            db.add(stop)
            await db.flush()

            for item in order.items:
                rate = await resolve_rate(db, item.item_id, order.retailer_id, run.run_date)
                stop_item = DeliveryStopItem(
                    delivery_stop_id=stop.id,
                    item_id=item.item_id,
                    ordered_kg=item.requested_kg if item.requested_kg is not None else 0,
                    rate_per_kg=rate,
                )
                db.add(stop_item)

            order.status = OrderStatus.ACKNOWLEDGED

        # Vehicle capacity validation — uses already-fetched order items to avoid N+1
        # Compute total ordered kg from the orders we just processed
        fetched_orders: list[RetailerDailyOrder] = []
        for oid in payload.order_ids:
            o = await db.scalar(
                select(RetailerDailyOrder)
                .options(selectinload(RetailerDailyOrder.items))
                .where(RetailerDailyOrder.id == oid)
            )
            if o:
                fetched_orders.append(o)
        total_ordered_kg = sum(
            (itm.requested_kg or 0) for ord in fetched_orders for itm in ord.items
        )

        vehicle: Vehicle | None = None
        if payload.vehicle_id:
            vehicle = await db.scalar(select(Vehicle).where(Vehicle.id == payload.vehicle_id))
        elif load and load.vehicle_id:
            vehicle = await db.scalar(select(Vehicle).where(Vehicle.id == load.vehicle_id))
        if vehicle and vehicle.capacity_kg is not None:
            from decimal import Decimal as _D

            cap = _D(str(vehicle.capacity_kg))
            # Use Decimal comparison for precision
            if _D(str(total_ordered_kg)) > cap:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Total ordered {total_ordered_kg}kg exceeds vehicle capacity {cap}kg",
                )
            if load and load.loaded_weight_kg is not None and _D(str(load.loaded_weight_kg)) > cap:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Farm load {load.loaded_weight_kg}kg exceeds vehicle capacity {cap}kg",
                )

        if load:
            load.status = FarmLoadStatus.IN_TRANSIT
        await db.flush()
    return await get_delivery_run(db, run.id)


async def get_delivery_run(db: AsyncSession, run_id: UUID) -> DeliveryRunOut:
    run = await db.scalar(select(DeliveryRun).where(DeliveryRun.id == run_id))
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery run not found")

    stops_res = await db.execute(
        select(DeliveryStop, Retailer.name, Retailer.shop_name, Retailer.route_name)
        .options(selectinload(DeliveryStop.items))
        .join(Retailer, Retailer.id == DeliveryStop.retailer_id)
        .where(DeliveryStop.delivery_run_id == run.id)
        .order_by(DeliveryStop.sequence.asc())
    )

    out = DeliveryRunOut.model_validate(run, from_attributes=True)
    stops_out = []
    for stop, r_name, r_shop, r_route in stops_res:
        s_out = DeliveryStopOut.model_validate(stop, from_attributes=True)
        s_out.retailer_name = r_name
        s_out.shop_name = r_shop
        s_out.route_name = r_route
        stops_out.append(s_out)

    out.stops = stops_out
    return out


async def get_active_run(db: AsyncSession, driver_user_id: UUID | None = None) -> DeliveryRunOut | None:
    stmt = (
        select(DeliveryRun)
        .where(DeliveryRun.status.in_([DeliveryRunStatus.PLANNED, DeliveryRunStatus.IN_PROGRESS]))
        .order_by(DeliveryRun.created_at.desc())
        .limit(1)
    )
    if driver_user_id is not None:
        stmt = stmt.where(DeliveryRun.driver_user_id == driver_user_id)
    run = await db.scalar(stmt)
    if run is None:
        return None
    return await get_delivery_run(db, run.id)


async def list_delivery_runs(db: AsyncSession, limit: int = 20, offset: int = 0) -> list[DeliveryRunOut]:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    runs = list(
        await db.scalars(select(DeliveryRun).order_by(DeliveryRun.created_at.desc()).offset(offset).limit(limit))
    )
    result: list[DeliveryRunOut] = []
    for r in runs:
        result.append(await get_delivery_run(db, r.id))
    return result


async def start_delivery_run(db: AsyncSession, run_id: UUID) -> DeliveryRunOut:
    run = await db.scalar(select(DeliveryRun).where(DeliveryRun.id == run_id).with_for_update())
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery run not found")
    if run.status == DeliveryRunStatus.IN_PROGRESS:
        return await get_delivery_run(db, run.id)
    if run.status == DeliveryRunStatus.COMPLETED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Run already completed")
    run.status = DeliveryRunStatus.IN_PROGRESS
    run.started_at = now_ist()
    await db.flush()
    return await get_delivery_run(db, run.id)


async def skip_stop(db: AsyncSession, stop_id: UUID, reason: str | None = None) -> DeliveryStopOut:
    stop = await db.scalar(
        select(DeliveryStop)
        .options(selectinload(DeliveryStop.items))
        .where(DeliveryStop.id == stop_id)
    )
    if stop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stop not found")
    if stop.status == DeliveryStopStatus.BILLED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Stop already billed")
    if stop.status == DeliveryStopStatus.SKIPPED:
        return await _stop_out(db, stop)
    stop.status = DeliveryStopStatus.SKIPPED
    # Optional: store skip reason in scale_device_id field fallback or log
    if reason:
        stop.scale_device_id = (stop.scale_device_id or "") + f" [skip:{reason[:80]}]"
    await db.flush()
    return await _stop_out(db, stop)
