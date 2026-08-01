import logging
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, exists
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from core.exceptions import ConflictError, NotFoundError
from core.pagination import SortDir
from models import Book, BookCopy
from models.enums import CopyStatus
from repositories.book import BookRepository
from repositories.category import CategoryRepository

logger = logging.getLogger(__name__)


class BookService:
    """Book service with business logic."""

    def __init__(self, session: AsyncSession) -> None:
        self.repository = BookRepository(session)
        self.category_repository = CategoryRepository(session)
        self._session = session

    async def _validate_category(self, category_id: UUID | None) -> None:
        """Reject an unknown/archived category with a 404, before the FK raises a 500."""
        if category_id is None:
            return
        category = await self.category_repository.get_by_id(category_id)
        if not category:
            raise NotFoundError(f"Category {category_id} not found")
        if category.is_archived:
            raise ConflictError(f"Category '{category.name}' is archived")

    async def create_book(
        self,
        title: str,
        author: str,
        publisher: str | None = None,
        isbn: str | None = None,
        category_id: UUID | None = None,
        description: str | None = None,
        published_year: int | None = None,
    ) -> Book:
        """Create a new book. ISBN must be unique if provided."""
        if isbn:
            existing = await self.repository.search_by_isbn(isbn)
            if existing:
                raise ConflictError(f"Book with ISBN {isbn} already exists")

        await self._validate_category(category_id)

        book = Book(
            title=title,
            author=author,
            publisher=publisher,
            isbn=isbn,
            category_id=category_id,
            description=description,
            published_year=published_year,
        )
        created = await self.repository.add(book)
        # add() only flushes; `category` stays unloaded until refreshed here,
        # so the sync BookResponse.model_validate() below doesn't lazy-load.
        await self._session.refresh(created, attribute_names=["category"])
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
        category_id: UUID | None = None,
        author: str | None = None,
        is_archived: bool | None = False,
        in_stock: bool | None = None,
        sort_by: InstrumentedAttribute[Any] | None = None,
        sort_dir: SortDir = SortDir.ASC,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Book], int]:
        """List books matching every supplied filter, returning the page and total.

        Text filters (incl. ISBN) are substring matches. `is_archived` is
        tri-state (False/True/None = active/archived/both). `in_stock` uses an
        EXISTS subquery rather than a join, which would multiply rows per copy.
        """
        filters: list[ColumnElement[bool]] = []
        if title:
            filters.append(Book.title.ilike(f"%{title}%"))
        if author:
            filters.append(Book.author.ilike(f"%{author}%"))
        if category_id:
            filters.append(Book.category_id == category_id)
        if isbn:
            filters.append(Book.isbn.ilike(f"%{isbn}%"))
        if is_archived is not None:
            filters.append(Book.is_archived.is_(is_archived))
        if in_stock is not None:
            has_available_copy = exists().where(
                BookCopy.book_id == Book.book_id,
                BookCopy.status == CopyStatus.AVAILABLE,
            )
            filters.append(has_available_copy if in_stock else ~has_available_copy)

        books, total = await self.repository.list_paginated(
            filters=filters,
            sort_by=sort_by,
            sort_dir=sort_dir,
            limit=limit,
            offset=offset,
            joins=[Book.category],
        )
        return list(books), total

    async def update_book(self, book_id: UUID, **fields: Any) -> Book:
        """Update book fields. ISBN must remain unique."""
        book = await self.get_book(book_id)

        if "isbn" in fields and fields["isbn"] and fields["isbn"] != book.isbn:
            existing = await self.repository.search_by_isbn(fields["isbn"])
            if existing and existing.book_id != book_id:
                raise ConflictError(f"ISBN {fields['isbn']} is already in use")

        if "category_id" in fields:
            await self._validate_category(fields["category_id"])

        for key, value in fields.items():
            if hasattr(book, key):
                setattr(book, key, value)

        self._session.add(book)
        await self._session.flush()
        if "category_id" in fields:
            # Refresh: `book.category` was loaded for the *old* category_id.
            await self._session.refresh(book, attribute_names=["category"])
        logger.info("book_updated", extra={"book_id": str(book_id)})
        return book

    # Deliberately no delete_book: a book with copies can't be removed without
    # destroying loan history. Archiving is reversible and preserves it.
    async def archive_book(self, book_id: UUID) -> Book:
        """Archive a book, hiding it from the default listing. Idempotent.

        Copy rows are left untouched — CopyStatus is physical state, is_archived
        is a catalogue decision, and the two shouldn't be conflated.
        """
        book = await self.get_book(book_id)
        book.is_archived = True
        self._session.add(book)
        await self._session.flush()
        logger.info("book_archived", extra={"book_id": str(book_id)})
        return book

    async def unarchive_book(self, book_id: UUID) -> Book:
        """Restore an archived book. Idempotent, same rationale as archive."""
        book = await self.get_book(book_id)
        book.is_archived = False
        self._session.add(book)
        await self._session.flush()
        logger.info("book_unarchived", extra={"book_id": str(book_id)})
        return book
