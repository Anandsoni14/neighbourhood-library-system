"""Domain exceptions are mapped to HTTP responses in exactly one place.

The routes used to re-catch NotFoundError/ConflictError and raise HTTPException
themselves, duplicating app.exception_handlers. These tests pin the resulting
status codes and body shape so removing that duplication stayed behaviour-
preserving — and so a future refactor cannot quietly change the contract the
frontend's error handling depends on.
"""

from uuid import uuid4

from httpx import AsyncClient


async def test_not_found_returns_404_with_detail_string(
    client: AsyncClient, librarian_headers: dict[str, str]
) -> None:
    response = await client.get(f"/api/v1/books/{uuid4()}", headers=librarian_headers)

    assert response.status_code == 404
    assert isinstance(response.json()["detail"], str)


async def test_conflict_returns_409_with_detail_string(
    client: AsyncClient, librarian_headers: dict[str, str]
) -> None:
    """Duplicate ISBN is a ConflictError raised by the service layer."""
    payload = {"title": "Conflicted", "author": "Author", "isbn": "ERR-MAP-001"}
    first = await client.post("/api/v1/books", json=payload, headers=librarian_headers)
    assert first.status_code == 201

    response = await client.post("/api/v1/books", json=payload, headers=librarian_headers)

    assert response.status_code == 409
    assert isinstance(response.json()["detail"], str)


async def test_conflict_on_delete_with_dependents(
    client: AsyncClient, librarian_headers: dict[str, str]
) -> None:
    """Deleting a member that still has loan history is a 409, not a 500.

    (Not book delete: DELETE /books/{id} was removed entirely in favour of
    archive — see test_books.py::test_delete_book_endpoint_is_gone for that
    behaviour. Member delete is still a real hard delete, so it's the FK-
    RESTRICT-into-409 case this test exists to pin.)
    """
    member_resp = await client.post(
        "/api/v1/members",
        json={"first_name": "Has", "last_name": "Loans", "email": f"{uuid4()}@example.com"},
        headers=librarian_headers,
    )
    member_id = member_resp.json()["member_id"]
    book_resp = await client.post(
        "/api/v1/books",
        json={"title": "Err Map Loan Book", "author": "Author"},
        headers=librarian_headers,
    )
    copy_resp = await client.post(
        "/api/v1/book-copies",
        json={"book_id": book_resp.json()["book_id"], "barcode": "ERR-MAP-BC"},
        headers=librarian_headers,
    )
    await client.post(
        "/api/v1/loans",
        json={"copy_id": copy_resp.json()["copy_id"], "member_id": member_id},
        headers=librarian_headers,
    )

    response = await client.delete(f"/api/v1/members/{member_id}", headers=librarian_headers)

    assert response.status_code == 409
    assert isinstance(response.json()["detail"], str)


async def test_authentication_failure_returns_401(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/login", json={"email": "nobody@example.com", "password": "wrong-password"}
    )

    assert response.status_code == 401
    assert isinstance(response.json()["detail"], str)


async def test_validation_error_returns_422_with_detail_list(
    client: AsyncClient, librarian_headers: dict[str, str]
) -> None:
    """FastAPI's own validation errors keep their list-shaped detail.

    This differs from the domain errors above, and a client parsing `detail`
    has to handle both — worth pinning explicitly.
    """
    response = await client.post(
        "/api/v1/books", json={"author": "Missing Title"}, headers=librarian_headers
    )

    assert response.status_code == 422
    assert isinstance(response.json()["detail"], list)
