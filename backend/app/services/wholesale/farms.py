from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.timezone import today_ist
from app.models.domain import (
    Farm,
    FarmLoad,
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


async def list_farms(db: AsyncSession) -> list[FarmOut]:
    rows = list(await db.scalars(select(Farm).order_by(Farm.name)))
    return [FarmOut.model_validate(r, from_attributes=True) for r in rows]


async def get_farm(db: AsyncSession, farm_id: UUID) -> FarmOut:
    farm = await db.scalar(select(Farm).where(Farm.id == farm_id))
    if farm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")
    return FarmOut.model_validate(farm, from_attributes=True)


async def update_farm(db: AsyncSession, farm_id: UUID, payload: FarmUpdate) -> FarmOut:
    farm = await db.scalar(select(Farm).where(Farm.id == farm_id))
    if farm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(farm, key, value)
    await db.flush()
    return FarmOut.model_validate(farm, from_attributes=True)


async def deactivate_farm(db: AsyncSession, farm_id: UUID) -> None:
    farm = await db.scalar(select(Farm).where(Farm.id == farm_id))
    if farm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")
    farm.is_active = False
    await db.flush()


async def create_vehicle(db: AsyncSession, payload: VehicleCreate) -> VehicleOut:
    vehicle = Vehicle(
        number=payload.number.strip().upper(),
        capacity_kg=q_kg(payload.capacity_kg) if payload.capacity_kg is not None else None,
        driver_name=payload.driver_name,
    )
    db.add(vehicle)
    await db.flush()
    return VehicleOut.model_validate(vehicle, from_attributes=True)


async def list_vehicles(db: AsyncSession) -> list[VehicleOut]:
    rows = list(await db.scalars(select(Vehicle).order_by(Vehicle.number)))
    return [VehicleOut.model_validate(r, from_attributes=True) for r in rows]


async def update_vehicle(db: AsyncSession, vehicle_id: UUID, payload: VehicleUpdate) -> VehicleOut:
    vehicle = await db.scalar(select(Vehicle).where(Vehicle.id == vehicle_id))
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    data = payload.model_dump(exclude_unset=True)
    if "number" in data and data["number"]:
        data["number"] = data["number"].strip().upper()
    if "capacity_kg" in data and data["capacity_kg"] is not None:
        data["capacity_kg"] = q_kg(data["capacity_kg"])
    for key, value in data.items():
        setattr(vehicle, key, value)
    await db.flush()
    return VehicleOut.model_validate(vehicle, from_attributes=True)


async def deactivate_vehicle(db: AsyncSession, vehicle_id: UUID) -> None:
    vehicle = await db.scalar(select(Vehicle).where(Vehicle.id == vehicle_id))
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    vehicle.is_active = False
    await db.flush()


async def create_farm_load(db: AsyncSession, payload: FarmLoadCreate) -> FarmLoadOut:
    vehicle_number = payload.vehicle_number
    driver_name = payload.driver_name
    if payload.vehicle_id:
        vehicle = await db.scalar(select(Vehicle).where(Vehicle.id == payload.vehicle_id))
        if vehicle is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
        vehicle_number = vehicle_number or vehicle.number
        driver_name = driver_name or vehicle.driver_name
    load = FarmLoad(
        load_date=payload.load_date or today_ist(),
        farm_id=payload.farm_id,
        vehicle_id=payload.vehicle_id,
        vehicle_number=vehicle_number,
        driver_name=driver_name,
        driver_user_id=payload.driver_user_id,
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


async def list_farm_loads(db: AsyncSession) -> list[FarmLoadOut]:
    rows = list(
        await db.scalars(
            select(FarmLoad).order_by(FarmLoad.load_date.desc(), FarmLoad.created_at.desc())
        )
    )
    return [FarmLoadOut.model_validate(r, from_attributes=True) for r in rows]


async def update_farm_load(db: AsyncSession, load_id: UUID, payload: FarmLoadUpdate) -> FarmLoadOut:
    load = await db.scalar(select(FarmLoad).where(FarmLoad.id == load_id))
    if load is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm load not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        if key == "loaded_weight_kg" and value is not None:
            setattr(load, key, q_kg(value))
        elif key == "load_date" and value is None:
            continue
        else:
            setattr(load, key, value)
    await db.flush()
    return FarmLoadOut.model_validate(load, from_attributes=True)
