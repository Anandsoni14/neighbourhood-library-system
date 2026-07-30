import logging
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from core.exceptions import ConflictError, NotFoundError
from core.pagination import SortDir
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

    async def list_books(
        self,
        *,
        title: str | None = None,
        isbn: str | None = None,
        category: str | None = None,
        author: str | None = None,
        sort_by: InstrumentedAttribute[Any] | None = None,
        sort_dir: SortDir = SortDir.ASC,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Book], int]:
        """List books matching every supplied filter, returning the page and total.

        Text filters are case-insensitive substring matches; ISBN is exact,
        since it is a unique identifier rather than a search term.
        """
        filters: list[ColumnElement[bool]] = []
        if title:
            filters.append(Book.title.ilike(f"%{title}%"))
        if author:
            filters.append(Book.author.ilike(f"%{author}%"))
        if category:
            filters.append(Book.category.ilike(f"%{category}%"))
        if isbn:
            filters.append(Book.isbn == isbn)

        books, total = await self.repository.list_paginated(
            filters=filters,
            sort_by=sort_by,
            sort_dir=sort_dir,
            limit=limit,
            offset=offset,
        )
        return list(books), total

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
