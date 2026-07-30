import logging
from typing import Any
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ConflictError, NotFoundError
from models import Book
from repositories.book import BookRepository

logger = logging.getLogger(__name__)


class BookService:
    """Book service with business logic."""

    def __init__(self, session: AsyncSession) -> None:
        self.repository = BookRepository(session)
        self._session = session

    async def create_book(
        self,
        title: str,
        author: str,
        publisher: str | None = None,
        isbn: str | None = None,
        category: str | None = None,
        description: str | None = None,
        published_year: int | None = None,
    ) -> Book:
        """Create a new book. ISBN must be unique if provided."""
        if isbn:
            existing = await self.repository.search_by_isbn(isbn)
            if existing:
                raise ConflictError(f"Book with ISBN {isbn} already exists")

        book = Book(
            title=title,
            author=author,
            publisher=publisher,
            isbn=isbn,
            category=category,
            description=description,
            published_year=published_year,
        )
        created = await self.repository.add(book)
        logger.info(
            "book_created",
            extra={"book_id": str(created.book_id), "isbn": isbn, "title": title},
        )
        return created

    async def get_book(self, book_id: UUID) -> Book:
        """Fetch book by ID."""
        book = await self.repository.get_by_id(book_id)
        if not book:
            raise NotFoundError(f"Book {book_id} not found")
        return book

    async def list_books(self, limit: int = 100, offset: int = 0) -> list[Book]:
        """List all books with pagination."""
        all_books = await self.repository.list_all()
        return list(all_books)[offset : offset + limit]

    async def update_book(self, book_id: UUID, **fields: Any) -> Book:
        """Update book fields. ISBN must remain unique."""
        book = await self.get_book(book_id)

        if "isbn" in fields and fields["isbn"] and fields["isbn"] != book.isbn:
            existing = await self.repository.search_by_isbn(fields["isbn"])
            if existing and existing.book_id != book_id:
                raise ConflictError(f"ISBN {fields['isbn']} is already in use")

        for key, value in fields.items():
            if hasattr(book, key):
                setattr(book, key, value)

        self._session.add(book)
        await self._session.flush()
        logger.info("book_updated", extra={"book_id": str(book_id)})
        return book

    async def delete_book(self, book_id: UUID) -> None:
        """Delete a book. Fails if it still has copies (FK RESTRICT on book_copy.book_id)."""
        book = await self.get_book(book_id)
        await self.repository.delete(book)
        try:
            await self._session.flush()
        except IntegrityError as e:
            raise ConflictError(f"Cannot delete book {book_id}: it still has copies") from e
        logger.info("book_deleted", extra={"book_id": str(book_id)})

    async def search_books(self, title: str | None = None, isbn: str | None = None) -> list[Book]:
        """Search books by title and/or ISBN."""
        if isbn:
            book = await self.repository.search_by_isbn(isbn)
            return [book] if book else []

        if title:
            return list(await self.repository.search_by_title(title))

        return list(await self.repository.list_all())
