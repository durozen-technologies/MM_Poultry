import asyncio
from httpx import AsyncClient
import pytest
import os

from test.factories import auth_headers, create_org_with_admin
from app.main import create_app
from httpx import ASGITransport

async def run():
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
        _, admin = await create_org_with_admin(client, slug="farms_get")
        headers = auth_headers(admin["access_token"])
        farm = await client.post(
            "/admin/farms",
            json={"name": "Get Farm", "contact_phone": "9000000000"},
            headers=headers,
        )
        print("POST farm:", farm.status_code, farm.text)
        farm_id = farm.json()["id"]
        
        get_resp = await client.get(f"/admin/farms/{farm_id}", headers=headers)
        print("GET farm:", get_resp.status_code, get_resp.text)

if __name__ == "__main__":
    os.environ["POSTGRES_DB"] = "MM_Poultry_test"
    asyncio.run(run())
