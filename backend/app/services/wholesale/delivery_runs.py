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
    return out


async def create_delivery_run(db: AsyncSession, payload: DeliveryRunCreate) -> DeliveryRunOut:
    load = None
    if payload.farm_load_id:
        load = await db.scalar(select(FarmLoad).where(FarmLoad.id == payload.farm_load_id))
        if load is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm load not found")
    if not payload.order_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="order_ids required")

    run = DeliveryRun(
        farm_load_id=load.id if load else None,
        run_date=payload.run_date or today_ist(),
        status=DeliveryRunStatus.PLANNED,
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

    if load:
        load.status = FarmLoadStatus.IN_TRANSIT
    await db.flush()
    return await get_delivery_run(db, run.id)


async def get_delivery_run(db: AsyncSession, run_id: UUID) -> DeliveryRunOut:
    run = await db.scalar(select(DeliveryRun).where(DeliveryRun.id == run_id))
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery run not found")

    stops_res = await db.execute(
        select(DeliveryStop, Retailer.name, Retailer.shop_name)
        .options(selectinload(DeliveryStop.items))
        .join(Retailer, Retailer.id == DeliveryStop.retailer_id)
        .where(DeliveryStop.delivery_run_id == run.id)
        .order_by(DeliveryStop.sequence.asc())
    )

    out = DeliveryRunOut.model_validate(run, from_attributes=True)
    stops_out = []
    for stop, r_name, r_shop in stops_res:
        s_out = DeliveryStopOut.model_validate(stop, from_attributes=True)
        s_out.retailer_name = r_name
        s_out.shop_name = r_shop
        stops_out.append(s_out)

    out.stops = stops_out
    return out


async def get_active_run(db: AsyncSession) -> DeliveryRunOut | None:
    run = await db.scalar(
        select(DeliveryRun)
        .where(DeliveryRun.status.in_([DeliveryRunStatus.PLANNED, DeliveryRunStatus.IN_PROGRESS]))
        .order_by(DeliveryRun.created_at.desc())
        .limit(1)
    )
    if run is None:
        return None
    return await get_delivery_run(db, run.id)


async def start_delivery_run(db: AsyncSession, run_id: UUID) -> DeliveryRunOut:
    run = await db.scalar(select(DeliveryRun).where(DeliveryRun.id == run_id))
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery run not found")
    run.status = DeliveryRunStatus.IN_PROGRESS
    run.started_at = now_ist()
    await db.flush()
    return await get_delivery_run(db, run.id)


async def skip_stop(db: AsyncSession, stop_id: UUID) -> DeliveryStopOut:
    stop = await db.scalar(
        select(DeliveryStop)
        .options(selectinload(DeliveryStop.items))
        .where(DeliveryStop.id == stop_id)
    )
    if stop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stop not found")
    if stop.status == DeliveryStopStatus.BILLED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Stop already billed")
    stop.status = DeliveryStopStatus.SKIPPED
    await db.flush()
    return await _stop_out(db, stop)
