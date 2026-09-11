from __future__ import annotations

from sqlalchemy import Uuid
from uuid6 import uuid7

__all__ = ["UUID_SQL_TYPE", "uuid7"]

UUID_SQL_TYPE = Uuid(as_uuid=True)
