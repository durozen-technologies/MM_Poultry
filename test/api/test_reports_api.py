import pytest
from httpx import AsyncClient

from test.factories import auth_headers, create_org_with_admin


@pytest.mark.asyncio
async def test_report_summary_and_pdf(client: AsyncClient) -> None:
    _, admin = await create_org_with_admin(client, slug="reportorg")
    headers = auth_headers(admin["access_token"])
    summary = await client.get("/admin/reports/summary", headers=headers)
    assert summary.status_code == 200
    pdf = await client.get("/admin/reports/summary.pdf", headers=headers)
    assert pdf.status_code == 200
    assert pdf.headers["content-type"].startswith("application/pdf")
