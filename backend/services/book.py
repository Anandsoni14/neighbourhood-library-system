import logging
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from core.exceptions import ConflictError, NotFoundError
from core.pagination import SortDir
from models import Book
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
        """Reject an unknown or archived category before the FK can fire.

        Without this the database raises IntegrityError for an unknown ID, which
        surfaces as an opaque 500 rather than a 404 naming the problem.
        """
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
        # `add()` only flushes (an INSERT), which never triggers the selectin
        # loader the way a SELECT does — `category` is genuinely unloaded on a
        # freshly inserted row. Refreshing it here means the eventual
        # BookResponse.model_validate(created) call, made synchronously with no
        # `await` in api/books.py, always finds it already in memory instead of
        # attempting an implicit (and here, unsupported) lazy load.
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
        sort_by: InstrumentedAttribute[Any] | None = None,
        sort_dir: SortDir = SortDir.ASC,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Book], int]:
        """List books matching every supplied filter, returning the page and total.

        Text filters are case-insensitive substring matches; ISBN is exact,
        since it is a unique identifier rather than a search term.

        `is_archived` is tri-state: False (the default) returns only active books,
        True only archived ones, and None both. The Category join is always
        applied so `sort_by` may be Category.name; it is an OUTER join, so books
        with no category still appear.
        """
        filters: list[ColumnElement[bool]] = []
        if title:
            filters.append(Book.title.ilike(f"%{title}%"))
        if author:
            filters.append(Book.author.ilike(f"%{author}%"))
        if category_id:
            filters.append(Book.category_id == category_id)
        if isbn:
            filters.append(Book.isbn == isbn)
        if is_archived is not None:
            filters.append(Book.is_archived.is_(is_archived))

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
            # `get_book` above already loaded the *old* category via its
            # selectin query; changing category_id here leaves that loaded
            # relationship pointing at the wrong row until it's refreshed.
            await self._session.refresh(book, attribute_names=["category"])
        logger.info("book_updated", extra={"book_id": str(book_id)})
        return book

    # There is deliberately no delete_book. A catalogue keeps its history: a book
    # with copies cannot be removed without destroying the loan record attached
    # to those copies. Archiving is reversible and preserves that history.
    async def archive_book(self, book_id: UUID) -> Book:
        """Archive a book, hiding it from the default listing and blocking new loans.

        Idempotent, so a retried request behaves the same as the first one.
        Copy rows are deliberately left untouched — CopyStatus describes a
        physical state (on the shelf, lent out, lost) while is_archived is a
        catalogue decision, and flipping copies to MAINTENANCE here could not be
        undone correctly on unarchive.
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
