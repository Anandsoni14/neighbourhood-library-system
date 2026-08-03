import logging
from decimal import Decimal
from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from core.exceptions import (
    LoanMemberMismatchException,
    NotFoundError,
    TransactionNotFoundException,
    TransactionNotPendingException,
)
from core.pagination import SortDir
from models import Transaction
from models.enums import PaymentMode, TransactionStatus, TransactionType
from repositories.loan import LoanRepository
from repositories.member import MemberRepository
from repositories.transaction import TransactionRepository

logger = logging.getLogger(__name__)


class TransactionSortField(StrEnum):
    """Columns a transaction listing may be sorted by."""

    CREATED_AT = "created_at"
    AMOUNT = "amount"
    STATUS = "status"
    TRANSACTION_TYPE = "transaction_type"


_SORT_COLUMNS: dict[TransactionSortField, InstrumentedAttribute[Any]] = {
    TransactionSortField.CREATED_AT: Transaction.created_at,
    TransactionSortField.AMOUNT: Transaction.amount,
    TransactionSortField.STATUS: Transaction.status,
    TransactionSortField.TRANSACTION_TYPE: Transaction.transaction_type,
}


class TransactionService:
    """Fee & payment transaction ledger service."""

    def __init__(self, session: AsyncSession) -> None:
        self.repository = TransactionRepository(session)
        self._loan_repository = LoanRepository(session)
        self._member_repository = MemberRepository(session)

    async def create_transaction(
        self,
        member_id: UUID,
        transaction_type: TransactionType,
        amount: Decimal,
        loan_id: UUID | None = None,
        payment_reference: str | None = None,
    ) -> Transaction:
        """Record a new fee or waiver. LATE_FEE/DAMAGE_FEE start PENDING and are
        settled later via record_payment/mark_failed/waive; WAIVER is created
        already WAIVED."""
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

        await self.repository.save(transaction)
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

        await self.repository.save(transaction)
        logger.info("transaction_failed", extra={"transaction_id": str(transaction_id)})
        return transaction

    async def waive_transaction(self, transaction_id: UUID) -> Transaction:
        """Waive a PENDING fee, forgiving the amount owed."""
        transaction = await self._get_pending(transaction_id)
        transaction.status = TransactionStatus.WAIVED

        await self.repository.save(transaction)
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

    async def list_transactions(
        self,
        *,
        member_id: UUID | None = None,
        loan_id: UUID | None = None,
        status: TransactionStatus | None = None,
        transaction_type: TransactionType | None = None,
        sort_by: TransactionSortField = TransactionSortField.CREATED_AT,
        sort_dir: SortDir = SortDir.ASC,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Transaction], int]:
        """List transactions matching every supplied filter, returning page and total."""
        filters: list[ColumnElement[bool]] = []
        if member_id is not None:
            filters.append(Transaction.member_id == member_id)
        if loan_id is not None:
            filters.append(Transaction.loan_id == loan_id)
        if status is not None:
            filters.append(Transaction.status == status)
        if transaction_type is not None:
            filters.append(Transaction.transaction_type == transaction_type)

        transactions, total = await self.repository.list_paginated(
            filters=filters,
            sort_by=_SORT_COLUMNS[sort_by],
            sort_dir=sort_dir,
            limit=limit,
            offset=offset,
        )
        return list(transactions), total
