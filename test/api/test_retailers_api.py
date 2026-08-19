import pytest
from httpx import AsyncClient

from test.factories import auth_headers, create_org_with_admin


@pytest.mark.asyncio
async def test_retailer_crud_and_duplicate_username(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="retailorg")
    headers = auth_headers(admin["access_token"])
    created = await client.post(
        "/admin/retailers",
        json={
            "name": "Shop A",
            "username": "retailer_a",
            "password": "password123",
        },
        headers=headers,
    )
    assert created.status_code == 200
    rid = created.json()["id"]
    dup = await client.post(
        "/admin/retailers",
        json={
            "name": "Shop B",
            "username": "Retailer_A",
            "password": "password123",
        },
        headers=headers,
    )
    assert dup.status_code == 409
    fetched = await client.get(f"/admin/retailers/{rid}", headers=headers)
    assert fetched.status_code == 200
    page = await client.get("/admin/retailers", headers=headers)
    assert page.status_code == 200
    assert len(page.json()["items"]) >= 1
