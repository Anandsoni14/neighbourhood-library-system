import logging
import math
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import NamedTuple
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import (
    BookUnavailableException,
    LoanAlreadyReturnedException,
    LoanNotFoundException,
    MemberNotEligibleException,
    NotFoundError,
)
from models import Loan
from models.enums import CopyCondition, CopyStatus, LoanStatus, MembershipStatus
from repositories.book_copy import BookCopyRepository
from repositories.loan import LoanRepository
from repositories.member import MemberRepository
from repositories.staff import StaffRepository

logger = logging.getLogger(__name__)


class OverdueLoan(NamedTuple):
    """An overdue loan paired with its as-of-now overdue day count and fine estimate."""

    loan: Loan
    days_overdue: int
    estimated_fine: Decimal


class LoanService:
    """Loan service: issue and return borrow transactions."""

    def __init__(self, session: AsyncSession) -> None:
        self.repository = LoanRepository(session)
        self._copy_repository = BookCopyRepository(session)
        self._member_repository = MemberRepository(session)
        self._staff_repository = StaffRepository(session)
        self._session = session

    async def issue_loan(
        self,
        copy_id: UUID,
        member_id: UUID,
        issued_by_staff_id: UUID,
        remarks: str | None = None,
    ) -> Loan:
        """Issue a loan: member must be ACTIVE, copy must be AVAILABLE.

        due_at is always computed server-side from the copy's max_borrow_days
        — clients never supply it directly.
        """
        member = await self._member_repository.get_by_id(member_id)
        if not member:
            raise NotFoundError(f"Member {member_id} not found")
        if member.membership_status != MembershipStatus.ACTIVE:
            raise MemberNotEligibleException(
                f"Member {member_id} has status {member.membership_status} and cannot borrow"
            )

        copy = await self._copy_repository.get_by_id(copy_id)
        if not copy:
            raise NotFoundError(f"Book copy {copy_id} not found")
        if copy.status != CopyStatus.AVAILABLE:
            raise BookUnavailableException(
                f"Book copy {copy_id} is not available (status: {copy.status})"
            )

        staff = await self._staff_repository.get_by_id(issued_by_staff_id)
        if not staff:
            raise NotFoundError(f"Staff {issued_by_staff_id} not found")

        # Friendly pre-check; the DB's partial unique index (one_active_loan_per_copy)
        # is the authoritative guard against a concurrent-request race.
        if await self.repository.get_active_loan_for_copy(copy_id):
            raise BookUnavailableException(f"Book copy {copy_id} already has an active loan")

        borrowed_at = datetime.now(UTC)
        due_at = borrowed_at + timedelta(days=copy.max_borrow_days)

        loan = Loan(
            copy_id=copy_id,
            member_id=member_id,
            issued_by_staff_id=issued_by_staff_id,
            borrowed_at=borrowed_at,
            due_at=due_at,
            borrow_condition=copy.condition,
            remarks=remarks,
        )
        copy.status = CopyStatus.BORROWED
        self._session.add(copy)

        try:
            created = await self.repository.add(loan)
        except IntegrityError as e:
            raise BookUnavailableException(f"Book copy {copy_id} already has an active loan") from e

        logger.info(
            "loan_issued",
            extra={
                "loan_id": str(created.loan_id),
                "copy_id": str(copy_id),
                "member_id": str(member_id),
            },
        )
        return created

    async def return_loan(
        self,
        loan_id: UUID,
        return_condition: CopyCondition,
        received_by_staff_id: UUID,
        remarks: str | None = None,
    ) -> Loan:
        """Return a loan: computes overdue fine and updates the copy's condition/status."""
        loan = await self.repository.get_by_id(loan_id)
        if not loan:
            raise LoanNotFoundException(f"Loan {loan_id} not found")
        if loan.status != LoanStatus.ACTIVE:
            raise LoanAlreadyReturnedException(f"Loan {loan_id} has already been returned")

        staff = await self._staff_repository.get_by_id(received_by_staff_id)
        if not staff:
            raise NotFoundError(f"Staff {received_by_staff_id} not found")

        copy = await self._copy_repository.get_by_id(loan.copy_id)
        if not copy:
            raise NotFoundError(f"Book copy {loan.copy_id} not found")

        returned_at = datetime.now(UTC)
        calculated_fine = self._calculate_fine(loan.due_at, returned_at, copy.late_fee_per_day)

        loan.status = LoanStatus.RETURNED
        loan.returned_at = returned_at
        loan.return_condition = return_condition
        loan.received_by_staff_id = received_by_staff_id
        loan.calculated_fine = calculated_fine
        loan.closed_at = returned_at
        if remarks is not None:
            loan.remarks = remarks

        copy.condition = return_condition
        copy.status = (
            CopyStatus.MAINTENANCE
            if return_condition == CopyCondition.DAMAGED
            else CopyStatus.AVAILABLE
        )

        self._session.add(loan)
        self._session.add(copy)
        await self._session.flush()

        logger.info(
            "loan_returned",
            extra={"loan_id": str(loan_id), "calculated_fine": str(calculated_fine)},
        )
        return loan

    @staticmethod
    def _overdue_days(due_at: datetime, as_of: datetime) -> int:
        """Any part of a day overdue counts as a full day (ceiling), the standard
        library late-fee convention."""
        if as_of <= due_at:
            return 0
        return math.ceil((as_of - due_at).total_seconds() / 86400)

    @staticmethod
    def _calculate_fine(
        due_at: datetime, returned_at: datetime, late_fee_per_day: Decimal
    ) -> Decimal:
        overdue_days = LoanService._overdue_days(due_at, returned_at)
        if overdue_days == 0:
            return Decimal("0.00")
        return (Decimal(overdue_days) * late_fee_per_day).quantize(Decimal("0.01"))

    async def get_loan(self, loan_id: UUID) -> Loan:
        """Fetch a loan by ID."""
        loan = await self.repository.get_by_id(loan_id)
        if not loan:
            raise LoanNotFoundException(f"Loan {loan_id} not found")
        return loan

    async def list_loans(self, limit: int = 100, offset: int = 0) -> list[Loan]:
        """List all loans with pagination."""
        all_loans = await self.repository.list_all()
        return list(all_loans)[offset : offset + limit]

    async def list_loans_by_member(self, member_id: UUID) -> list[Loan]:
        """List all loans for a given member."""
        return await self.repository.list_by_member(member_id)

    async def list_loans_by_status(self, status: LoanStatus) -> list[Loan]:
        """List all loans with a given status."""
        return await self.repository.list_by_status(status)

    async def get_overdue_loans(self, as_of: datetime | None = None) -> list[OverdueLoan]:
        """List ACTIVE loans past due, with each one's current overdue day count
        and estimated fine (the loan hasn't been returned, so calculated_fine is
        still 0 on the row itself)."""
        as_of = as_of or datetime.now(UTC)
        loans = await self.repository.list_overdue(as_of)
        return [
            OverdueLoan(
                loan=loan,
                days_overdue=self._overdue_days(loan.due_at, as_of),
                estimated_fine=self._calculate_fine(loan.due_at, as_of, loan.copy.late_fee_per_day),
            )
            for loan in loans
        ]
