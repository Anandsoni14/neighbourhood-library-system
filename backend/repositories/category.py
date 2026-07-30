from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.repository import BaseRepository
from models import Category


class CategoryRepository(BaseRepository[Category]):
    """Category repository with lookup capabilities."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Category)

    async def get_by_name(self, name: str) -> Category | None:
        """Fetch a category by exact name.

        Case-sensitive, matching the unique constraint: "Tech" and "tech" are
        two distinct categories. Folding them here would let a create silently
        resolve to a differently-spelled existing row.
        """
        result = await self._session.execute(select(Category).where(Category.name == name))
        return result.scalar_one_or_none()
