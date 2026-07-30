from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.repository import BaseRepository
from models import Transaction
from models.enums import TransactionStatus


class TransactionRepository(BaseRepository[Transaction]):
    """Transaction repository with lookup and filtering capabilities."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Transaction)

    async def list_by_member(self, member_id: UUID) -> list[Transaction]:
        """List all transactions for a given member."""
        result = await self._session.execute(
            select(Transaction).where(Transaction.member_id == member_id)
        )
        return list(result.scalars().all())

    async def list_by_loan(self, loan_id: UUID) -> list[Transaction]:
        """List all transactions for a given loan."""
        result = await self._session.execute(
            select(Transaction).where(Transaction.loan_id == loan_id)
        )
        return list(result.scalars().all())

    async def list_by_status(self, status: TransactionStatus) -> list[Transaction]:
        """List all transactions with a given status."""
        result = await self._session.execute(
            select(Transaction).where(Transaction.status == status)
        )
        return list(result.scalars().all())
