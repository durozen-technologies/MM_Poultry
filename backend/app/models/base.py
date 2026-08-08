from datetime import datetime

from sqlalchemy import DateTime, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.timezone import now_ist


class BaseModelMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_ist,
        server_default=text("CURRENT_TIMESTAMP"),
        index=True,
        nullable=False,
    )
