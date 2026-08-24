"""Pydantic date/datetime types: IST calendar + DD/MM/YYYY wire format."""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Any

from pydantic import BeforeValidator, PlainSerializer

from app.core.timezone import (
    format_ist_date,
    format_ist_datetime,
    parse_ist_date,
    to_ist,
)


def _parse_date(value: Any) -> date:
    return parse_ist_date(value)


def _parse_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return to_ist(value)
    if isinstance(value, date) and not isinstance(value, datetime):
        from app.core.timezone import ist_midnight

        return ist_midnight(value)
    text = str(value).strip()
    # DD/MM/YYYY HH:MM:SS or date-only
    for fmt in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d"):
        try:
            parsed = (
                datetime.strptime(text.replace("Z", "+0000"), fmt)
                if "%z" in fmt
                else datetime.strptime(text, fmt)
            )
            if parsed.tzinfo is None:
                from app.core.timezone import IST

                return parsed.replace(tzinfo=IST)
            return to_ist(parsed)
        except ValueError:
            continue
    raise ValueError("Datetime must use DD/MM/YYYY or DD/MM/YYYY HH:MM:SS")


IstDate = Annotated[
    date,
    BeforeValidator(_parse_date),
    PlainSerializer(lambda v: format_ist_date(v), return_type=str),
]

IstDateTime = Annotated[
    datetime,
    BeforeValidator(_parse_datetime),
    PlainSerializer(lambda v: format_ist_datetime(v), return_type=str),
]

IstDateOptional = Annotated[
    date | None,
    BeforeValidator(lambda v: None if v in (None, "") else _parse_date(v)),
    PlainSerializer(lambda v: format_ist_date(v), return_type=str | None),
]
