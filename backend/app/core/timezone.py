"""Indian Standard Time (IST, Asia/Kolkata) — sole business timezone.

Calendar dates are IST dates. Timestamps are written/read as IST-aware values.
Display / API wire format for dates is strictly DD/MM/YYYY.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
IST_ZONE_NAME = "Asia/Kolkata"
DATE_DISPLAY_FORMAT = "%d/%m/%Y"
DATETIME_DISPLAY_FORMAT = "%d/%m/%Y %H:%M:%S"


def now_ist() -> datetime:
    """Current instant in Indian Standard Time."""
    return datetime.now(IST)


def today_ist() -> date:
    return now_ist().date()


def to_ist(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        # Naive values are treated as already-IST wall clock (DB session TZ).
        return dt.replace(tzinfo=IST)
    return dt.astimezone(IST)


def ensure_ist(dt: datetime | None = None) -> datetime:
    return to_ist(dt) if dt is not None else now_ist()


def format_ist_date(value: date | datetime | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        value = to_ist(value).date()
    return value.strftime(DATE_DISPLAY_FORMAT)


def format_ist_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return to_ist(value).strftime(DATETIME_DISPLAY_FORMAT)


def parse_ist_date(value: str | date | datetime) -> date:
    """Parse API/UI date. Accepts DD/MM/YYYY (preferred) or ISO YYYY-MM-DD."""
    if isinstance(value, datetime):
        return to_ist(value).date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in (DATE_DISPLAY_FORMAT, "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    raise ValueError("Date must be in DD/MM/YYYY format")


def ist_midnight(day: date) -> datetime:
    return datetime(day.year, day.month, day.day, tzinfo=IST)


def ist_day_bounds(day: date) -> tuple[datetime, datetime]:
    start = ist_midnight(day)
    return start, start + timedelta(days=1)


def ist_range_bounds(start_date: date, end_date: date) -> tuple[datetime, datetime]:
    return ist_midnight(start_date), ist_midnight(end_date) + timedelta(days=1)


def ist_month_bounds(day: date) -> tuple[datetime, datetime]:
    start = ist_midnight(date(day.year, day.month, 1))
    if day.month == 12:
        end = ist_midnight(date(day.year + 1, 1, 1))
    else:
        end = ist_midnight(date(day.year, day.month + 1, 1))
    return start, end


def ist_week_bounds(day: date) -> tuple[datetime, datetime]:
    start = ist_midnight(day - timedelta(days=day.weekday()))
    return start, start + timedelta(days=7)
