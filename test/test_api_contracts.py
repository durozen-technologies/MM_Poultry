"""Contract-style tests against a running API (optional).

Run with API up:
  uv run pytest test/test_api_contracts.py -q
"""

from __future__ import annotations

import os

import httpx
import pytest

BASE = os.getenv("API_BASE", "http://127.0.0.1:8000/api/v1")


def _client() -> httpx.Client:
    return httpx.Client(base_url=BASE, timeout=20)


@pytest.fixture(scope="module")
def admin_headers():
    with _client() as client:
        try:
            r = client.get("/health")
        except httpx.ConnectError:
            pytest.skip("API not running")
        assert r.status_code == 200
        login = client.post(
            "/auth/login",
            json={
                "username": "admin",
                "password": "password123",
                "organization_slug": "demo",
            },
        )
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}


def test_health():
    with _client() as client:
        try:
            r = client.get("/health")
        except httpx.ConnectError:
            pytest.skip("API not running")
        assert r.json()["status"] == "ok"


def test_order_unique_and_list(admin_headers):
    with _client() as client:
        # retailer login
        rt = client.post(
            "/auth/login",
            json={
                "username": "retailer1",
                "password": "password123",
                "organization_slug": "demo",
            },
        )
        assert rt.status_code == 200
        rh = {"Authorization": f"Bearer {rt.json()['access_token']}"}
        o1 = client.post(
            "/retailer/orders/today", headers=rh, json={"requested_kg": "10.000"}
        )
        assert o1.status_code == 200
        o2 = client.post(
            "/retailer/orders/today", headers=rh, json={"requested_kg": "12.500"}
        )
        assert o2.status_code == 200
        assert o1.json()["id"] == o2.json()["id"]
        assert o2.json()["requested_kg"] == "12.500"
        today = client.get("/admin/orders/today", headers=admin_headers)
        assert today.status_code == 200
        assert any(i["id"] == o2.json()["id"] for i in today.json()["items"])


def test_error_envelope():
    with _client() as client:
        try:
            r = client.post(
                "/auth/login", json={"username": "nope", "password": "bad"}
            )
        except httpx.ConnectError:
            pytest.skip("API not running")
        assert r.status_code == 401
        body = r.json()
        assert "error" in body
        assert body["error"]["code"] == "INVALID_CREDENTIALS"
