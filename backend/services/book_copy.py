import logging
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from core.exceptions import ConflictError, NotFoundError
from core.pagination import SortDir
from models import BookCopy
from models.enums import CopyCondition, CopyStatus
from repositories.book import BookRepository
from repositories.book_copy import BookCopyRepository

logger = logging.getLogger(__name__)


class BookCopyService:
    """BookCopy service with business logic."""

    def __init__(self, session: AsyncSession) -> None:
        self.repository = BookCopyRepository(session)
        self._book_repository = BookRepository(session)
        self._session = session

    async def create_copy(
        self,
        book_id: UUID,
        barcode: str,
        shelf_code: str | None = None,
        condition: CopyCondition | None = None,
        max_borrow_days: int | None = None,
        late_fee_per_day: Decimal | None = None,
    ) -> BookCopy:
        """Create a new copy of a book. Book must exist and barcode must be unique."""
        book = await self._book_repository.get_by_id(book_id)
        if not book:
            raise NotFoundError(f"Book {book_id} not found")

        existing = await self.repository.get_by_barcode(barcode)
        if existing:
            raise ConflictError(f"Book copy with barcode {barcode} already exists")

        copy_kwargs: dict[str, Any] = {"book_id": book_id, "barcode": barcode}
        if shelf_code is not None:
            copy_kwargs["shelf_code"] = shelf_code
        if condition is not None:
            copy_kwargs["condition"] = condition
        if max_borrow_days is not None:
            copy_kwargs["max_borrow_days"] = max_borrow_days
        if late_fee_per_day is not None:
            copy_kwargs["late_fee_per_day"] = late_fee_per_day

        copy = BookCopy(**copy_kwargs)
        created = await self.repository.add(copy)
        logger.info(
            "book_copy_created",
            extra={"copy_id": str(created.copy_id), "book_id": str(book_id), "barcode": barcode},
        )
        return created

    async def get_copy(self, copy_id: UUID) -> BookCopy:
        """Fetch a copy by ID."""
        copy = await self.repository.get_by_id(copy_id)
        if not copy:
            raise NotFoundError(f"Book copy {copy_id} not found")
        return copy

    async def list_copies(
        self,
        *,
        book_id: UUID | None = None,
        status: CopyStatus | None = None,
        condition: CopyCondition | None = None,
        barcode: str | None = None,
        sort_by: InstrumentedAttribute[Any] | None = None,
        sort_dir: SortDir = SortDir.ASC,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[BookCopy], int]:
        """List copies matching every supplied filter, returning the page and total.

        Filters combine, so "available copies of this book" — the query the
        borrow workflow actually needs — is a single request.
        """
        filters: list[ColumnElement[bool]] = []
        if book_id is not None:
            filters.append(BookCopy.book_id == book_id)
        if status is not None:
            filters.append(BookCopy.status == status)
        if condition is not None:
            filters.append(BookCopy.condition == condition)
        if barcode:
            filters.append(BookCopy.barcode.ilike(f"%{barcode}%"))

        copies, total = await self.repository.list_paginated(
            filters=filters,
            sort_by=sort_by,
            sort_dir=sort_dir,
            limit=limit,
            offset=offset,
        )
        return list(copies), total

    async def update_copy(self, copy_id: UUID, **fields: Any) -> BookCopy:
        """Update copy fields. Barcode must remain unique."""
        copy = await self.get_copy(copy_id)

        if "barcode" in fields and fields["barcode"] and fields["barcode"] != copy.barcode:
            existing = await self.repository.get_by_barcode(fields["barcode"])
            if existing and existing.copy_id != copy_id:
                raise ConflictError(f"Barcode {fields['barcode']} is already in use")

        for key, value in fields.items():
            if value is not None and hasattr(copy, key):
                setattr(copy, key, value)

        self._session.add(copy)
        await self._session.flush()
        logger.info("book_copy_updated", extra={"copy_id": str(copy_id)})
        return copy

    async def delete_copy(self, copy_id: UUID) -> None:
        """Delete a book copy. Fails if the copy has associated loan history."""
        copy = await self.get_copy(copy_id)
        await self.repository.delete(copy)
        try:
            await self._session.flush()
        except IntegrityError as e:
            raise ConflictError(
                f"Cannot delete book copy {copy_id}: it has associated loan records"
            ) from e
        logger.info("book_copy_deleted", extra={"copy_id": str(copy_id)})
