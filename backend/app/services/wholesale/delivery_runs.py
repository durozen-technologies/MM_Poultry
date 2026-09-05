from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.timezone import now_ist, today_ist
from app.models.domain import (
    DeliveryRun,
    DeliveryRunFarmLoad,
    DeliveryStop,
    DeliveryStopItem,
    FarmLoad,
    Retailer,
    RetailerDailyOrder,
    RetailerDailyOrderItem,
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
    FarmLoadAllocation,
)
from app.services.wholesale.common import q_kg
from app.services.wholesale.rates import resolve_rate
from app.services.wholesale.retailers import get_retailer
from app.services.wholesale.stock_audit import log_quantity_change

_ACTIVE_RUN_STATUSES = (DeliveryRunStatus.PLANNED, DeliveryRunStatus.IN_PROGRESS)
_ZERO = Decimal("0")


async def _stop_out(db: AsyncSession, stop: DeliveryStop) -> DeliveryStopOut:
    retailer = await get_retailer(db, stop.retailer_id)
    out = DeliveryStopOut.model_validate(stop, from_attributes=True)
    out.retailer_name = retailer.name
    out.shop_name = retailer.shop_name
    out.route_name = retailer.route_name
    
    if stop.daily_order_id:
        order_items = await db.scalars(
            select(RetailerDailyOrderItem)
            .where(RetailerDailyOrderItem.order_id == stop.daily_order_id)
        )
        oi_map = {oi.item_id: oi for oi in order_items}
        for item_out in out.items:
            oi = oi_map.get(item_out.item_id)
            if oi:
                item_out.original_requested_kg = oi.requested_kg
                item_out.original_total_boxes = oi.total_boxes

    return out


async def _active_allocated_kg(db: AsyncSession, farm_load_id: UUID) -> Decimal:
    val = await db.scalar(
        select(func.coalesce(func.sum(DeliveryRunFarmLoad.allocated_kg), 0))
        .join(DeliveryRun, DeliveryRun.id == DeliveryRunFarmLoad.delivery_run_id)
        .where(
            DeliveryRunFarmLoad.farm_load_id == farm_load_id,
            DeliveryRun.status.in_(_ACTIVE_RUN_STATUSES),
        )
    )
    return q_kg(Decimal(str(val or 0)))


async def _recalculate_farm_load_status(db: AsyncSession, farm_load_id: UUID) -> None:
    load = await db.scalar(select(FarmLoad).where(FarmLoad.id == farm_load_id).with_for_update())
    if load is None or load.status == FarmLoadStatus.CLOSED:
        return
    active_refs = await db.scalar(
        select(func.count())
        .select_from(DeliveryRunFarmLoad)
        .join(DeliveryRun, DeliveryRun.id == DeliveryRunFarmLoad.delivery_run_id)
        .where(
            DeliveryRunFarmLoad.farm_load_id == farm_load_id,
            DeliveryRun.status.in_(_ACTIVE_RUN_STATUSES),
        )
    )
    if active_refs and active_refs > 0:
        load.status = FarmLoadStatus.IN_TRANSIT
    else:
        load.status = FarmLoadStatus.OPEN


def _resolve_allocations(
    payload: DeliveryRunCreate, total_ordered_kg: Decimal
) -> list[FarmLoadAllocation]:
    if payload.farm_load_allocations:
        return payload.farm_load_allocations
    if payload.farm_load_id:
        return [FarmLoadAllocation(farm_load_id=payload.farm_load_id, allocated_kg=total_ordered_kg)]
    return []


async def create_delivery_run(
    db: AsyncSession,
    payload: DeliveryRunCreate,
    *,
    actor_user_id: UUID | None = None,
) -> DeliveryRunOut:
    if not payload.order_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="order_ids required")
    if len(payload.order_ids) != len(set(payload.order_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Duplicate order_ids not allowed"
        )

    # Fetch and validate orders first
    orders: list[RetailerDailyOrder] = []
    for order_id in payload.order_ids:
        order = await db.scalar(
            select(RetailerDailyOrder)
            .options(selectinload(RetailerDailyOrder.items))
            .where(RetailerDailyOrder.id == order_id)
        )
        if order is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        if order.status != OrderStatus.ACKNOWLEDGED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Order {order_id} is {order.status.value} — only ACKNOWLEDGED orders can be dispatched",
            )
        orders.append(order)

    # Block double active dispatch
    active_dup = await db.scalar(
        select(func.count())
        .select_from(DeliveryStop)
        .join(DeliveryRun, DeliveryRun.id == DeliveryStop.delivery_run_id)
        .where(
            DeliveryStop.daily_order_id.in_(payload.order_ids),
            DeliveryRun.status.in_(_ACTIVE_RUN_STATUSES),
        )
    )
    if active_dup and active_dup > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="One or more orders already on an active delivery run",
        )

    adj_map = {}
    if payload.order_adjustments:
        for adj in payload.order_adjustments:
            adj_map[(adj.order_id, adj.item_id)] = adj.requested_kg

    total_ordered_kg = _ZERO
    for ord in orders:
        for itm in ord.items:
            req_kg = adj_map.get((ord.id, itm.item_id), itm.requested_kg or _ZERO)
            total_ordered_kg += q_kg(req_kg)
    allocations = _resolve_allocations(payload, total_ordered_kg)
    total_allocated = q_kg(sum(a.allocated_kg for a in allocations))

    if allocations and total_allocated < total_ordered_kg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Allocated {total_allocated}kg is less than ordered {total_ordered_kg}kg",
        )

    loads: list[FarmLoad] = []
    for alloc in allocations:
        load = await db.scalar(select(FarmLoad).where(FarmLoad.id == alloc.farm_load_id))
        if load is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm load not found")
        if load.status not in (FarmLoadStatus.OPEN, FarmLoadStatus.IN_TRANSIT):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Farm load not available (status={load.status.value})",
            )
        already = await _active_allocated_kg(db, load.id)
        if q_kg(already + alloc.allocated_kg) > q_kg(load.loaded_weight_kg):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Allocation {alloc.allocated_kg}kg exceeds available pool on load "
                    f"({load.loaded_weight_kg - already}kg free of {load.loaded_weight_kg}kg)"
                ),
            )
        loads.append(load)

    vehicle: Vehicle | None = None
    if payload.vehicle_id:
        vehicle = await db.scalar(select(Vehicle).where(Vehicle.id == payload.vehicle_id))
    elif loads and loads[0].vehicle_id:
        vehicle = await db.scalar(select(Vehicle).where(Vehicle.id == loads[0].vehicle_id))
    if vehicle and vehicle.capacity_kg is not None:
        cap = q_kg(vehicle.capacity_kg)
        if total_ordered_kg > cap:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Total ordered {total_ordered_kg}kg exceeds vehicle capacity {cap}kg",
            )

    async with db.begin_nested():
        primary_load_id = allocations[0].farm_load_id if allocations else None
        run = DeliveryRun(
            farm_load_id=primary_load_id,
            route_id=payload.route_id,
            run_date=payload.run_date or today_ist(),
            status=DeliveryRunStatus.PLANNED,
            driver_user_id=payload.driver_user_id,
            driver_name=payload.driver_name,
            vehicle_id=payload.vehicle_id,
            vehicle_number=payload.vehicle_number,
            planned_kg=total_ordered_kg,
            actual_loaded_kg=total_allocated if allocations else None,
        )
        db.add(run)
        await db.flush()

        for alloc in allocations:
            link = DeliveryRunFarmLoad(
                delivery_run_id=run.id,
                farm_load_id=alloc.farm_load_id,
                allocated_kg=q_kg(alloc.allocated_kg),
            )
            db.add(link)
            await log_quantity_change(
                db,
                entity_type="delivery_run_farm_load",
                entity_id=run.id,
                field="allocated_kg",
                old_value=None,
                new_value=alloc.allocated_kg,
                reason="dispatch allocation",
                actor_user_id=actor_user_id,
                ref_type="farm_load",
                ref_id=alloc.farm_load_id,
            )

        for idx, order in enumerate(orders, start=1):
            order.status = OrderStatus.DISPATCHED
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
                req_kg = adj_map.get((order.id, item.item_id), item.requested_kg or _ZERO)
                ordered = q_kg(req_kg)
                stop_item = DeliveryStopItem(
                    delivery_stop_id=stop.id,
                    item_id=item.item_id,
                    ordered_kg=ordered,
                    remaining_kg=ordered,
                    rate_per_kg=rate,
                )
                db.add(stop_item)

        for load in loads:
            load.status = FarmLoadStatus.IN_TRANSIT
        await db.flush()
    return await get_delivery_run(db, run.id)


async def get_delivery_run(db: AsyncSession, run_id: UUID) -> DeliveryRunOut:
    run = await db.scalar(
        select(DeliveryRun)
        .options(selectinload(DeliveryRun.farm_load_links))
        .where(DeliveryRun.id == run_id)
    )
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


async def get_active_run(
    db: AsyncSession, driver_user_id: UUID | None = None
) -> DeliveryRunOut | None:
    stmt = (
        select(DeliveryRun)
        .where(DeliveryRun.status.in_(_ACTIVE_RUN_STATUSES))
        .order_by(DeliveryRun.created_at.desc())
        .limit(1)
    )
    if driver_user_id is not None:
        stmt = stmt.where(DeliveryRun.driver_user_id == driver_user_id)
    run = await db.scalar(stmt)
    if run is None:
        return None
    return await get_delivery_run(db, run.id)


async def list_delivery_runs(
    db: AsyncSession, limit: int = 20, offset: int = 0
) -> list[DeliveryRunOut]:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    runs = list(
        await db.scalars(
            select(DeliveryRun).order_by(DeliveryRun.created_at.desc()).offset(offset).limit(limit)
        )
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
    if run.status == DeliveryRunStatus.CANCELLED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Run is cancelled")
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
    if reason:
        stop.failure_reason = reason[:500]
    await db.flush()
    return await _stop_out(db, stop)


async def fail_stop(
    db: AsyncSession,
    stop_id: UUID,
    failure_reason: str,
    *,
    actor_user_id: UUID | None = None,
) -> DeliveryStopOut:
    stop = await db.scalar(
        select(DeliveryStop)
        .options(selectinload(DeliveryStop.items))
        .where(DeliveryStop.id == stop_id)
    )
    if stop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stop not found")
    if stop.status in {DeliveryStopStatus.BILLED, DeliveryStopStatus.FAILED}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Stop already terminal")
    stop.status = DeliveryStopStatus.FAILED
    stop.failure_reason = failure_reason[:500]
    await log_quantity_change(
        db,
        entity_type="delivery_stop",
        entity_id=stop.id,
        field="status",
        old_value=None,
        new_value=None,
        reason=failure_reason,
        actor_user_id=actor_user_id,
        ref_type="delivery_run",
        ref_id=stop.delivery_run_id,
    )
    await db.flush()
    return await _stop_out(db, stop)


async def cancel_delivery_run(
    db: AsyncSession,
    run_id: UUID,
    reason: str | None = None,
    *,
    actor_user_id: UUID | None = None,
) -> DeliveryRunOut:
    run = await db.scalar(
        select(DeliveryRun)
        .options(selectinload(DeliveryRun.farm_load_links))
        .where(DeliveryRun.id == run_id)
        .with_for_update()
    )
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery run not found")
    if run.status not in _ACTIVE_RUN_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel run in status {run.status.value}",
        )
    if run.reconciled_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot cancel after reconciliation submitted",
        )

    load_ids = [link.farm_load_id for link in run.farm_load_links]
    for link in run.farm_load_links:
        await log_quantity_change(
            db,
            entity_type="delivery_run_farm_load",
            entity_id=run.id,
            field="allocated_kg",
            old_value=link.allocated_kg,
            new_value=_ZERO,
            reason=reason or "run cancelled",
            actor_user_id=actor_user_id,
            ref_type="farm_load",
            ref_id=link.farm_load_id,
        )

    await db.execute(
        delete(DeliveryRunFarmLoad).where(DeliveryRunFarmLoad.delivery_run_id == run.id)
    )
    
    # Revert all orders to ACKNOWLEDGED
    stops = await db.scalars(select(DeliveryStop).where(DeliveryStop.delivery_run_id == run.id))
    for stop in stops:
        if stop.daily_order_id:
            await db.execute(
                update(RetailerDailyOrder)
                .where(RetailerDailyOrder.id == stop.daily_order_id)
                .values(status=OrderStatus.ACKNOWLEDGED)
            )

    run.status = DeliveryRunStatus.CANCELLED
    run.completed_at = now_ist()
    await db.flush()

    for load_id in load_ids:
        await _recalculate_farm_load_status(db, load_id)

    return await get_delivery_run(db, run.id)
