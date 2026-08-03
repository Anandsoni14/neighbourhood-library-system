from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ConflictError, NotFoundError
from models.enums import CopyStatus
from services.book import BookService
from services.book_copy import BookCopyService
from services.loan import LoanService
from services.member import MemberService
from services.staff import StaffService


@pytest.fixture
async def book_service(db: AsyncSession) -> BookService:
    return BookService(db)


@pytest.fixture
async def copy_service(db: AsyncSession) -> BookCopyService:
    return BookCopyService(db)


class TestBookCopyService:
    """Test BookCopyService business logic."""

    async def test_create_copy(
        self, book_service: BookService, copy_service: BookCopyService
    ) -> None:
        book = await book_service.create_book(title="Dune", author="Frank Herbert")
        copy = await copy_service.create_copy(book_id=book.book_id, barcode="BC-001")
        assert copy.barcode == "BC-001"
        assert copy.book_id == book.book_id
        assert copy.status == CopyStatus.AVAILABLE

    async def test_create_copy_book_not_found_raises(self, copy_service: BookCopyService) -> None:
        with pytest.raises(NotFoundError):
            await copy_service.create_copy(book_id=uuid4(), barcode="BC-002")

    async def test_create_copy_duplicate_barcode_raises_conflict(
        self, book_service: BookService, copy_service: BookCopyService
    ) -> None:
        book = await book_service.create_book(title="Dune", author="Frank Herbert")
        await copy_service.create_copy(book_id=book.book_id, barcode="BC-DUP")
        with pytest.raises(ConflictError):
            await copy_service.create_copy(book_id=book.book_id, barcode="BC-DUP")

    async def test_get_copy_not_found_raises(self, copy_service: BookCopyService) -> None:
        with pytest.raises(NotFoundError):
            await copy_service.get_copy(uuid4())

    async def test_list_copies_by_book(
        self, book_service: BookService, copy_service: BookCopyService
    ) -> None:
        book_a = await book_service.create_book(title="Book A", author="Author A")
        book_b = await book_service.create_book(title="Book B", author="Author B")
        await copy_service.create_copy(book_id=book_a.book_id, barcode="A-1")
        await copy_service.create_copy(book_id=book_a.book_id, barcode="A-2")
        await copy_service.create_copy(book_id=book_b.book_id, barcode="B-1")

        results, total = await copy_service.list_copies(book_id=book_a.book_id)
        assert total == 2
        assert len(results) == 2

    async def test_list_copies_by_status(
        self, book_service: BookService, copy_service: BookCopyService
    ) -> None:
        book = await book_service.create_book(title="Book", author="Author")
        await copy_service.create_copy(book_id=book.book_id, barcode="S-1")
        results, total = await copy_service.list_copies(status=CopyStatus.AVAILABLE)
        assert total == 1
        assert len(results) == 1

    async def test_list_copies_combines_book_and_status(
        self, book_service: BookService, copy_service: BookCopyService
    ) -> None:
        """Regression: book_id and status used to be mutually exclusive, so the
        second filter was silently ignored and callers got the wrong rows."""
        book_a = await book_service.create_book(title="Filtered A", author="Author")
        book_b = await book_service.create_book(title="Filtered B", author="Author")
        available = await copy_service.create_copy(book_id=book_a.book_id, barcode="F-A1")
        borrowed = await copy_service.create_copy(book_id=book_a.book_id, barcode="F-A2")
        await copy_service.update_copy(borrowed.copy_id, status=CopyStatus.BORROWED)
        await copy_service.create_copy(book_id=book_b.book_id, barcode="F-B1")

        results, total = await copy_service.list_copies(
            book_id=book_a.book_id, status=CopyStatus.AVAILABLE
        )

        assert total == 1
        assert results[0].copy_id == available.copy_id

    async def test_update_copy(
        self, book_service: BookService, copy_service: BookCopyService
    ) -> None:
        book = await book_service.create_book(title="Book", author="Author")
        copy = await copy_service.create_copy(book_id=book.book_id, barcode="U-1")
        updated = await copy_service.update_copy(copy.copy_id, shelf_code="A-12")
        assert updated.shelf_code == "A-12"

    async def test_delete_copy(
        self, book_service: BookService, copy_service: BookCopyService
    ) -> None:
        book = await book_service.create_book(title="Book", author="Author")
        copy = await copy_service.create_copy(book_id=book.book_id, barcode="D-1")
        await copy_service.delete_copy(copy.copy_id)
        with pytest.raises(NotFoundError):
            await copy_service.get_copy(copy.copy_id)

    async def test_create_copy_on_archived_book_raises_conflict(
        self, book_service: BookService, copy_service: BookCopyService
    ) -> None:
        book = await book_service.create_book(title="Archived Book", author="Author")
        await book_service.archive_book(book.book_id)
        with pytest.raises(ConflictError):
            await copy_service.create_copy(book_id=book.book_id, barcode="ARCHIVED-1")

    async def test_delete_copy_with_loan_history_raises_conflict(
        self,
        book_service: BookService,
        copy_service: BookCopyService,
        staff_service: StaffService,
        db: AsyncSession,
    ) -> None:
        book = await book_service.create_book(title="Loaned Book", author="Author")
        copy = await copy_service.create_copy(book_id=book.book_id, barcode="LOAN-HIST-1")
        staff = await staff_service.create_staff(
            employee_code="COPY-DEL-STAFF",
            first_name="Loan",
            last_name="Issuer",
            email="loan.issuer.copy@library.com",
            password="password123",
        )
        member = await MemberService(db).create_member(
            first_name="Has", last_name="Loan", email="has.loan.copy@example.com"
        )
        await LoanService(db).issue_loan(
            copy_id=copy.copy_id, member_id=member.member_id, issued_by_staff_id=staff.staff_id
        )

        with pytest.raises(ConflictError):
            await copy_service.delete_copy(copy.copy_id)


class TestBookCopiesAPI:
    """Test Book Copies API endpoints."""

    async def test_create_book_copy_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        book_resp = await client.post(
            "/api/v1/books",
            json={"title": "1984", "author": "George Orwell"},
            headers=librarian_headers,
        )
        book_id = book_resp.json()["book_id"]

        response = await client.post(
            "/api/v1/book-copies",
            json={"book_id": book_id, "barcode": "COPY-100"},
            headers=librarian_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["barcode"] == "COPY-100"
        assert data["status"] == "AVAILABLE"

    async def test_create_book_copy_endpoint_no_token_401(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/book-copies", json={"book_id": str(uuid4()), "barcode": "NO-TOKEN"}
        )
        assert response.status_code == 401

    async def test_create_book_copy_book_not_found(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        response = await client.post(
            "/api/v1/book-copies",
            json={"book_id": str(uuid4()), "barcode": "COPY-404"},
            headers=librarian_headers,
        )
        assert response.status_code == 404

    async def test_create_book_copy_blank_barcode_422(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        book_resp = await client.post(
            "/api/v1/books",
            json={"title": "Blank Barcode Book", "author": "Author"},
            headers=librarian_headers,
        )
        book_id = book_resp.json()["book_id"]

        response = await client.post(
            "/api/v1/book-copies",
            json={"book_id": book_id, "barcode": "   "},
            headers=librarian_headers,
        )
        assert response.status_code == 422

    async def test_create_book_copy_zero_max_borrow_days_422(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        book_resp = await client.post(
            "/api/v1/books",
            json={"title": "Zero Borrow Days Book", "author": "Author"},
            headers=librarian_headers,
        )
        book_id = book_resp.json()["book_id"]

        response = await client.post(
            "/api/v1/book-copies",
            json={"book_id": book_id, "barcode": "COPY-ZERO-DAYS", "max_borrow_days": 0},
            headers=librarian_headers,
        )
        assert response.status_code == 422

    async def test_create_book_copy_negative_late_fee_422(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        book_resp = await client.post(
            "/api/v1/books",
            json={"title": "Negative Fee Book", "author": "Author"},
            headers=librarian_headers,
        )
        book_id = book_resp.json()["book_id"]

        response = await client.post(
            "/api/v1/book-copies",
            json={"book_id": book_id, "barcode": "COPY-NEG-FEE", "late_fee_per_day": -5},
            headers=librarian_headers,
        )
        assert response.status_code == 422

    async def test_create_book_copy_on_archived_book_409(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        book_resp = await client.post(
            "/api/v1/books",
            json={"title": "Archived Endpoint Book", "author": "Author"},
            headers=librarian_headers,
        )
        book_id = book_resp.json()["book_id"]
        await client.post(f"/api/v1/books/{book_id}/archive", headers=librarian_headers)

        response = await client.post(
            "/api/v1/book-copies",
            json={"book_id": book_id, "barcode": "ARCHIVED-ENDPOINT-1"},
            headers=librarian_headers,
        )
        assert response.status_code == 409

    async def test_list_book_copies_by_book(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        book_resp = await client.post(
            "/api/v1/books",
            json={"title": "Brave New World", "author": "Huxley"},
            headers=librarian_headers,
        )
        book_id = book_resp.json()["book_id"]
        await client.post(
            "/api/v1/book-copies",
            json={"book_id": book_id, "barcode": "COPY-A"},
            headers=librarian_headers,
        )

        response = await client.get(
            f"/api/v1/book-copies?book_id={book_id}", headers=librarian_headers
        )
        assert response.status_code == 200
        assert response.json()["total"] == 1

    async def test_list_book_copies_combines_filters_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        """Regression: ?book_id=X&status=Y used to ignore status entirely."""
        book_resp = await client.post(
            "/api/v1/books",
            json={"title": "Combined Copies", "author": "Author"},
            headers=librarian_headers,
        )
        book_id = book_resp.json()["book_id"]
        await client.post(
            "/api/v1/book-copies",
            json={"book_id": book_id, "barcode": "CMB-1"},
            headers=librarian_headers,
        )
        borrowed = await client.post(
            "/api/v1/book-copies",
            json={"book_id": book_id, "barcode": "CMB-2"},
            headers=librarian_headers,
        )
        await client.put(
            f"/api/v1/book-copies/{borrowed.json()['copy_id']}",
            json={"status": "BORROWED"},
            headers=librarian_headers,
        )

        response = await client.get(
            "/api/v1/book-copies",
            params={"book_id": book_id, "status": "AVAILABLE"},
            headers=librarian_headers,
        )

        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["barcode"] == "CMB-1"

    async def test_get_book_copy_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        book_resp = await client.post(
            "/api/v1/books", json={"title": "Book", "author": "Author"}, headers=librarian_headers
        )
        book_id = book_resp.json()["book_id"]
        copy_resp = await client.post(
            "/api/v1/book-copies",
            json={"book_id": book_id, "barcode": "COPY-B"},
            headers=librarian_headers,
        )
        copy_id = copy_resp.json()["copy_id"]

        response = await client.get(f"/api/v1/book-copies/{copy_id}", headers=librarian_headers)
        assert response.status_code == 200
        assert response.json()["barcode"] == "COPY-B"

    async def test_update_book_copy_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        book_resp = await client.post(
            "/api/v1/books", json={"title": "Book", "author": "Author"}, headers=librarian_headers
        )
        book_id = book_resp.json()["book_id"]
        copy_resp = await client.post(
            "/api/v1/book-copies",
            json={"book_id": book_id, "barcode": "COPY-C"},
            headers=librarian_headers,
        )
        copy_id = copy_resp.json()["copy_id"]

        response = await client.put(
            f"/api/v1/book-copies/{copy_id}",
            json={"status": "MAINTENANCE"},
            headers=librarian_headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "MAINTENANCE"

    async def test_delete_book_copy_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        book_resp = await client.post(
            "/api/v1/books", json={"title": "Book", "author": "Author"}, headers=librarian_headers
        )
        book_id = book_resp.json()["book_id"]
        copy_resp = await client.post(
            "/api/v1/book-copies",
            json={"book_id": book_id, "barcode": "COPY-D"},
            headers=librarian_headers,
        )
        copy_id = copy_resp.json()["copy_id"]

        response = await client.delete(f"/api/v1/book-copies/{copy_id}", headers=librarian_headers)
        assert response.status_code == 204

        response = await client.get(f"/api/v1/book-copies/{copy_id}", headers=librarian_headers)
        assert response.status_code == 404
