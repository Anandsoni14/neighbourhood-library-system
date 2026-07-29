from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.repository import BaseRepository
from models import Book


class BookRepository(BaseRepository[Book]):
    """Book repository with search capabilities."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Book)

    async def search_by_title(self, title: str) -> list[Book]:
        """Search books by title (case-insensitive substring match)."""
        result = await self._session.execute(select(Book).where(Book.title.ilike(f"%{title}%")))
        return list(result.scalars().all())

    async def search_by_isbn(self, isbn: str) -> Book | None:
        """Search book by exact ISBN."""
        result = await self._session.execute(select(Book).where(Book.isbn == isbn))
        return result.scalar_one_or_none()
