from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.domain import (
    Retailer,
)
from app.models.enums import (
    UserRole,
)
from app.models.user import User
from app.schemas import (
    RetailerCreate,
    RetailerOut,
    RetailerUpdate,
)
from app.services.auth import upsert_auth_index
from app.services.wholesale.common import q_money


async def create_retailer(
    db: AsyncSession,
    payload: RetailerCreate,
    *,
    organization_id: UUID,
    schema_name: str,
) -> RetailerOut:
    retailer = Retailer(
        name=payload.name.strip(),
        shop_name=payload.shop_name,
        owner_name=payload.owner_name,
        phone=payload.phone,
        alternate_phone=payload.alternate_phone,
        whatsapp=payload.whatsapp,
        address=payload.address,
        area=payload.area,
        route_name=payload.route_name,
        category=payload.category,
        notes=payload.notes,
        opening_balance=q_money(payload.opening_balance),
        credit_balance=q_money(payload.opening_balance),
        credit_limit=q_money(payload.credit_limit),
        preferred_delivery_time=payload.preferred_delivery_time,
    )
    db.add(retailer)
    await db.flush()
    if payload.username and payload.password:
        from app.db.tenant_schema import set_search_path
        from app.services.auth import check_global_username_available
        
        await set_search_path(db, None)
        if not await check_global_username_available(db, payload.username):
            raise HTTPException(status_code=409, detail="Retailer username is already taken globally")
        await set_search_path(db, schema_name)
        user = User(
            username=payload.username.strip(),
            password_hash=get_password_hash(payload.password),
            role=UserRole.RETAILER,
            organization_id=organization_id,
            retailer_id=retailer.id,
        )
        db.add(user)
        await db.flush()
        await upsert_auth_index(
            db,
            username=user.username,
            organization_id=organization_id,
            schema_name=schema_name,
            user_id=user.id,
        )
    return RetailerOut.model_validate(retailer, from_attributes=True)


async def list_retailers(
    db: AsyncSession, *, cursor: str | None = None, limit: int = 50
) -> tuple[list[RetailerOut], bool, str | None]:
    stmt = select(Retailer).order_by(Retailer.created_at.desc(), Retailer.id.desc()).limit(limit + 1)
    if cursor:
        stmt = stmt.where(Retailer.id < UUID(cursor))
    rows = list(await db.scalars(stmt))
    has_more = len(rows) > limit
    rows = rows[:limit]
    next_cursor = str(rows[-1].id) if has_more and rows else None
    return (
        [RetailerOut.model_validate(r, from_attributes=True) for r in rows],
        has_more,
        next_cursor,
    )


async def get_retailer(db: AsyncSession, retailer_id: UUID) -> Retailer:
    retailer = await db.scalar(select(Retailer).where(Retailer.id == retailer_id))
    if retailer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retailer not found")
    return retailer


async def update_retailer(
    db: AsyncSession, retailer_id: UUID, payload: RetailerUpdate
) -> RetailerOut:
    retailer = await get_retailer(db, retailer_id)
    data = payload.model_dump(exclude_unset=True)
    if "opening_balance" in data and data["opening_balance"] is not None:
        # Adjust credit by delta of opening balance change
        old_opening = retailer.opening_balance
        new_opening = q_money(data["opening_balance"])
        retailer.credit_balance = q_money(retailer.credit_balance + (new_opening - old_opening))
        retailer.opening_balance = new_opening
        del data["opening_balance"]
    for key, value in data.items():
        setattr(retailer, key, value)
    await db.flush()
    return RetailerOut.model_validate(retailer, from_attributes=True)


