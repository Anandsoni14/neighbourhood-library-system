from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ConflictError, NotFoundError
from core.pagination import SortDir
from models import Book, Category
from services.book import BookService
from services.book_copy import BookCopyService
from services.category import CategoryService


@pytest.fixture
async def book_service(db: AsyncSession) -> BookService:
    """Provide a BookService instance."""
    return BookService(db)


@pytest.fixture
async def category_service(db: AsyncSession) -> CategoryService:
    return CategoryService(db)


@pytest.fixture
async def copy_service(db: AsyncSession) -> BookCopyService:
    return BookCopyService(db)


class TestBookService:
    """Test BookService business logic."""

    async def test_create_book(
        self, book_service: BookService, category_service: CategoryService
    ) -> None:
        """Test creating a new book."""
        category = await category_service.create_category(name="Technology")
        book = await book_service.create_book(
            title="Clean Code",
            author="Robert C. Martin",
            isbn="978-0132350884",
            category_id=category.category_id,
            published_year=2008,
        )
        assert book.title == "Clean Code"
        assert book.isbn == "978-0132350884"
        assert book.category_id == category.category_id
        assert book.is_archived is False
        assert book.book_id is not None

    async def test_create_book_duplicate_isbn_raises_conflict(
        self, book_service: BookService
    ) -> None:
        """Test that duplicate ISBN raises ConflictError."""
        await book_service.create_book(title="Book A", author="Author A", isbn="123-456")
        with pytest.raises(ConflictError):
            await book_service.create_book(title="Book B", author="Author B", isbn="123-456")

    async def test_create_book_unknown_category_raises_not_found(
        self, book_service: BookService
    ) -> None:
        with pytest.raises(NotFoundError):
            await book_service.create_book(title="Book A", author="Author A", category_id=uuid4())

    async def test_create_book_archived_category_raises_conflict(
        self, book_service: BookService, category_service: CategoryService
    ) -> None:
        category = await category_service.create_category(name="Old Category")
        await category_service.archive_category(category.category_id)
        with pytest.raises(ConflictError):
            await book_service.create_book(
                title="Book A", author="Author A", category_id=category.category_id
            )

    async def test_get_book(self, book_service: BookService) -> None:
        """Test fetching a book by ID."""
        created = await book_service.create_book(title="Test Book", author="Test Author")
        fetched = await book_service.get_book(created.book_id)
        assert fetched.book_id == created.book_id
        assert fetched.title == "Test Book"

    async def test_get_book_not_found_raises(self, book_service: BookService) -> None:
        """Test that fetching non-existent book raises NotFoundError."""
        with pytest.raises(NotFoundError):
            await book_service.get_book(uuid4())

    async def test_list_books(self, book_service: BookService) -> None:
        """Test listing books."""
        await book_service.create_book(title="Book 1", author="Author 1")
        await book_service.create_book(title="Book 2", author="Author 2")
        books, total = await book_service.list_books()
        assert len(books) >= 2
        assert total >= 2

    async def test_list_books_excludes_archived_by_default(self, book_service: BookService) -> None:
        active = await book_service.create_book(title="Archive Default Active", author="Author")
        archived = await book_service.create_book(title="Archive Default Archived", author="Author")
        await book_service.archive_book(archived.book_id)

        results, _total = await book_service.list_books(title="Archive Default")

        ids = {b.book_id for b in results}
        assert active.book_id in ids
        assert archived.book_id not in ids

    async def test_list_books_archived_only(self, book_service: BookService) -> None:
        active = await book_service.create_book(title="Archive Only Active", author="Author")
        archived = await book_service.create_book(title="Archive Only Archived", author="Author")
        await book_service.archive_book(archived.book_id)

        results, total = await book_service.list_books(title="Archive Only", is_archived=True)

        assert total == 1
        assert results[0].book_id == archived.book_id
        assert active.book_id not in {b.book_id for b in results}

    async def test_list_books_all_includes_both(self, book_service: BookService) -> None:
        active = await book_service.create_book(title="Archive All Active", author="Author")
        archived = await book_service.create_book(title="Archive All Archived", author="Author")
        await book_service.archive_book(archived.book_id)

        results, total = await book_service.list_books(title="Archive All", is_archived=None)

        assert total == 2
        assert {active.book_id, archived.book_id} == {b.book_id for b in results}

    async def test_archive_book_is_idempotent(self, book_service: BookService) -> None:
        book = await book_service.create_book(title="Idempotent Archive", author="Author")
        await book_service.archive_book(book.book_id)
        archived_again = await book_service.archive_book(book.book_id)
        assert archived_again.is_archived is True

    async def test_unarchive_book_restores(self, book_service: BookService) -> None:
        book = await book_service.create_book(title="Unarchive Me", author="Author")
        await book_service.archive_book(book.book_id)
        restored = await book_service.unarchive_book(book.book_id)
        assert restored.is_archived is False

    async def test_update_book(self, book_service: BookService) -> None:
        """Test updating a book."""
        book = await book_service.create_book(title="Original Title", author="Author")
        updated = await book_service.update_book(book.book_id, title="Updated Title")
        assert updated.title == "Updated Title"

    async def test_update_book_unknown_category_raises_not_found(
        self, book_service: BookService
    ) -> None:
        book = await book_service.create_book(title="Recategorize Me", author="Author")
        with pytest.raises(NotFoundError):
            await book_service.update_book(book.book_id, category_id=uuid4())

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

    async def test_list_books_isbn_substring_match(self, book_service: BookService) -> None:
        """ISBN filtering is a substring match, like title/author, not exact."""
        await book_service.create_book(
            title="Substring ISBN Book", author="Author", isbn="978-0-13-235088-4"
        )

        results, total = await book_service.list_books(isbn="235088")

        assert total == 1
        assert results[0].title == "Substring ISBN Book"

    async def test_list_books_in_stock_true_returns_only_books_with_available_copy(
        self, book_service: BookService, copy_service: BookCopyService
    ) -> None:
        in_stock_book = await book_service.create_book(title="In Stock Book", author="Author")
        await copy_service.create_copy(book_id=in_stock_book.book_id, barcode=f"BC-{uuid4()}")
        await book_service.create_book(title="Out Of Stock Book", author="Author")

        results, total = await book_service.list_books(title="Book", in_stock=True)

        assert total == 1
        assert results[0].title == "In Stock Book"

    async def test_list_books_in_stock_false_returns_only_books_without_available_copy(
        self, book_service: BookService, copy_service: BookCopyService
    ) -> None:
        in_stock_book = await book_service.create_book(title="Stocked Book", author="Author")
        await copy_service.create_copy(book_id=in_stock_book.book_id, barcode=f"BC-{uuid4()}")
        await book_service.create_book(title="Unstocked Book", author="Author")

        results, total = await book_service.list_books(title="Book", in_stock=False)

        assert total == 1
        assert results[0].title == "Unstocked Book"

    async def test_filters_combine(
        self, book_service: BookService, category_service: CategoryService
    ) -> None:
        """Filters are ANDed: a title match with a non-matching category excludes the row."""
        focus = await category_service.create_category(name="Focus")
        ai = await category_service.create_category(name="AI")
        await book_service.create_book(
            title="Deep Work", author="Newport", category_id=focus.category_id
        )
        await book_service.create_book(
            title="Deep Learning", author="Goodfellow", category_id=ai.category_id
        )

        matching, total = await book_service.list_books(title="Deep", category_id=ai.category_id)

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

    async def test_sorting_by_category_name_outer_joins(
        self, book_service: BookService, category_service: CategoryService
    ) -> None:
        """Sorting by category name uses an OUTER join: a book with no category
        still appears (as NULL) rather than being silently dropped, and `total`
        is unaffected by the join (a book can only have one category)."""
        zeta = await category_service.create_category(name="Zeta Sort Category")
        await book_service.create_book(
            title="Sort Cat With Category", author="Author", category_id=zeta.category_id
        )
        await book_service.create_book(title="Sort Cat No Category", author="Author")

        results, total = await book_service.list_books(
            title="Sort Cat", sort_by=Category.name, sort_dir=SortDir.ASC
        )

        assert total == 2
        assert {b.title for b in results} == {
            "Sort Cat With Category",
            "Sort Cat No Category",
        }


class TestBooksAPI:
    """Test Books API endpoints."""

    async def test_create_book_endpoint(
        self,
        client: AsyncClient,
        librarian_headers: dict[str, str],
    ) -> None:
        """Test POST /api/v1/books."""
        category_response = await client.post(
            "/api/v1/categories", json={"name": "API Technology"}, headers=librarian_headers
        )
        category_id = category_response.json()["category_id"]

        response = await client.post(
            "/api/v1/books",
            json={
                "title": "FastAPI Guide",
                "author": "Sebastián Ramírez",
                "isbn": "978-1-234567-89-0",
                "category_id": category_id,
            },
            headers=librarian_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "FastAPI Guide"
        assert data["isbn"] == "978-1-234567-89-0"
        assert data["category"]["name"] == "API Technology"
        assert data["is_archived"] is False

    async def test_create_book_endpoint_no_token_401(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/books", json={"title": "No Token Book", "author": "Author"}
        )
        assert response.status_code == 401

    async def test_create_book_endpoint_unknown_category_404(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        response = await client.post(
            "/api/v1/books",
            json={"title": "Orphan Category Book", "author": "Author", "category_id": str(uuid4())},
            headers=librarian_headers,
        )
        assert response.status_code == 404

    async def test_create_book_endpoint_blank_title_422(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        """Blank and whitespace-only titles are both rejected, not stored."""
        for title in ["", "   "]:
            response = await client.post(
                "/api/v1/books",
                json={"title": title, "author": "Author"},
                headers=librarian_headers,
            )
            assert response.status_code == 422

    async def test_create_book_endpoint_title_too_long_422(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        response = await client.post(
            "/api/v1/books",
            json={"title": "x" * 256, "author": "Author"},
            headers=librarian_headers,
        )
        assert response.status_code == 422

    async def test_create_book_endpoint_published_year_out_of_range_422(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        response = await client.post(
            "/api/v1/books",
            json={"title": "Future Book", "author": "Author", "published_year": 3000},
            headers=librarian_headers,
        )
        assert response.status_code == 422

    async def test_list_books_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        """Test GET /api/v1/books returns the pagination envelope."""
        response = await client.get("/api/v1/books", headers=librarian_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["items"], list)
        assert data["skip"] == 0
        assert data["limit"] == 100
        assert isinstance(data["total"], int)

    async def test_list_books_endpoint_paginates(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        """limit is honoured and total reflects every matching row, not just the page."""
        for index in range(3):
            await client.post(
                "/api/v1/books",
                json={"title": f"Endpoint Paged {index}", "author": "Author"},
                headers=librarian_headers,
            )

        response = await client.get(
            "/api/v1/books",
            params={"title": "Endpoint Paged", "limit": 2},
            headers=librarian_headers,
        )

        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] == 3
        assert data["limit"] == 2

    async def test_list_books_endpoint_combines_filters(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        """Two filters narrow the result instead of one silently winning."""
        category_response = await client.post(
            "/api/v1/categories", json={"name": "Combined Tech"}, headers=librarian_headers
        )
        category_id = category_response.json()["category_id"]
        await client.post(
            "/api/v1/books",
            json={"title": "Combined Alpha", "author": "Ann", "category_id": category_id},
            headers=librarian_headers,
        )
        await client.post(
            "/api/v1/books",
            json={"title": "Combined Beta", "author": "Bob", "category_id": category_id},
            headers=librarian_headers,
        )

        response = await client.get(
            "/api/v1/books",
            params={"title": "Combined", "author": "Ann"},
            headers=librarian_headers,
        )

        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["title"] == "Combined Alpha"

    async def test_list_books_endpoint_filters_by_in_stock(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        stocked_resp = await client.post(
            "/api/v1/books",
            json={"title": "Endpoint Stocked Book", "author": "Author"},
            headers=librarian_headers,
        )
        stocked_book_id = stocked_resp.json()["book_id"]
        await client.post(
            "/api/v1/book-copies",
            json={"book_id": stocked_book_id, "barcode": f"BC-{uuid4()}"},
            headers=librarian_headers,
        )
        await client.post(
            "/api/v1/books",
            json={"title": "Endpoint Unstocked Book", "author": "Author"},
            headers=librarian_headers,
        )

        response = await client.get(
            "/api/v1/books",
            params={"title": "Endpoint", "in_stock": "true"},
            headers=librarian_headers,
        )

        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["title"] == "Endpoint Stocked Book"

    async def test_list_books_endpoint_filters_by_category_id(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        first_category = (
            await client.post(
                "/api/v1/categories", json={"name": "Filter Cat One"}, headers=librarian_headers
            )
        ).json()
        second_category = (
            await client.post(
                "/api/v1/categories", json={"name": "Filter Cat Two"}, headers=librarian_headers
            )
        ).json()
        await client.post(
            "/api/v1/books",
            json={
                "title": "Filter Cat Book One",
                "author": "Author",
                "category_id": first_category["category_id"],
            },
            headers=librarian_headers,
        )
        await client.post(
            "/api/v1/books",
            json={
                "title": "Filter Cat Book Two",
                "author": "Author",
                "category_id": second_category["category_id"],
            },
            headers=librarian_headers,
        )

        response = await client.get(
            "/api/v1/books",
            params={"category_id": first_category["category_id"]},
            headers=librarian_headers,
        )

        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["title"] == "Filter Cat Book One"

    async def test_list_books_endpoint_rejects_unknown_sort_field(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        """sort_by is an allowlist, so an arbitrary column name never reaches SQL."""
        response = await client.get(
            "/api/v1/books", params={"sort_by": "password_hash"}, headers=librarian_headers
        )
        assert response.status_code == 422

    async def test_get_book_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        """Test GET /api/v1/books/{book_id}."""
        create_response = await client.post(
            "/api/v1/books",
            json={"title": "Test Book", "author": "Test Author"},
            headers=librarian_headers,
        )
        book_id = create_response.json()["book_id"]

        response = await client.get(f"/api/v1/books/{book_id}", headers=librarian_headers)
        assert response.status_code == 200
        assert response.json()["title"] == "Test Book"

    async def test_get_book_not_found(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        """Test GET /api/v1/books/{book_id} with non-existent ID."""
        response = await client.get(f"/api/v1/books/{uuid4()}", headers=librarian_headers)
        assert response.status_code == 404

    async def test_update_book_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        """Test PUT /api/v1/books/{book_id}."""
        create_response = await client.post(
            "/api/v1/books",
            json={"title": "Original", "author": "Author"},
            headers=librarian_headers,
        )
        book_id = create_response.json()["book_id"]

        response = await client.put(
            f"/api/v1/books/{book_id}",
            json={"title": "Updated", "author": "Author"},
            headers=librarian_headers,
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Updated"

    async def test_delete_book_endpoint_is_gone(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        """DELETE is removed entirely (books archive instead); the route
        returning 405 rather than 404 confirms it's a deliberate removal, not
        a typo in the path."""
        create_response = await client.post(
            "/api/v1/books",
            json={"title": "Cannot Delete Me", "author": "Author"},
            headers=librarian_headers,
        )
        book_id = create_response.json()["book_id"]

        response = await client.delete(f"/api/v1/books/{book_id}", headers=librarian_headers)
        assert response.status_code == 405

    async def test_archive_book_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        create_response = await client.post(
            "/api/v1/books",
            json={"title": "To Archive", "author": "Author"},
            headers=librarian_headers,
        )
        book_id = create_response.json()["book_id"]

        response = await client.post(f"/api/v1/books/{book_id}/archive", headers=librarian_headers)
        assert response.status_code == 200
        assert response.json()["is_archived"] is True

        # Archived books drop out of the default (active-only) listing.
        list_response = await client.get(
            "/api/v1/books", params={"title": "To Archive"}, headers=librarian_headers
        )
        assert list_response.json()["total"] == 0

        # ...but are findable via the archived and all filters.
        archived_response = await client.get(
            "/api/v1/books",
            params={"title": "To Archive", "archived": "archived"},
            headers=librarian_headers,
        )
        assert archived_response.json()["total"] == 1
        all_response = await client.get(
            "/api/v1/books",
            params={"title": "To Archive", "archived": "all"},
            headers=librarian_headers,
        )
        assert all_response.json()["total"] == 1

    async def test_unarchive_book_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        create_response = await client.post(
            "/api/v1/books",
            json={"title": "Archive Then Restore", "author": "Author"},
            headers=librarian_headers,
        )
        book_id = create_response.json()["book_id"]
        await client.post(f"/api/v1/books/{book_id}/archive", headers=librarian_headers)

        response = await client.post(
            f"/api/v1/books/{book_id}/unarchive", headers=librarian_headers
        )
        assert response.status_code == 200
        assert response.json()["is_archived"] is False

        list_response = await client.get(
            "/api/v1/books", params={"title": "Archive Then Restore"}, headers=librarian_headers
        )
        assert list_response.json()["total"] == 1

    async def test_search_books_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        """Test GET /api/v1/books/search."""
        await client.post(
            "/api/v1/books",
            json={"title": "Python for Beginners", "author": "Author A"},
            headers=librarian_headers,
        )
        response = await client.get("/api/v1/books/search?title=Python", headers=librarian_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] > 0
        assert "Python" in data["items"][0]["title"]

    async def test_search_books_missing_params(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        """Test GET /api/v1/books/search without parameters."""
        response = await client.get("/api/v1/books/search", headers=librarian_headers)
        assert response.status_code == 422
