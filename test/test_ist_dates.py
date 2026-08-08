from datetime import date

from app.core.timezone import format_ist_date, parse_ist_date, today_ist
from app.schemas.auth import DailyOrderOut
from app.models.enums import OrderStatus
from uuid import uuid4


def test_parse_ddmmyyyy():
    assert parse_ist_date("09/08/2026") == date(2026, 8, 9)


def test_format_ddmmyyyy():
    assert format_ist_date(date(2026, 8, 9)) == "09/08/2026"


def test_api_date_serialization_ddmmyyyy():
    out = DailyOrderOut(
        id=uuid4(),
        retailer_id=uuid4(),
        order_date=today_ist(),
        requested_kg="10.000",
        notes=None,
        status=OrderStatus.PLACED,
    )
    payload = out.model_dump(mode="json")
    assert payload["order_date"] == format_ist_date(today_ist())
    assert "/" in payload["order_date"]
