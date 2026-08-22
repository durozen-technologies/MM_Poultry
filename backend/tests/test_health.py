import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import get_platform_db

def test_health_ok(client: TestClient):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_health_db_failure(client: TestClient):
    async def override_get_platform_db():
        class MockFailingDB:
            async def execute(self, *args, **kwargs):
                raise Exception("Simulated DB connection failure")
        yield MockFailingDB()

    app.dependency_overrides[get_platform_db] = override_get_platform_db
    try:
        response = client.get("/api/v1/health")
        assert response.status_code == 503
        assert "connection failed" in response.json()["error"]["message"].lower()
    finally:
        app.dependency_overrides.pop(get_platform_db, None)
