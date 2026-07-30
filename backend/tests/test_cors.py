from httpx import AsyncClient

from core.config import get_settings

ALLOWED_ORIGIN = "http://localhost:5173"
DISALLOWED_ORIGIN = "http://evil.example.com"


async def test_settings_expose_default_dev_origins() -> None:
    """The SPA dev server origin is allowed out of the box."""
    assert ALLOWED_ORIGIN in get_settings().cors_allow_origins


async def test_preflight_from_allowed_origin_is_accepted(client: AsyncClient) -> None:
    """Without this the browser blocks every API call from the SPA."""
    response = await client.options(
        "/api/v1/books",
        headers={
            "Origin": ALLOWED_ORIGIN,
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN


async def test_simple_request_from_allowed_origin_gets_cors_header(client: AsyncClient) -> None:
    """The actual response — not just the preflight — must carry the header."""
    response = await client.get("/api/v1/books", headers={"Origin": ALLOWED_ORIGIN})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN


async def test_request_from_disallowed_origin_gets_no_cors_header(client: AsyncClient) -> None:
    """An unlisted origin is not granted access."""
    response = await client.get("/api/v1/books", headers={"Origin": DISALLOWED_ORIGIN})

    assert "access-control-allow-origin" not in response.headers
