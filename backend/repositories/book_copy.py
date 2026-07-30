from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.repository import BaseRepository
from models import BookCopy


class BookCopyRepository(BaseRepository[BookCopy]):
    """BookCopy repository with lookup capabilities."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, BookCopy)

    async def get_by_barcode(self, barcode: str) -> BookCopy | None:
        """Fetch a copy by its exact barcode."""
        result = await self._session.execute(select(BookCopy).where(BookCopy.barcode == barcode))
        return result.scalar_one_or_none()
