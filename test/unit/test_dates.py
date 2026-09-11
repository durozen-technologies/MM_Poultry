from datetime import date, datetime
import pytest
from pydantic import BaseModel
from pydantic_core import ValidationError
from app.schemas.dates import IstDate, IstDateTime, IstDateOptional
from app.core.timezone import IST

class DateModel(BaseModel):
    d: IstDate
    dt: IstDateTime
    opt: IstDateOptional = None

def test_dates_parsing_and_serialization() -> None:
    # Test valid DD/MM/YYYY date and datetime
    payload = {
        "d": "15/08/2023",
        "dt": "15/08/2023 14:30:00",
        "opt": "16/08/2023"
    }
    obj = DateModel.model_validate(payload)
    
    assert obj.d == date(2023, 8, 15)
    assert obj.dt == datetime(2023, 8, 15, 14, 30, tzinfo=IST)
    assert obj.opt == date(2023, 8, 16)
    
    # Serialization format
    dump = obj.model_dump()
    assert dump["d"] == "15/08/2023"
    assert dump["dt"] == "15/08/2023 14:30:00"
    assert dump["opt"] == "16/08/2023"

def test_dates_parsing_edge_cases() -> None:
    # None for optional
    obj = DateModel.model_validate({
        "d": "15/08/2023",
        "dt": "15/08/2023 14:30:00",
        "opt": None
    })
    assert obj.opt is None
    
    # ISO string with timezone
    obj_iso = DateModel.model_validate({
        "d": "2023-08-15",
        "dt": "2023-08-15T14:30:00Z"
    })
    assert obj_iso.dt == datetime(2023, 8, 15, 20, 0, tzinfo=IST)  # +5:30
    
    # Date-only format fallback for datetime
    obj_iso2 = DateModel.model_validate({
        "d": "2023-08-15",
        "dt": "2023-08-15"
    })
    assert obj_iso2.dt == datetime(2023, 8, 15, 0, 0, tzinfo=IST)

def test_datetime_from_date_object() -> None:
    obj = DateModel.model_validate({
        "d": date(2023, 8, 15),
        "dt": date(2023, 8, 15),
    })
    assert obj.dt == datetime(2023, 8, 15, 0, 0, 0, tzinfo=IST)

def test_datetime_from_datetime_object() -> None:
    dt = datetime(2023, 8, 15, 14, 30, tzinfo=IST)
    obj = DateModel.model_validate({
        "d": dt.date(),
        "dt": dt
    })
    assert obj.dt == dt

def test_dates_invalid_format() -> None:
    with pytest.raises(ValidationError):
        DateModel.model_validate({
            "d": "invalid",
            "dt": "15/08/2023 14:30:00"
        })
        
    with pytest.raises(ValidationError):
        DateModel.model_validate({
            "d": "15/08/2023",
            "dt": "invalid datetime"
        })
