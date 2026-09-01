from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.auth.dependencies import AuthContext, require_roles
from app.models.enums import UserRole
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
from app.services import wholesale as svc

router = APIRouter()


@router.get("/admin/farms", response_model=list[FarmOut])
async def admin_list_farms(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
    limit: int = 100,
    offset: int = 0,
) -> list[FarmOut]:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    return await svc.list_farms(auth.db, limit=limit, offset=offset)


@router.post("/admin/farms", response_model=FarmOut)
async def admin_create_farm(
    payload: FarmCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> FarmOut:
    return await svc.create_farm(auth.db, payload)


@router.get("/admin/farms/{farm_id}", response_model=FarmOut)
async def admin_get_farm(
    farm_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> FarmOut:
    return await svc.get_farm(auth.db, farm_id)


@router.patch("/admin/farms/{farm_id}", response_model=FarmOut)
async def admin_update_farm(
    farm_id: UUID,
    payload: FarmUpdate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> FarmOut:
    return await svc.update_farm(auth.db, farm_id, payload)


@router.delete("/admin/farms/{farm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_farm(
    farm_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> None:
    await svc.deactivate_farm(auth.db, farm_id)


@router.get("/admin/farm-loads", response_model=list[FarmLoadOut])
async def admin_list_loads(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN, UserRole.DELIVERY))],
    limit: int = 50,
    offset: int = 0,
) -> list[FarmLoadOut]:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    return await svc.list_farm_loads(auth.db, limit=limit, offset=offset)


@router.post("/admin/farm-loads", response_model=FarmLoadOut)
async def admin_create_load(
    payload: FarmLoadCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> FarmLoadOut:
    return await svc.create_farm_load(auth.db, payload)


@router.get("/admin/farm-loads/{load_id}", response_model=FarmLoadOut)
async def admin_get_load(
    load_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN, UserRole.DELIVERY))],
) -> FarmLoadOut:
    return await svc.get_farm_load(auth.db, load_id)


@router.patch("/admin/farm-loads/{load_id}", response_model=FarmLoadOut)
async def admin_update_load(
    load_id: UUID,
    payload: FarmLoadUpdate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> FarmLoadOut:
    return await svc.update_farm_load(auth.db, load_id, payload)


@router.delete("/admin/farm-loads/{load_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_load(
    load_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> None:
    await svc.delete_farm_load(auth.db, load_id)


@router.get("/admin/vehicles", response_model=list[VehicleOut])
async def admin_list_vehicles(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
    limit: int = 100,
    offset: int = 0,
) -> list[VehicleOut]:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    return await svc.list_vehicles(auth.db, limit=limit, offset=offset)


@router.post("/admin/vehicles", response_model=VehicleOut)
async def admin_create_vehicle(
    payload: VehicleCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> VehicleOut:
    return await svc.create_vehicle(auth.db, payload)


@router.patch("/admin/vehicles/{vehicle_id}", response_model=VehicleOut)
async def admin_update_vehicle(
    vehicle_id: UUID,
    payload: VehicleUpdate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> VehicleOut:
    return await svc.update_vehicle(auth.db, vehicle_id, payload)


@router.delete("/admin/vehicles/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_vehicle(
    vehicle_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> None:
    await svc.deactivate_vehicle(auth.db, vehicle_id)
