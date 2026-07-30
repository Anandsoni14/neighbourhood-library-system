from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.repository import BaseRepository
from models import BookCopy
from models.enums import CopyStatus


class BookCopyRepository(BaseRepository[BookCopy]):
    """BookCopy repository with lookup and filtering capabilities."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, BookCopy)

    async def get_by_barcode(self, barcode: str) -> BookCopy | None:
        """Fetch a copy by its exact barcode."""
        result = await self._session.execute(select(BookCopy).where(BookCopy.barcode == barcode))
        return result.scalar_one_or_none()

    async def list_by_book(self, book_id: UUID) -> list[BookCopy]:
        """List all copies belonging to a given book."""
        result = await self._session.execute(select(BookCopy).where(BookCopy.book_id == book_id))
        return list(result.scalars().all())

    async def list_by_status(self, status: CopyStatus) -> list[BookCopy]:
        """List all copies with a given status."""
        result = await self._session.execute(select(BookCopy).where(BookCopy.status == status))
        return list(result.scalars().all())
