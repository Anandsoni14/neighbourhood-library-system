"""Domain exceptions are mapped to HTTP responses in exactly one place.

The routes used to re-catch NotFoundError/ConflictError and raise HTTPException
themselves, duplicating app.exception_handlers. These tests pin the resulting
status codes and body shape so removing that duplication stayed behaviour-
preserving — and so a future refactor cannot quietly change the contract the
frontend's error handling depends on.
"""

from uuid import uuid4

from httpx import AsyncClient


async def test_not_found_returns_404_with_detail_string(client: AsyncClient) -> None:
    response = await client.get(f"/api/v1/books/{uuid4()}")

    assert response.status_code == 404
    assert isinstance(response.json()["detail"], str)


async def test_conflict_returns_409_with_detail_string(client: AsyncClient) -> None:
    """Duplicate ISBN is a ConflictError raised by the service layer."""
    payload = {"title": "Conflicted", "author": "Author", "isbn": "ERR-MAP-001"}
    first = await client.post("/api/v1/books", json=payload)
    assert first.status_code == 201

    response = await client.post("/api/v1/books", json=payload)

    assert response.status_code == 409
    assert isinstance(response.json()["detail"], str)


async def test_conflict_on_delete_with_dependents(client: AsyncClient) -> None:
    """Deleting a book that still has copies is a 409, not a 500."""
    book = await client.post("/api/v1/books", json={"title": "Has Copies", "author": "Author"})
    book_id = book.json()["book_id"]
    await client.post("/api/v1/book-copies", json={"book_id": book_id, "barcode": "ERR-MAP-BC"})

    response = await client.delete(f"/api/v1/books/{book_id}")

    assert response.status_code == 409
    assert isinstance(response.json()["detail"], str)


async def test_authentication_failure_returns_401(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/login", json={"email": "nobody@example.com", "password": "wrong-password"}
    )

    assert response.status_code == 401
    assert isinstance(response.json()["detail"], str)


async def test_validation_error_returns_422_with_detail_list(client: AsyncClient) -> None:
    """FastAPI's own validation errors keep their list-shaped detail.

    This differs from the domain errors above, and a client parsing `detail`
    has to handle both — worth pinning explicitly.
    """
    response = await client.post("/api/v1/books", json={"author": "Missing Title"})

    assert response.status_code == 422
    assert isinstance(response.json()["detail"], list)
