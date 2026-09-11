from app.core.ids import uuid7
from app.core.timezone import now_ist

def test_uuid7_generates() -> None:
    value = uuid7()
    assert value is not None

def test_now_ist_is_datetime() -> None:
    assert now_ist().year >= 2024
