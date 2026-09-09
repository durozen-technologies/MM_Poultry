from decimal import Decimal
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.domain import (
    DeliveryBill,
    DeliveryBillItem,
    Farm,
    FarmLoad,
    Item,
    RetailerDailyOrder,
)
from app.models.enums import FarmLoadStatus
from app.schemas.inventory import (
    InventoryFarmLoadOut,
    InventoryItemLoadsOut,
    InventorySummaryItem,
    InventorySummaryOut,
)


async def get_inventory_summary(db: AsyncSession) -> InventorySummaryOut:
    """
    Available KG = sum(loaded on OPEN|IN_TRANSIT loads) - sum(delivered on billed bills).
    """
    delivered_subq = (
        select(
            DeliveryBillItem.item_id,
            func.coalesce(func.sum(DeliveryBillItem.weight_kg), Decimal(0)).label("delivered_kg"),
        )
        .join(DeliveryBill, DeliveryBill.id == DeliveryBillItem.delivery_bill_id)
        .group_by(DeliveryBillItem.item_id)
        .subquery()
    )

    stmt = (
        select(
            Item.id,
            Item.name,
            func.coalesce(func.sum(FarmLoad.loaded_weight_kg), Decimal(0)).label("loaded_kg"),
            func.coalesce(delivered_subq.c.delivered_kg, Decimal(0)).label("delivered_kg"),
        )
        .select_from(Item)
        .outerjoin(
            FarmLoad,
            (FarmLoad.item_id == Item.id)
            & FarmLoad.status.in_([FarmLoadStatus.OPEN, FarmLoadStatus.IN_TRANSIT]),
        )
        .outerjoin(delivered_subq, delivered_subq.c.item_id == Item.id)
        .where(Item.is_active)
        .group_by(Item.id, Item.name, delivered_subq.c.delivered_kg)
    )

    result = await db.execute(stmt)
    rows = result.all()

    items: list[InventorySummaryItem] = []
    for row in rows:
        loaded = row.loaded_kg or Decimal(0)
        delivered = row.delivered_kg or Decimal(0)
        available = loaded - delivered
        if available > 0:
            items.append(
                InventorySummaryItem(
                    item_id=row.id,
                    item_name=row.name,
                    total_available_kg=available,
                )
            )

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

    farm_ids = {load.farm_id for load in loads if load.farm_id}
    farm_names: dict[UUID, str] = {}
    if farm_ids:
        farms = list(await db.scalars(select(Farm).where(Farm.id.in_(farm_ids))))
        farm_names = {f.id: f.name for f in farms}

    out_loads: list[InventoryFarmLoadOut] = []
    for load in loads:
        delivered = await db.scalar(
            select(func.coalesce(func.sum(DeliveryBillItem.weight_kg), 0))
            .join(DeliveryBill, DeliveryBill.id == DeliveryBillItem.delivery_bill_id)
            .join(RetailerDailyOrder, RetailerDailyOrder.id == DeliveryBill.retailer_daily_order_id)
            .where(DeliveryBillItem.item_id == load.item_id)
        )
        loaded = load.loaded_weight_kg or Decimal(0)
        deliv = Decimal(str(delivered or 0))
        available = loaded - deliv
        row = InventoryFarmLoadOut.model_validate(load, from_attributes=True)
        row.farm_name = farm_names.get(load.farm_id) if load.farm_id else None
        row.delivered_weight_kg = deliv
        row.available_weight_kg = available if available > 0 else Decimal(0)
        out_loads.append(row)

    return InventoryItemLoadsOut(
        item_id=item_id,
        loads=out_loads,
    )
