from __future__ import annotations

from logging import Logger
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.timezone import parse_ist_date, today_ist
from app.models.domain import (
    Farm,
    FarmLoad,
    Item,
    Vehicle,
)
from app.models.enums import (
    FarmLoadStatus,
)
from app.schemas import (
    FarmCreate,
    FarmLoadCreate,
    FarmLoadOut,
    FarmLoadUpdate,
    FarmOut,
    FarmUpdate,
    VehicleCreate,
    VehicleOut,
    VehicleUpdate,
)
from app.services.wholesale.common import q_kg


async def create_farm(db: AsyncSession, payload: FarmCreate) -> FarmOut:
    farm = Farm(
        name=payload.name.strip(),
        owner_name=payload.owner_name,
        location=payload.location,
        address=payload.address,
        contact_phone=payload.contact_phone,
        capacity=payload.capacity,
    )
    db.add(farm)
    await db.flush()
    return FarmOut.model_validate(farm, from_attributes=True)


async def list_farms(db: AsyncSession, limit: int = 100, offset: int = 0) -> list[FarmOut]:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    rows: list[Farm] = list(await db.scalars(select(Farm).order_by(Farm.name).offset(offset).limit(limit)))
    return [FarmOut.model_validate(r, from_attributes=True) for r in rows]


async def get_farm(db: AsyncSession, farm_id: UUID) -> FarmOut:
    farm: Farm | None = await db.scalar(select(Farm).where(Farm.id == farm_id))
    if farm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")
    return FarmOut.model_validate(farm, from_attributes=True)


async def update_farm(db: AsyncSession, farm_id: UUID, payload: FarmUpdate) -> FarmOut:
    farm: Farm | None = await db.scalar(select(Farm).where(Farm.id == farm_id))
    if farm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(farm, key, value)
    await db.flush()
    return FarmOut.model_validate(farm, from_attributes=True)


async def deactivate_farm(db: AsyncSession, farm_id: UUID) -> None:
    farm: Farm | None = await db.scalar(select(Farm).where(Farm.id == farm_id))
    if farm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")
    farm.is_active = False
    await db.flush()


async def create_vehicle(db: AsyncSession, payload: VehicleCreate) -> VehicleOut:
    vehicle = Vehicle(
        name=payload.name,
        number=payload.number.strip().upper(),
        driver_name=payload.driver_name,
        driver_id=payload.driver_id,
    )
    db.add(vehicle)
    await db.flush()
    return VehicleOut.model_validate(vehicle, from_attributes=True)


async def list_vehicles(db: AsyncSession, limit: int = 100, offset: int = 0) -> list[VehicleOut]:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    rows: list[Vehicle] = list(await db.scalars(select(Vehicle).order_by(Vehicle.number).offset(offset).limit(limit)))
    return [VehicleOut.model_validate(r, from_attributes=True) for r in rows]


async def update_vehicle(db: AsyncSession, vehicle_id: UUID, payload: VehicleUpdate) -> VehicleOut:
    vehicle: Vehicle | None = await db.scalar(select(Vehicle).where(Vehicle.id == vehicle_id))
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    data: dict[str, Any] = payload.model_dump(exclude_unset=True)
    if "number" in data and data["number"]:
        data["number"] = data["number"].strip().upper()
    for key, value in data.items():
        setattr(vehicle, key, value)
    await db.flush()
    return VehicleOut.model_validate(vehicle, from_attributes=True)


async def deactivate_vehicle(db: AsyncSession, vehicle_id: UUID) -> None:
    vehicle: Vehicle | None = await db.scalar(select(Vehicle).where(Vehicle.id == vehicle_id))
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    vehicle.is_active = False
    await db.flush()


async def create_farm_load(db: AsyncSession, payload: FarmLoadCreate) -> FarmLoadOut:
    import logging

    logger: Logger = logging.getLogger("app.farms")

    vehicle_number: str | None = payload.vehicle_number
    driver_name: str | None = payload.driver_name
    if payload.vehicle_id:
        vehicle: Vehicle | None = await db.scalar(select(Vehicle).where(Vehicle.id == payload.vehicle_id))
        if vehicle is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
        vehicle_number = vehicle_number or vehicle.number
        driver_name = driver_name or vehicle.driver_name

    # Resolve item_id: if not provided, use first active item; if none exists, create fallback
    item_id: UUID | None = payload.item_id
    if item_id is None:
        from app.models.domain import Item

        first: Item | None = await db.scalar(
            select(Item).where(Item.is_active.is_(True)).order_by(Item.name).limit(1)
        )
        if first is None:
            fallback = Item(name="Default Bird", default_price=100, uom="KG")
            db.add(fallback)
            await db.flush()
            logger.warning("create_farm_load: no items exist, created fallback item %s", fallback.id)
            item_id = fallback.id
        else:
            logger.warning(
                "create_farm_load: item_id not provided, using fallback item %s (%s)", first.id, first.name
            )
            item_id = first.id
    else:
        from app.models.domain import Item

        item: Item | None = await db.scalar(select(Item).where(Item.id == item_id))
        if item is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
        if not item.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Item is inactive")
    load = FarmLoad(
        load_date=payload.load_date or today_ist(),
        farm_id=payload.farm_id,
        item_id=item_id,
        vehicle_id=payload.vehicle_id,
        vehicle_number=vehicle_number,
        driver_name=driver_name,
        driver_user_id=payload.driver_user_id,
        planned_kg=q_kg(payload.planned_kg or payload.loaded_weight_kg),
        loaded_weight_kg=q_kg(payload.loaded_weight_kg),
        bird_count=payload.bird_count,
        total_boxes=payload.total_boxes,
        rate_per_kg=payload.rate_per_kg,
        total_amount=payload.total_amount,
        paid_amount=payload.paid_amount,
        payment_method=payload.payment_method,
        remarks=payload.remarks,
        status=FarmLoadStatus.OPEN,
    )
    db.add(load)
    await db.flush()
    return FarmLoadOut.model_validate(load, from_attributes=True)


async def list_farm_loads(
    db: AsyncSession, limit: int = 50, offset: int = 0
) -> list[FarmLoadOut]:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    rows: list[FarmLoad] = list(
        await db.scalars(
            select(FarmLoad)
            .order_by(FarmLoad.load_date.desc(), FarmLoad.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
    )
    return [FarmLoadOut.model_validate(r, from_attributes=True) for r in rows]


async def get_farm_load(db: AsyncSession, load_id: UUID) -> FarmLoadOut:
    load: FarmLoad | None = await db.scalar(select(FarmLoad).where(FarmLoad.id == load_id))
    if load is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm load not found")
    return FarmLoadOut.model_validate(load, from_attributes=True)


async def update_farm_load(db: AsyncSession, load_id: UUID, payload: FarmLoadUpdate) -> FarmLoadOut:
    load: FarmLoad | None = await db.scalar(select(FarmLoad).where(FarmLoad.id == load_id))
    if load is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm load not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        if key == "loaded_weight_kg" and value is not None:
            setattr(load, key, q_kg(value))
        elif key == "load_date":
            if value is not None:
                setattr(load, key, parse_ist_date(value))  # PlainSerializer converts date→str; re-parse
        else:
            setattr(load, key, value)
    await db.flush()
    return FarmLoadOut.model_validate(load, from_attributes=True)


async def delete_farm_load(db: AsyncSession, load_id: UUID) -> None:
    load: FarmLoad | None = await db.scalar(select(FarmLoad).where(FarmLoad.id == load_id))
    if load is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm load not found")
    await db.delete(load)
    await db.flush()
