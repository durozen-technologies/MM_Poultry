from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.timezone import now_ist
from app.models.domain import StockQuantityEvent
from app.services.wholesale.common import q_kg


async def log_quantity_change(
    db: AsyncSession,
    *,
    entity_type: str,
    entity_id: UUID,
    field: str,
    old_value: Decimal | None,
    new_value: Decimal | None,
    reason: str | None = None,
    actor_user_id: UUID | None = None,
    ref_type: str | None = None,
    ref_id: UUID | None = None,
) -> None:
    if old_value is not None:
        old_value = q_kg(old_value)
    if new_value is not None:
        new_value = q_kg(new_value)
    if old_value == new_value:
        return
    db.add(
        StockQuantityEvent(
            entity_type=entity_type,
            entity_id=entity_id,
            field=field,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            actor_user_id=actor_user_id,
            ref_type=ref_type,
            ref_id=ref_id,
            created_at=now_ist(),
        )
    )
    await db.flush()
