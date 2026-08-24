from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.ids import UUID_SQL_TYPE, uuid7
from app.core.timezone import now_ist
from app.db.database import Base
from app.models.base import BaseModelMixin


class Organization(Base, BaseModelMixin):
    __tablename__ = "organizations"

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    schema_name: Mapped[str] = mapped_column(String(63), nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_ist,
        onupdate=now_ist,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )


class UserAuthIndex(Base, BaseModelMixin):
    __tablename__ = "user_auth_index"

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    username_lower: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    organization_id: Mapped[UUID | None] = mapped_column(UUID_SQL_TYPE, nullable=True, index=True)
    schema_name: Mapped[str] = mapped_column(String(63), nullable=False)
    user_id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, nullable=False)
