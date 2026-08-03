from sqlalchemy.ext.asyncio import AsyncSession

from db.repository import BaseRepository
from models import Category


class CategoryRepository(BaseRepository[Category]):
    """Category repository with lookup capabilities."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Category)

    async def get_by_name(self, name: str) -> Category | None:
        """Fetch a category by exact name. Case-sensitive, matching the unique constraint."""
        return await self.get_by(Category.name, name)
