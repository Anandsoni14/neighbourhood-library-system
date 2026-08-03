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
        return await self.get_by(Staff.email, email)

    async def get_by_employee_code(self, employee_code: str) -> Staff | None:
        """Fetch staff by exact employee code."""
        return await self.get_by(Staff.employee_code, employee_code)

    async def count_active_admins(self) -> int:
        """Count ACTIVE staff with the ADMIN role — used to refuse deactivating the last one."""
        result = await self._session.execute(
            select(func.count())
            .select_from(Staff)
            .where(Staff.role == StaffRole.ADMIN, Staff.status == StaffStatus.ACTIVE)
        )
        return result.scalar_one()
