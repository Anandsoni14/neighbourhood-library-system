from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.repository import BaseRepository
from models import Staff
from models.enums import StaffRole, StaffStatus


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

    async def count_active_admins(self) -> int:
        """Count ACTIVE staff with the ADMIN role.

        Used to refuse deactivating the last one — without this, deactivating
        the sole remaining admin would lock every ADMIN-only endpoint (staff
        management itself included) with no recovery short of a SQL console.
        """
        result = await self._session.execute(
            select(func.count())
            .select_from(Staff)
            .where(Staff.role == StaffRole.ADMIN, Staff.status == StaffStatus.ACTIVE)
        )
        return result.scalar_one()
