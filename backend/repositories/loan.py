from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.repository import BaseRepository
from models import Loan
from models.enums import LoanStatus


class LoanRepository(BaseRepository[Loan]):
    """Loan repository with lookup capabilities."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Loan)

    async def get_active_loan_for_copy(self, copy_id: UUID) -> Loan | None:
        """Fetch the current ACTIVE loan for a copy, if any — a friendly
        pre-check; the DB's unique index is the authoritative guard."""
        result = await self._session.execute(
            select(Loan).where(Loan.copy_id == copy_id, Loan.status == LoanStatus.ACTIVE)
        )
        return result.scalar_one_or_none()
