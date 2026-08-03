from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.repository import BaseRepository
from models import Member


class MemberRepository(BaseRepository[Member]):
    """Member repository with lookup capabilities."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Member)

    async def get_by_email(self, email: str) -> Member | None:
        """Fetch a member by exact email."""
        return await self.get_by(Member.email, email)

    async def get_by_government_id(
        self, government_id_type: str, government_id_number: str
    ) -> Member | None:
        """Fetch a member by government ID type + number combination."""
        result = await self._session.execute(
            select(Member).where(
                Member.government_id_type == government_id_type,
                Member.government_id_number == government_id_number,
            )
        )
        return result.scalar_one_or_none()
