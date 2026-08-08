from __future__ import annotations

import enum


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    DELIVERY = "DELIVERY"
    RETAILER = "RETAILER"


class OrderStatus(str, enum.Enum):
    PLACED = "PLACED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    PARTIAL = "PARTIAL"
    FULFILLED = "FULFILLED"
    CANCELLED = "CANCELLED"


class FarmLoadStatus(str, enum.Enum):
    OPEN = "OPEN"
    IN_TRANSIT = "IN_TRANSIT"
    CLOSED = "CLOSED"


class DeliveryRunStatus(str, enum.Enum):
    PLANNED = "PLANNED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class DeliveryStopStatus(str, enum.Enum):
    PENDING = "PENDING"
    WEIGHED = "WEIGHED"
    BILLED = "BILLED"
    SKIPPED = "SKIPPED"


class PaymentType(str, enum.Enum):
    RECEIVED = "RECEIVED"
    ADJUSTMENT = "ADJUSTMENT"


class PrintStatus(str, enum.Enum):
    PENDING = "PENDING"
    PRINTED = "PRINTED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"
