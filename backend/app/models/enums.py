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
    DISPATCHED = "DISPATCHED"
    PARTIAL = "PARTIAL"
    FULFILLED = "FULFILLED"
    CANCELLED = "CANCELLED"


class FarmLoadStatus(str, enum.Enum):
    OPEN = "OPEN"
    IN_TRANSIT = "IN_TRANSIT"
    CLOSED = "CLOSED"


class PaymentType(str, enum.Enum):
    RECEIVED = "RECEIVED"
    ADJUSTMENT = "ADJUSTMENT"


class PrintStatus(str, enum.Enum):
    PENDING = "PENDING"
    PRINTED = "PRINTED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"
