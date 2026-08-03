from sqlalchemy.ext.asyncio import AsyncSession

from db.repository import BaseRepository
from models import BookCopy


class BookCopyRepository(BaseRepository[BookCopy]):
    """BookCopy repository with lookup capabilities."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, BookCopy)

    async def get_by_barcode(self, barcode: str) -> BookCopy | None:
        """Fetch a copy by its exact barcode."""
        return await self.get_by(BookCopy.barcode, barcode)
