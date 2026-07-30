import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ConflictError, NotFoundError
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
        books = await book_service.list_books()
        assert len(books) >= 2

    async def test_update_book(self, book_service: BookService) -> None:
        """Test updating a book."""
        book = await book_service.create_book(title="Original Title", author="Author")
        updated = await book_service.update_book(book.book_id, title="Updated Title")
        assert updated.title == "Updated Title"

    async def test_search_books_by_title(self, book_service: BookService) -> None:
        """Test searching books by title."""
        await book_service.create_book(title="Python Basics", author="Author A")
        await book_service.create_book(title="JavaScript Basics", author="Author B")
        results = await book_service.search_books(title="Python")
        assert len(results) == 1
        assert results[0].title == "Python Basics"

    async def test_search_books_by_isbn(self, book_service: BookService) -> None:
        """Test searching books by ISBN."""
        await book_service.create_book(title="Book A", author="Author A", isbn="ISBN-001")
        results = await book_service.search_books(isbn="ISBN-001")
        assert len(results) == 1
        assert results[0].isbn == "ISBN-001"


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
        """Test GET /api/v1/books."""
        response = await client.get("/api/v1/books")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

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
        assert len(data) > 0
        assert "Python" in data[0]["title"]

    async def test_search_books_missing_params(self, client: AsyncClient) -> None:
        """Test GET /api/v1/books/search without parameters."""
        response = await client.get("/api/v1/books/search")
        assert response.status_code == 400
