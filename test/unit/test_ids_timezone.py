from app.core.ids import uuid7
from app.core.timezone import today_ist


def test_uuid7_generates() -> None:
    value = uuid7()
    assert value is not None


def test_today_ist_is_date() -> None:
    assert today_ist().year >= 2024
