from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.repository import BaseRepository
from models import Loan
from models.enums import LoanStatus


class LoanRepository(BaseRepository[Loan]):
    """Loan repository with lookup and filtering capabilities."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Loan)

    async def get_active_loan_for_copy(self, copy_id: UUID) -> Loan | None:
        """Fetch the current ACTIVE loan for a copy, if any.

        Mirrors the DB's partial unique index (one_active_loan_per_copy)
        predicate exactly. This is a friendly pre-check only — the index
        itself is the authoritative concurrency guard.
        """
        result = await self._session.execute(
            select(Loan).where(Loan.copy_id == copy_id, Loan.status == LoanStatus.ACTIVE)
        )
        return result.scalar_one_or_none()

    async def list_by_member(self, member_id: UUID) -> list[Loan]:
        """List all loans for a given member."""
        result = await self._session.execute(select(Loan).where(Loan.member_id == member_id))
        return list(result.scalars().all())

    async def list_by_status(self, status: LoanStatus) -> list[Loan]:
        """List all loans with a given status."""
        result = await self._session.execute(select(Loan).where(Loan.status == status))
        return list(result.scalars().all())
