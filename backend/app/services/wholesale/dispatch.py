from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.timezone import now_ist
from app.models.domain import (
    DeliveryRun,
    DeliveryStop,
    DeliveryStopItem,
    Retailer,
    RetailerDailyOrder,
    RetailerDailyOrderItem,
    Route,
)
from app.models.enums import DeliveryRunStatus, DeliveryStopStatus, OrderStatus
from app.schemas.dispatch import (
    DispatchItemSummary,
    DispatchOrderItemLine,
    DispatchOrderLine,
    DispatchRouteBucket,
    DispatchRunSummary,
    DispatchTodayOut,
)
from app.services.wholesale.common import ZERO, q_kg
from app.services.wholesale.inventory import get_inventory_summary

_ACTIVE_RUN = {DeliveryRunStatus.PLANNED, DeliveryRunStatus.IN_PROGRESS}
_TERMINAL_RUN = {DeliveryRunStatus.COMPLETED, DeliveryRunStatus.CANCELLED}



def _derive_route_status(
    remaining_unassigned: Decimal,
    assigned_kg: Decimal,
    runs: list[DeliveryRun],
) -> str:
    has_in_progress: bool = any(r.status == DeliveryRunStatus.IN_PROGRESS for r in runs)
    all_terminal: list[DeliveryRun] | bool = runs and all(r.status in _TERMINAL_RUN for r in runs)
    if remaining_unassigned > ZERO and assigned_kg <= ZERO:
        return "pending"
    if remaining_unassigned > ZERO and assigned_kg > ZERO:
        return "partial_assigned"
    if assigned_kg > ZERO and has_in_progress:
        return "in_progress"
    if remaining_unassigned <= ZERO and (not runs or all_terminal):
        return "completed"
    return "assigned"


def _order_item_lines(order: RetailerDailyOrder) -> list[DispatchOrderItemLine]:
    lines: list[DispatchOrderItemLine] = []
    for line in order.items:
        item_name: str | None = line.item.name if line.item else None
        lines.append(
            DispatchOrderItemLine(
                item_id=line.item_id,
                item_name=item_name,
                total_boxes=line.total_boxes,
                requested_kg=q_kg(line.requested_kg) if line.requested_kg is not None else None,
            )
        )
    return lines


def _aggregate_order_items(orders: list[RetailerDailyOrder]) -> list[DispatchItemSummary]:
    totals: dict[UUID, dict[str, int | Decimal | str | None]] = {}
    for order in orders:
        for line in order.items:
            entry: dict[str, int | Decimal | str | None] | None = totals.get(line.item_id)
            if entry is None:
                entry = {
                    "item_name": line.item.name if line.item else None,
                    "total_boxes": 0,
                    "total_kg": ZERO,
                }
                totals[line.item_id] = entry
            if line.total_boxes:
                entry["total_boxes"] = int(entry["total_boxes"] or 0) + line.total_boxes
            entry["total_kg"] = q_kg(Decimal(str(entry["total_kg"])) + q_kg(line.requested_kg or ZERO))

    return [
        DispatchItemSummary(
            item_id=item_id,
            item_name=str(entry["item_name"]) if entry["item_name"] else None,
            total_boxes=int(entry["total_boxes"] or 0),
            total_kg=q_kg(Decimal(str(entry["total_kg"]))),
        )
        for item_id, entry in sorted(
            totals.items(),
            key=lambda pair: (str(pair[1]["item_name"] or ""), str(pair[0])),
        )
    ]


def order_kg(order: RetailerDailyOrder) -> Decimal:
    return q_kg(sum(((i.requested_kg or ZERO) for i in order.items), start=ZERO))


async def get_dispatch_today(db: AsyncSession) -> DispatchTodayOut:
    day: date = now_ist().date()

    routes: list[Route] = list((await db.scalars(select(Route).where(Route.is_active.is_(True)).order_by(Route.sort_order, Route.name))).all())

    orders: list[RetailerDailyOrder] = list((await db.scalars(
            select(RetailerDailyOrder)
            .options(
                selectinload(RetailerDailyOrder.items).selectinload(RetailerDailyOrderItem.item)
            )
            .where(
                RetailerDailyOrder.order_date == day,
                RetailerDailyOrder.status == OrderStatus.ACKNOWLEDGED,
            )
        )).all())

    active_order_ids: set[UUID] = {
        x for x in (await db.scalars(
            select(DeliveryStop.daily_order_id)
            .join(DeliveryRun, DeliveryRun.id == DeliveryStop.delivery_run_id)
            .where(
                DeliveryStop.daily_order_id.isnot(None),
                DeliveryRun.status.in_(_ACTIVE_RUN),
            )
        )).all()
        if x is not None
    }

    runs_today: list[DeliveryRun] = list((await db.scalars(
            select(DeliveryRun).where(DeliveryRun.run_date == day).order_by(DeliveryRun.created_at)
        )).all())

    retailer_map: dict[UUID, Retailer] = {}
    retailer_ids: set[UUID] = {o.retailer_id for o in orders}
    
    run_ids = [r.id for r in runs_today]
    assigned_kg_by_run: dict[UUID, Decimal] = {}
    delivered_kg_by_run: dict[UUID, Decimal] = {}
    
    if run_ids:
        all_stop_retailers = (await db.scalars(
            select(DeliveryStop.retailer_id)
            .where(DeliveryStop.delivery_run_id.in_(run_ids))
        )).all()
        retailer_ids.update(all_stop_retailers)
        
        active_run_ids = [r.id for r in runs_today if r.status in _ACTIVE_RUN]
        if active_run_ids:
            assigned_rows = await db.execute(
                select(
                    DeliveryStop.delivery_run_id,
                    func.sum(DeliveryStopItem.ordered_kg)
                )
                .join(DeliveryStopItem, DeliveryStop.id == DeliveryStopItem.delivery_stop_id)
                .where(DeliveryStop.delivery_run_id.in_(active_run_ids))
                .group_by(DeliveryStop.delivery_run_id)
            )
            for run_id, total in assigned_rows:
                assigned_kg_by_run[run_id] = q_kg(total)
                
        delivered_rows = await db.execute(
            select(
                DeliveryStop.delivery_run_id,
                func.sum(DeliveryStopItem.delivered_weight_kg)
            )
            .join(DeliveryStopItem, DeliveryStop.id == DeliveryStopItem.delivery_stop_id)
            .where(
                DeliveryStop.delivery_run_id.in_(run_ids),
                DeliveryStop.status == DeliveryStopStatus.BILLED,
                DeliveryStopItem.delivered_weight_kg.isnot(None),
            )
            .group_by(DeliveryStop.delivery_run_id)
        )
        for run_id, total in delivered_rows:
            delivered_kg_by_run[run_id] = q_kg(total)

    if retailer_ids:
        rows = (await db.scalars(select(Retailer).where(Retailer.id.in_(retailer_ids)))).all()
        for r in rows:
            retailer_map[r.id] = r

    buckets: list[DispatchRouteBucket] = []
    total_confirmed: Decimal = ZERO
    total_remaining: Decimal = ZERO
    all_route_orders: list[RetailerDailyOrder] = []
    all_eligible_orders: list[RetailerDailyOrder] = []

    route_ids_ordered: list[UUID | None] = [r.id for r in routes]
    route_ids_ordered.append(None)  # Unassigned last

    route_name_map: dict[UUID | None, str] = {r.id: r.name for r in routes}
    route_name_map[None] = "Unassigned"

    for route_id in route_ids_ordered:
        route_retailer_ids: set[UUID] = {
            rid
            for rid, ret in retailer_map.items()
            if ret.route_id == route_id
        }
        route_orders: list[RetailerDailyOrder] = [o for o in orders if o.retailer_id in route_retailer_ids]
        route_runs: list[DeliveryRun] = [r for r in runs_today if r.route_id == route_id]

        confirmed_kg: Decimal = q_kg(sum((order_kg(o) for o in route_orders), start=ZERO))
        total_confirmed += confirmed_kg
        all_route_orders.extend(route_orders)

        eligible: list[RetailerDailyOrder] = [o for o in route_orders if o.id not in active_order_ids]
        remaining_unassigned: Decimal = q_kg(sum((order_kg(o) for o in eligible), start=ZERO))
        total_remaining += remaining_unassigned
        all_eligible_orders.extend(eligible)

        assigned_kg: Decimal = ZERO
        delivered_kg: Decimal = ZERO
        for run in route_runs:
            if run.status in _ACTIVE_RUN:
                assigned_kg += assigned_kg_by_run.get(run.id, ZERO)
            delivered_kg += delivered_kg_by_run.get(run.id, ZERO)

        assigned_kg = q_kg(assigned_kg)
        delivered_kg = q_kg(delivered_kg)

        order_lines = []
        for o in eligible:
            ret: Retailer | None = retailer_map.get(o.retailer_id)
            order_lines.append(
                DispatchOrderLine(
                    order_id=o.id,
                    retailer_id=o.retailer_id,
                    shop_name=ret.shop_name if ret else None,
                    requested_kg=order_kg(o),
                    dispatch_status="eligible",
                    items=_order_item_lines(o),
                )
            )

        run_summaries: list[DispatchRunSummary] = [
            DispatchRunSummary(
                id=r.id,
                status=r.status.value,
                driver_name=r.driver_name,
                planned_kg=r.planned_kg,
                actual_loaded_kg=r.actual_loaded_kg,
            )
            for r in route_runs
        ]

        buckets.append(
            DispatchRouteBucket(
                route_id=route_id,
                route_name=route_name_map[route_id],
                confirmed_kg=confirmed_kg,
                assigned_kg=assigned_kg,
                delivered_kg=delivered_kg,
                remaining_unassigned_kg=remaining_unassigned,
                order_count=len(route_orders),
                route_status=_derive_route_status(remaining_unassigned, assigned_kg, route_runs),
                confirmed_items=_aggregate_order_items(route_orders),
                unassigned_items=_aggregate_order_items(eligible),
                runs=run_summaries,
                orders=order_lines,
            )
        )

    inventory = await get_inventory_summary(db)
    available: Decimal = q_kg(sum((i.total_available_kg for i in inventory.items), start=ZERO))
    available_items: list[DispatchItemSummary] = [
        DispatchItemSummary(
            item_id=row.item_id,
            item_name=row.item_name,
            total_boxes=0,
            total_kg=q_kg(row.total_available_kg),
        )
        for row in inventory.items
        if row.total_available_kg > ZERO
    ]

    return DispatchTodayOut(
        available_stock_kg=available,
        total_confirmed_kg=total_confirmed,
        total_remaining_unassigned_kg=total_remaining,
        confirmed_items=_aggregate_order_items(all_route_orders),
        unassigned_items=_aggregate_order_items(all_eligible_orders),
        available_items=available_items,
        routes=buckets,
    )
