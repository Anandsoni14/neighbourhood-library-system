import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ConflictError, NotFoundError
from core.pagination import SortDir
from models import Book
from services.book import BookService


@pytest.fixture
async def book_service(db: AsyncSession) -> BookService:
    """Provide a BookService instance."""
    return BookService(db)


class TestBookService:
    """Test BookService business logic."""

    async def test_create_book(self, book_service: BookService) -> None:
        """Test creating a new book."""
        book = await book_service.create_book(
            title="Clean Code",
            author="Robert C. Martin",
            isbn="978-0132350884",
            category="Technology",
            published_year=2008,
        )
        assert book.title == "Clean Code"
        assert book.isbn == "978-0132350884"
        assert book.book_id is not None

    async def test_create_book_duplicate_isbn_raises_conflict(
        self, book_service: BookService
    ) -> None:
        """Test that duplicate ISBN raises ConflictError."""
        await book_service.create_book(title="Book A", author="Author A", isbn="123-456")
        with pytest.raises(ConflictError):
            await book_service.create_book(title="Book B", author="Author B", isbn="123-456")

    async def test_get_book(self, book_service: BookService) -> None:
        """Test fetching a book by ID."""
        created = await book_service.create_book(title="Test Book", author="Test Author")
        fetched = await book_service.get_book(created.book_id)
        assert fetched.book_id == created.book_id
        assert fetched.title == "Test Book"

    async def test_get_book_not_found_raises(self, book_service: BookService) -> None:
        """Test that fetching non-existent book raises NotFoundError."""
        from uuid import uuid4

        with pytest.raises(NotFoundError):
            await book_service.get_book(uuid4())

    async def test_list_books(self, book_service: BookService) -> None:
        """Test listing books."""
        await book_service.create_book(title="Book 1", author="Author 1")
        await book_service.create_book(title="Book 2", author="Author 2")
        books, total = await book_service.list_books()
        assert len(books) >= 2
        assert total >= 2

    async def test_update_book(self, book_service: BookService) -> None:
        """Test updating a book."""
        book = await book_service.create_book(title="Original Title", author="Author")
        updated = await book_service.update_book(book.book_id, title="Updated Title")
        assert updated.title == "Updated Title"

    async def test_search_books_by_title(self, book_service: BookService) -> None:
        """Test searching books by title."""
        await book_service.create_book(title="Python Basics", author="Author A")
        await book_service.create_book(title="JavaScript Basics", author="Author B")
        results, total = await book_service.list_books(title="Python")
        assert len(results) == 1
        assert total == 1
        assert results[0].title == "Python Basics"

    async def test_search_books_by_isbn(self, book_service: BookService) -> None:
        """Test searching books by ISBN."""
        await book_service.create_book(title="Book A", author="Author A", isbn="ISBN-001")
        results, total = await book_service.list_books(isbn="ISBN-001")
        assert len(results) == 1
        assert total == 1
        assert results[0].isbn == "ISBN-001"

    async def test_filters_combine(self, book_service: BookService) -> None:
        """Filters are ANDed: a title match with a non-matching category excludes the row."""
        await book_service.create_book(title="Deep Work", author="Newport", category="Focus")
        await book_service.create_book(title="Deep Learning", author="Goodfellow", category="AI")

        matching, total = await book_service.list_books(title="Deep", category="AI")

        assert total == 1
        assert [b.title for b in matching] == ["Deep Learning"]

    async def test_pagination_limits_and_reports_total(self, book_service: BookService) -> None:
        """limit/offset return a slice while total reports the full filtered count."""
        for index in range(5):
            await book_service.create_book(title=f"Paged {index}", author="Author")

        first, total = await book_service.list_books(title="Paged", limit=2, offset=0)
        third, _ = await book_service.list_books(title="Paged", limit=2, offset=4)

        assert total == 5
        assert len(first) == 2
        assert len(third) == 1
        # Pages must not overlap — the tiebreaker makes the ordering stable.
        assert {b.book_id for b in first}.isdisjoint({b.book_id for b in third})

    async def test_sorting_descending(self, book_service: BookService) -> None:
        """sort_by/sort_dir order the result set in SQL."""
        for title in ("Sorted B", "Sorted A", "Sorted C"):
            await book_service.create_book(title=title, author="Author")

        books, _ = await book_service.list_books(
            title="Sorted", sort_by=Book.title, sort_dir=SortDir.DESC
        )

        assert [b.title for b in books] == ["Sorted C", "Sorted B", "Sorted A"]


class TestBooksAPI:
    """Test Books API endpoints."""

    async def test_create_book_endpoint(self, client: AsyncClient) -> None:
        """Test POST /api/v1/books."""
        response = await client.post(
            "/api/v1/books",
            json={
                "title": "FastAPI Guide",
                "author": "Sebastián Ramírez",
                "isbn": "978-1-234567-89-0",
                "category": "Technology",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "FastAPI Guide"
        assert data["isbn"] == "978-1-234567-89-0"

    async def test_list_books_endpoint(self, client: AsyncClient) -> None:
        """Test GET /api/v1/books returns the pagination envelope."""
        response = await client.get("/api/v1/books")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["items"], list)
        assert data["skip"] == 0
        assert data["limit"] == 100
        assert isinstance(data["total"], int)

    async def test_list_books_endpoint_paginates(self, client: AsyncClient) -> None:
        """limit is honoured and total reflects every matching row, not just the page."""
        for index in range(3):
            await client.post(
                "/api/v1/books",
                json={"title": f"Endpoint Paged {index}", "author": "Author"},
            )

        response = await client.get("/api/v1/books", params={"title": "Endpoint Paged", "limit": 2})

        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] == 3
        assert data["limit"] == 2

    async def test_list_books_endpoint_combines_filters(self, client: AsyncClient) -> None:
        """Two filters narrow the result instead of one silently winning."""
        await client.post(
            "/api/v1/books",
            json={"title": "Combined Alpha", "author": "Ann", "category": "Tech"},
        )
        await client.post(
            "/api/v1/books",
            json={"title": "Combined Beta", "author": "Bob", "category": "Tech"},
        )

        response = await client.get("/api/v1/books", params={"title": "Combined", "author": "Ann"})

        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["title"] == "Combined Alpha"

    async def test_list_books_endpoint_rejects_unknown_sort_field(
        self, client: AsyncClient
    ) -> None:
        """sort_by is an allowlist, so an arbitrary column name never reaches SQL."""
        response = await client.get("/api/v1/books", params={"sort_by": "password_hash"})
        assert response.status_code == 422

    async def test_get_book_endpoint(self, client: AsyncClient) -> None:
        """Test GET /api/v1/books/{book_id}."""
        # Create a book first
        create_response = await client.post(
            "/api/v1/books",
            json={"title": "Test Book", "author": "Test Author"},
        )
        book_id = create_response.json()["book_id"]

        # Fetch it
        response = await client.get(f"/api/v1/books/{book_id}")
        assert response.status_code == 200
        assert response.json()["title"] == "Test Book"

    async def test_get_book_not_found(self, client: AsyncClient) -> None:
        """Test GET /api/v1/books/{book_id} with non-existent ID."""
        from uuid import uuid4

        response = await client.get(f"/api/v1/books/{uuid4()}")
        assert response.status_code == 404

    async def test_update_book_endpoint(self, client: AsyncClient) -> None:
        """Test PUT /api/v1/books/{book_id}."""
        # Create a book first
        create_response = await client.post(
            "/api/v1/books",
            json={"title": "Original", "author": "Author"},
        )
        book_id = create_response.json()["book_id"]

        # Update it
        response = await client.put(
            f"/api/v1/books/{book_id}",
            json={"title": "Updated", "author": "Author"},
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Updated"

    async def test_delete_book_endpoint(self, client: AsyncClient) -> None:
        """Test DELETE /api/v1/books/{book_id}."""
        # Create a book first
        create_response = await client.post(
            "/api/v1/books",
            json={"title": "To Delete", "author": "Author"},
        )
        book_id = create_response.json()["book_id"]

        # Delete it
        response = await client.delete(f"/api/v1/books/{book_id}")
        assert response.status_code == 204

        # Verify it's gone
        response = await client.get(f"/api/v1/books/{book_id}")
        assert response.status_code == 404

    async def test_search_books_endpoint(self, client: AsyncClient) -> None:
        """Test GET /api/v1/books/search."""
        await client.post(
            "/api/v1/books",
            json={"title": "Python for Beginners", "author": "Author A"},
        )
        response = await client.get("/api/v1/books/search?title=Python")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] > 0
        assert "Python" in data["items"][0]["title"]

    async def test_search_books_missing_params(self, client: AsyncClient) -> None:
        """Test GET /api/v1/books/search without parameters."""
        response = await client.get("/api/v1/books/search")
        assert response.status_code == 400
