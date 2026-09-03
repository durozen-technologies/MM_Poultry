from decimal import Decimal
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.domain import (
    DeliveryRun,
    DeliveryRunFarmLoad,
    DeliveryStop,
    DeliveryStopItem,
    FarmLoad,
    Item,
)
from app.models.enums import DeliveryRunStatus, DeliveryStopStatus, FarmLoadStatus
from app.schemas.inventory import (
    InventoryFarmLoadOut,
    InventoryItemLoadsOut,
    InventorySummaryItem,
    InventorySummaryOut,
)

_ACTIVE_RUN = (DeliveryRunStatus.PLANNED, DeliveryRunStatus.IN_PROGRESS)


async def get_inventory_summary(db: AsyncSession) -> InventorySummaryOut:
    """
    Available KG = sum(actual loaded on OPEN|IN_TRANSIT loads)
                   - sum(allocated on active runs)
                   - sum(delivered on billed stops from those loads).
    """
    allocated_subq = (
        select(
            DeliveryRunFarmLoad.farm_load_id,
            func.coalesce(func.sum(DeliveryRunFarmLoad.allocated_kg), Decimal(0)).label("allocated_kg"),
        )
        .join(DeliveryRun, DeliveryRun.id == DeliveryRunFarmLoad.delivery_run_id)
        .where(DeliveryRun.status.in_(_ACTIVE_RUN))
        .group_by(DeliveryRunFarmLoad.farm_load_id)
        .subquery()
    )

    delivered_subq = (
        select(
            DeliveryRunFarmLoad.farm_load_id,
            func.coalesce(func.sum(DeliveryStopItem.delivered_weight_kg), Decimal(0)).label("delivered_kg"),
        )
        .join(DeliveryRun, DeliveryRun.id == DeliveryRunFarmLoad.delivery_run_id)
        .join(DeliveryStop, DeliveryStop.delivery_run_id == DeliveryRun.id)
        .join(DeliveryStopItem, DeliveryStopItem.delivery_stop_id == DeliveryStop.id)
        .where(DeliveryStop.status.in_([DeliveryStopStatus.BILLED, DeliveryStopStatus.WEIGHED]))
        .group_by(DeliveryRunFarmLoad.farm_load_id)
        .subquery()
    )

    stmt = (
        select(
            Item.id,
            Item.name,
            FarmLoad.loaded_weight_kg,
            func.coalesce(allocated_subq.c.allocated_kg, Decimal(0)).label("allocated_kg"),
            func.coalesce(delivered_subq.c.delivered_kg, Decimal(0)).label("delivered_kg"),
        )
        .select_from(Item)
        .outerjoin(
            FarmLoad,
            (FarmLoad.item_id == Item.id)
            & FarmLoad.status.in_([FarmLoadStatus.OPEN, FarmLoadStatus.IN_TRANSIT]),
        )
        .outerjoin(allocated_subq, allocated_subq.c.farm_load_id == FarmLoad.id)
        .outerjoin(delivered_subq, delivered_subq.c.farm_load_id == FarmLoad.id)
        .where(Item.is_active)
    )

    result = await db.execute(stmt)
    rows = result.all()

    item_totals: dict[UUID, dict] = {}
    for row in rows:
        item_id = row.id
        if item_id not in item_totals:
            item_totals[item_id] = {
                "item_id": item_id,
                "item_name": row.name,
                "total_available_kg": Decimal(0),
            }

        loaded = row.loaded_weight_kg or Decimal(0)
        allocated = row.allocated_kg or Decimal(0)
        delivered = row.delivered_kg or Decimal(0)
        available = loaded - allocated - delivered
        if available > 0:
            item_totals[item_id]["total_available_kg"] += available

    items = [InventorySummaryItem(**v) for v in item_totals.values()]
    items.sort(key=lambda x: x.item_name)

    return InventorySummaryOut(items=items)


async def get_inventory_item_loads(db: AsyncSession, item_id: UUID) -> InventoryItemLoadsOut:
    loads = list(
        await db.scalars(
            select(FarmLoad)
            .where(
                FarmLoad.item_id == item_id,
                FarmLoad.status.in_([FarmLoadStatus.OPEN, FarmLoadStatus.IN_TRANSIT]),
            )
            .order_by(FarmLoad.load_date.desc())
        )
    )

    out_loads: list[InventoryFarmLoadOut] = []
    for load in loads:
        allocated = await db.scalar(
            select(func.coalesce(func.sum(DeliveryRunFarmLoad.allocated_kg), 0))
            .join(DeliveryRun, DeliveryRun.id == DeliveryRunFarmLoad.delivery_run_id)
            .where(
                DeliveryRunFarmLoad.farm_load_id == load.id,
                DeliveryRun.status.in_(_ACTIVE_RUN),
            )
        )
        delivered = await db.scalar(
            select(func.coalesce(func.sum(DeliveryStopItem.delivered_weight_kg), 0))
            .join(DeliveryStop, DeliveryStop.id == DeliveryStopItem.delivery_stop_id)
            .join(DeliveryRun, DeliveryRun.id == DeliveryStop.delivery_run_id)
            .join(DeliveryRunFarmLoad, DeliveryRunFarmLoad.delivery_run_id == DeliveryRun.id)
            .where(DeliveryRunFarmLoad.farm_load_id == load.id)
        )
        loaded = load.loaded_weight_kg or Decimal(0)
        alloc = Decimal(str(allocated or 0))
        deliv = Decimal(str(delivered or 0))
        available = loaded - alloc - deliv
        row = InventoryFarmLoadOut.model_validate(load, from_attributes=True)
        row.delivered_weight_kg = deliv
        row.available_weight_kg = available if available > 0 else Decimal(0)
        out_loads.append(row)

    return InventoryItemLoadsOut(
        item_id=item_id,
        loads=out_loads,
    )
