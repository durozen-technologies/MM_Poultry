from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.auth.dependencies import AuthContext, require_roles
from app.models.enums import UserRole
from app.schemas.inventory import InventoryItemLoadsOut, InventorySummaryOut
from app.services.wholesale import inventory as svc

router = APIRouter(tags=["admin_inventory"])


@router.get("/admin/inventory", response_model=InventorySummaryOut)
async def admin_get_inventory(
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> InventorySummaryOut:
    """Get the active inventory summary grouped by item."""
    return await svc.get_inventory_summary(auth.db)


@router.get("/admin/inventory/{item_id}/loads", response_model=InventoryItemLoadsOut)
async def admin_get_inventory_item_loads(
    item_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> InventoryItemLoadsOut:
    """Get the active farm loads for a specific item."""
    return await svc.get_inventory_item_loads(auth.db, item_id)
