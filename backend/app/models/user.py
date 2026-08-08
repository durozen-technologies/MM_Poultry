from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Integer, String, text
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.core.ids import UUID_SQL_TYPE, uuid7
from app.core.timezone import now_ist
from app.db.database import Base
from app.models.base import BaseModelMixin
from app.models.enums import UserRole


class User(Base, BaseModelMixin):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(UUID_SQL_TYPE, primary_key=True, default=uuid7)
    username: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SqlEnum(UserRole, name="user_role", native_enum=False),
        nullable=False,
    )
    organization_id: Mapped[UUID | None] = mapped_column(UUID_SQL_TYPE, nullable=True, index=True)
    retailer_id: Mapped[UUID | None] = mapped_column(UUID_SQL_TYPE, nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False
    )
    permissions_version: Mapped[int] = mapped_column(
        Integer, default=0, server_default=text("0"), nullable=False
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_ist,
        onupdate=now_ist,
        nullable=False,
    )
