from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.repository import BaseRepository
from models import Member
from models.enums import MembershipStatus


class MemberRepository(BaseRepository[Member]):
    """Member repository with lookup and filtering capabilities."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Member)

    async def get_by_email(self, email: str) -> Member | None:
        """Fetch a member by exact email."""
        result = await self._session.execute(select(Member).where(Member.email == email))
        return result.scalar_one_or_none()

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

    async def search_by_name(self, name: str) -> list[Member]:
        """Search members by first or last name (case-insensitive substring match)."""
        pattern = f"%{name}%"
        result = await self._session.execute(
            select(Member).where(
                (Member.first_name.ilike(pattern)) | (Member.last_name.ilike(pattern))
            )
        )
        return list(result.scalars().all())

    async def list_by_status(self, status: MembershipStatus) -> list[Member]:
        """List all members with a given membership status."""
        result = await self._session.execute(
            select(Member).where(Member.membership_status == status)
        )
        return list(result.scalars().all())
