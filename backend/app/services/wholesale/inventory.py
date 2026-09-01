from decimal import Decimal
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.domain import DeliveryRun, DeliveryStop, DeliveryStopItem, Farm, FarmLoad, Item
from app.models.enums import FarmLoadStatus
from app.schemas.inventory import (
    InventoryFarmLoadOut,
    InventoryItemLoadsOut,
    InventorySummaryItem,
    InventorySummaryOut,
)


async def get_inventory_summary(db: AsyncSession) -> InventorySummaryOut:
    """
    Get the total available KG for each item.
    Available KG = FarmLoad.loaded_weight_kg - sum(DeliveryStop.delivered_weight_kg)
    Only considers active FarmLoads (OPEN or IN_TRANSIT).
    """
    delivered_subq = (
        select(
            DeliveryRun.farm_load_id,
            func.coalesce(func.sum(DeliveryStopItem.delivered_weight_kg), Decimal(0)).label("delivered_kg"),
        )
        .join(DeliveryStop, DeliveryStop.delivery_run_id == DeliveryRun.id)
        .join(DeliveryStopItem, DeliveryStopItem.delivery_stop_id == DeliveryStop.id)
        .group_by(DeliveryRun.farm_load_id)
        .subquery()
    )

    stmt = (
        select(
            Item.id,
            Item.name,
            FarmLoad.loaded_weight_kg,
            func.coalesce(delivered_subq.c.delivered_kg, Decimal(0)).label("delivered_kg"),
        )
        .select_from(Item)
        .outerjoin(
            FarmLoad, 
            (FarmLoad.item_id == Item.id) & FarmLoad.status.in_([FarmLoadStatus.OPEN, FarmLoadStatus.IN_TRANSIT])
        )
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
        delivered = row.delivered_kg or Decimal(0)
        available = loaded - delivered
        if available > 0:
            item_totals[item_id]["total_available_kg"] += available

    items = [
        InventorySummaryItem(**v) for v in item_totals.values()
    ]
    
    # Sort by item name
    items.sort(key=lambda x: x.item_name)

    return InventorySummaryOut(items=items)


async def get_inventory_item_loads(db: AsyncSession, item_id: UUID) -> InventoryItemLoadsOut:
    """
    Get the active farm loads that make up the inventory for a specific item.
    """
    delivered_subq = (
        select(
            DeliveryRun.farm_load_id,
            func.coalesce(func.sum(DeliveryStopItem.delivered_weight_kg), Decimal(0)).label("delivered_kg"),
        )
        .join(DeliveryStop, DeliveryStop.delivery_run_id == DeliveryRun.id)
        .join(DeliveryStopItem, DeliveryStopItem.delivery_stop_id == DeliveryStop.id)
        .group_by(DeliveryRun.farm_load_id)
        .subquery()
    )

    stmt = (
        select(
            FarmLoad,
            Item.name.label("item_name"),
            Farm.name.label("farm_name"),
            Farm.contact_phone.label("contact_phone"),
            func.coalesce(delivered_subq.c.delivered_kg, Decimal(0)).label("delivered_kg"),
        )
        .join(Item, Item.id == FarmLoad.item_id)
        .outerjoin(Farm, Farm.id == FarmLoad.farm_id)
        .outerjoin(delivered_subq, delivered_subq.c.farm_load_id == FarmLoad.id)
        .where(FarmLoad.item_id == item_id)
        .where(FarmLoad.status.in_([FarmLoadStatus.OPEN, FarmLoadStatus.IN_TRANSIT]))
        .order_by(FarmLoad.load_date.desc(), FarmLoad.created_at.desc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    loads = []
    for row in rows:
        load = row.FarmLoad
        delivered_kg = row.delivered_kg or Decimal(0)
        available_kg = load.loaded_weight_kg - delivered_kg

        if available_kg > 0:
            load_out = InventoryFarmLoadOut.model_validate(load)
            load_out.farm_name = row.farm_name
            load_out.contact_phone = row.contact_phone
            load_out.delivered_weight_kg = delivered_kg
            load_out.available_weight_kg = available_kg
            loads.append(load_out)

    return InventoryItemLoadsOut(item_id=item_id, loads=loads)

