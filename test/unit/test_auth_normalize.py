from app.services.auth import normalize_username


def test_normalize_username_trims_and_lowercases() -> None:
    assert normalize_username("  Admin  ") == "admin"
    assert normalize_username("Retailer1") == "retailer1"
