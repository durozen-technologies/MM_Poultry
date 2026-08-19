import pytest
from httpx import AsyncClient

from test.factories import auth_headers, create_org_with_admin


@pytest.mark.asyncio
async def test_retailer_ledger_after_payment(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="ledgerorg")
    headers = auth_headers(admin["access_token"])
    retailer = await client.post(
        "/admin/retailers",
        json={"name": "Ledger Retailer", "opening_balance": "100.00"},
        headers=headers,
    )
    assert retailer.status_code == 200
    rid = retailer.json()["id"]
    payment = await client.post(
        f"/admin/retailers/{rid}/payments",
        json={"cash_amount": "50.00", "upi_amount": "0"},
        headers=headers,
    )
    assert payment.status_code == 200
    ledger = await client.get(f"/admin/retailers/{rid}/ledger", headers=headers)
    assert ledger.status_code == 200
    assert len(ledger.json()["entries"]) >= 1
