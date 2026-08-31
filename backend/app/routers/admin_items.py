from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.future import select

from app.auth.dependencies import AuthContext, require_roles
from app.models.domain import Item, RetailerItemRate
from app.models.enums import UserRole
from app.schemas.common import Page
from app.schemas.item import ItemCreate, ItemResponse, ItemUpdate

router = APIRouter(tags=["admin_items"])


@router.post("/admin/items", response_model=ItemResponse)
async def admin_create_item(
    payload: ItemCreate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
) -> ItemResponse:
    """Create a new item."""
    new_item = Item(**payload.model_dump())
    # Associate item with organization if applicable, though it's tenant-bound implicitly

    auth.db.add(new_item)
    try:
        await auth.db.flush()
    except IntegrityError:
        raise HTTPException(status_code=400, detail="An item with this name already exists.")
    return ItemResponse.model_validate(new_item, from_attributes=True)


@router.get("/admin/items", response_model=Page[ItemResponse])
async def admin_list_items(
    auth: Annotated[
        AuthContext, Depends(require_roles(UserRole.ADMIN, UserRole.RETAILER, UserRole.DELIVERY))
    ],
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    active_only: bool = Query(False),
):
    """List items."""
    stmt = select(Item).order_by(Item.name)
    if active_only:
        stmt = stmt.where(Item.is_active)

    # Calculate offset
    offset = (page - 1) * size
    stmt_paged = stmt.offset(offset).limit(size)

    result = await auth.db.scalars(stmt_paged)
    items = list(result.all())

    from sqlalchemy import func

    count_stmt = select(func.count()).select_from(Item)
    if active_only:
        count_stmt = count_stmt.where(Item.is_active)
    total_count = await auth.db.scalar(count_stmt)
    total_pages = (total_count + size - 1) // size if total_count else 0

    return Page(
        items=[ItemResponse.model_validate(i, from_attributes=True) for i in items],
        total=total_count or 0,
        page=page,
        size=size,
        pages=total_pages,
    )


@router.get("/admin/items/{item_id}", response_model=ItemResponse)
async def admin_get_item(
    item_id: UUID,
    auth: Annotated[
        AuthContext, Depends(require_roles(UserRole.ADMIN, UserRole.RETAILER, UserRole.DELIVERY))
    ],
):
    """Get an item by ID."""
    item = await auth.db.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return ItemResponse.model_validate(item, from_attributes=True)


@router.patch("/admin/items/{item_id}", response_model=ItemResponse)
async def admin_update_item(
    item_id: UUID,
    payload: ItemUpdate,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
):
    """Update an item."""
    item = await auth.db.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    try:
        await auth.db.flush()
    except IntegrityError:
        raise HTTPException(status_code=400, detail="An item with this name already exists.")
    return ItemResponse.model_validate(item, from_attributes=True)


@router.delete("/admin/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_item(
    item_id: UUID,
    auth: Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))],
):
    """Delete an item (or mark as inactive)."""
    item = await auth.db.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    rate = await auth.db.scalar(
        select(RetailerItemRate).where(RetailerItemRate.item_id == item_id).limit(1)
    )
    if rate:
        # Cannot delete if referenced, just mark as inactive
        item.is_active = False
        await auth.db.flush()
    else:
        await auth.db.delete(item)
        await auth.db.flush()
    return
