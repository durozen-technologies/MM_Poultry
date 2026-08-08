from decimal import Decimal

from app.services.wholesale import q_kg, q_money


def test_money_quantize():
    assert q_money(Decimal("10.005")) == Decimal("10.01")
    assert q_money(Decimal("10.004")) == Decimal("10.00")


def test_kg_quantize():
    assert q_kg(Decimal("1.2345")) == Decimal("1.235")


def test_trip_loss_math():
    loaded = Decimal("120.000")
    delivered = Decimal("48.250")
    loss = q_kg(loaded - delivered)
    assert loss == Decimal("71.750")
    pct = q_money((loss / loaded) * Decimal("100"))
    assert pct == Decimal("59.79")
