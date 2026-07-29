from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.repository import BaseRepository
from models import Staff


class StaffRepository(BaseRepository[Staff]):
    """Staff repository with lookup capabilities."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Staff)

    async def get_by_email(self, email: str) -> Staff | None:
        """Fetch staff by exact email."""
        result = await self._session.execute(select(Staff).where(Staff.email == email))
        return result.scalar_one_or_none()

    async def get_by_employee_code(self, employee_code: str) -> Staff | None:
        """Fetch staff by exact employee code."""
        result = await self._session.execute(
            select(Staff).where(Staff.employee_code == employee_code)
        )
        return result.scalar_one_or_none()
