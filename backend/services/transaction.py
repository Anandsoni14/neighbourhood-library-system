import logging
from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import (
    LoanMemberMismatchException,
    NotFoundError,
    TransactionNotFoundException,
    TransactionNotPendingException,
)
from models import Transaction
from models.enums import PaymentMode, TransactionStatus, TransactionType
from repositories.loan import LoanRepository
from repositories.member import MemberRepository
from repositories.transaction import TransactionRepository

logger = logging.getLogger(__name__)


class TransactionService:
    """Fee & payment transaction ledger service."""

    def __init__(self, session: AsyncSession) -> None:
        self.repository = TransactionRepository(session)
        self._loan_repository = LoanRepository(session)
        self._member_repository = MemberRepository(session)
        self._session = session

    async def create_transaction(
        self,
        member_id: UUID,
        transaction_type: TransactionType,
        amount: Decimal,
        loan_id: UUID | None = None,
        payment_reference: str | None = None,
    ) -> Transaction:
        """Record a new fee or waiver against a member's ledger.

        LATE_FEE/DAMAGE_FEE transactions start PENDING and are later settled via
        record_payment/mark_failed/waive. A WAIVER is itself a settled event — it
        is created directly with status WAIVED (there's nothing left to collect).
        """
        member = await self._member_repository.get_by_id(member_id)
        if not member:
            raise NotFoundError(f"Member {member_id} not found")

        if loan_id is not None:
            loan = await self._loan_repository.get_by_id(loan_id)
            if not loan:
                raise NotFoundError(f"Loan {loan_id} not found")
            if loan.member_id != member_id:
                raise LoanMemberMismatchException(
                    f"Loan {loan_id} does not belong to member {member_id}"
                )

        status = (
            TransactionStatus.WAIVED
            if transaction_type == TransactionType.WAIVER
            else TransactionStatus.PENDING
        )

        transaction = Transaction(
            loan_id=loan_id,
            member_id=member_id,
            transaction_type=transaction_type,
            amount=amount,
            payment_reference=payment_reference,
            status=status,
        )
        created = await self.repository.add(transaction)
        logger.info(
            "transaction_created",
            extra={
                "transaction_id": str(created.transaction_id),
                "member_id": str(member_id),
                "transaction_type": str(transaction_type),
                "status": str(status),
            },
        )
        return created

    async def record_payment(
        self,
        transaction_id: UUID,
        payment_mode: PaymentMode,
        payment_reference: str | None = None,
    ) -> Transaction:
        """Record a successful payment against a PENDING fee transaction."""
        transaction = await self._get_pending(transaction_id)
        transaction.payment_mode = payment_mode
        transaction.payment_reference = payment_reference
        transaction.status = TransactionStatus.SUCCESS

        self._session.add(transaction)
        await self._session.flush()
        logger.info("transaction_paid", extra={"transaction_id": str(transaction_id)})
        return transaction

    async def mark_failed(
        self,
        transaction_id: UUID,
        payment_mode: PaymentMode | None = None,
        payment_reference: str | None = None,
    ) -> Transaction:
        """Mark a PENDING transaction's payment attempt as failed."""
        transaction = await self._get_pending(transaction_id)
        transaction.payment_mode = payment_mode
        transaction.payment_reference = payment_reference
        transaction.status = TransactionStatus.FAILED

        self._session.add(transaction)
        await self._session.flush()
        logger.info("transaction_failed", extra={"transaction_id": str(transaction_id)})
        return transaction

    async def waive_transaction(self, transaction_id: UUID) -> Transaction:
        """Waive a PENDING fee, forgiving the amount owed."""
        transaction = await self._get_pending(transaction_id)
        transaction.status = TransactionStatus.WAIVED

        self._session.add(transaction)
        await self._session.flush()
        logger.info("transaction_waived", extra={"transaction_id": str(transaction_id)})
        return transaction

    async def _get_pending(self, transaction_id: UUID) -> Transaction:
        transaction = await self.repository.get_by_id(transaction_id)
        if not transaction:
            raise TransactionNotFoundException(f"Transaction {transaction_id} not found")
        if transaction.status != TransactionStatus.PENDING:
            raise TransactionNotPendingException(
                f"Transaction {transaction_id} is not PENDING (status: {transaction.status})"
            )
        return transaction

    async def get_transaction(self, transaction_id: UUID) -> Transaction:
        """Fetch a transaction by ID."""
        transaction = await self.repository.get_by_id(transaction_id)
        if not transaction:
            raise TransactionNotFoundException(f"Transaction {transaction_id} not found")
        return transaction

    async def list_transactions(self, limit: int = 100, offset: int = 0) -> list[Transaction]:
        """List all transactions with pagination."""
        all_transactions = await self.repository.list_all()
        return list(all_transactions)[offset : offset + limit]

    async def list_transactions_by_member(self, member_id: UUID) -> list[Transaction]:
        """List all transactions for a given member."""
        return await self.repository.list_by_member(member_id)

    async def list_transactions_by_loan(self, loan_id: UUID) -> list[Transaction]:
        """List all transactions for a given loan."""
        return await self.repository.list_by_loan(loan_id)

    async def list_transactions_by_status(self, status: TransactionStatus) -> list[Transaction]:
        """List all transactions with a given status."""
        return await self.repository.list_by_status(status)
