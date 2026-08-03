import logging
import math
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from enum import StrEnum
from typing import Any, NamedTuple
from uuid import UUID

from sqlalchemy import ColumnElement
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute, selectinload

from core.exceptions import (
    BookUnavailableException,
    LoanAlreadyReturnedException,
    LoanNotFoundException,
    MemberNotEligibleException,
    NotFoundError,
)
from core.pagination import SortDir, name_ilike_filter
from models import Book, BookCopy, Loan, Member
from models.enums import CopyCondition, CopyStatus, LoanStatus, MembershipStatus
from repositories.book import BookRepository
from repositories.book_copy import BookCopyRepository
from repositories.loan import LoanRepository
from repositories.member import MemberRepository
from repositories.staff import StaffRepository

logger = logging.getLogger(__name__)


class LoanSortField(StrEnum):
    """Columns a loan listing may be sorted by."""

    BORROWED_AT = "borrowed_at"
    DUE_AT = "due_at"
    RETURNED_AT = "returned_at"
    STATUS = "status"
    CALCULATED_FINE = "calculated_fine"


_SORT_COLUMNS: dict[LoanSortField, InstrumentedAttribute[Any]] = {
    LoanSortField.BORROWED_AT: Loan.borrowed_at,
    LoanSortField.DUE_AT: Loan.due_at,
    LoanSortField.RETURNED_AT: Loan.returned_at,
    LoanSortField.STATUS: Loan.status,
    LoanSortField.CALCULATED_FINE: Loan.calculated_fine,
}


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
        self._book_repository = BookRepository(session)
        self._member_repository = MemberRepository(session)
        self._staff_repository = StaffRepository(session)

    async def issue_loan(
        self,
        copy_id: UUID,
        member_id: UUID,
        issued_by_staff_id: UUID,
        remarks: str | None = None,
    ) -> Loan:
        """Issue a loan: member must be ACTIVE, copy must be AVAILABLE.
        due_at is always server-computed from the copy's max_borrow_days."""
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

        # Archiving leaves copies untouched, so this is the enforcement point
        # that stops a new loan on an archived book. Returns are unaffected.
        book = await self._book_repository.get_by_id(copy.book_id)
        if book and book.is_archived:
            raise BookUnavailableException(
                f"Book {copy.book_id} is archived and cannot be borrowed"
            )

        staff = await self._staff_repository.get_by_id(issued_by_staff_id)
        if not staff:
            raise NotFoundError(f"Staff {issued_by_staff_id} not found")

        # Friendly pre-check; the DB's unique index is the authoritative guard.
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
        await self._copy_repository.save(copy)

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

        await self.repository.save(loan)
        await self._copy_repository.save(copy)

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

    @staticmethod
    def _member_and_book_filters(
        *,
        member_name: str | None,
        book_title: str | None,
        copy_barcode: str | None = None,
    ) -> tuple[list[ColumnElement[bool]], list[InstrumentedAttribute[Any]]]:
        """The member-name/book-title/copy-barcode filter+join logic shared by
        list_loans and get_overdue_loans (which doesn't take copy_barcode)."""
        filters: list[ColumnElement[bool]] = []
        if member_name:
            filters.append(name_ilike_filter(member_name, Member.first_name, Member.last_name))
        if book_title:
            filters.append(Book.title.ilike(f"%{book_title}%"))
        if copy_barcode:
            filters.append(BookCopy.barcode.ilike(f"%{copy_barcode}%"))

        joins: list[InstrumentedAttribute[Any]] = []
        if book_title or copy_barcode:
            joins.append(Loan.copy)
        if book_title:
            joins.append(BookCopy.book)
        if member_name:
            joins.append(Loan.member)
        return filters, joins

    async def list_loans(
        self,
        *,
        member_id: UUID | None = None,
        copy_id: UUID | None = None,
        status: LoanStatus | None = None,
        member_name: str | None = None,
        book_title: str | None = None,
        copy_barcode: str | None = None,
        sort_by: LoanSortField = LoanSortField.BORROWED_AT,
        sort_dir: SortDir = SortDir.ASC,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Loan], int]:
        """List loans matching every supplied filter, returning the page and total.
        `member_name`/`book_title`/`copy_barcode` are substring matches joined
        out via Member and BookCopy, so the desk can search by name, not ID.
        """
        filters: list[ColumnElement[bool]] = []
        if member_id is not None:
            filters.append(Loan.member_id == member_id)
        if copy_id is not None:
            filters.append(Loan.copy_id == copy_id)
        if status is not None:
            filters.append(Loan.status == status)

        extra_filters, joins = self._member_and_book_filters(
            member_name=member_name, book_title=book_title, copy_barcode=copy_barcode
        )
        filters.extend(extra_filters)

        loans, total = await self.repository.list_paginated(
            filters=filters,
            sort_by=_SORT_COLUMNS[sort_by],
            sort_dir=sort_dir,
            limit=limit,
            offset=offset,
            joins=joins,
        )
        return list(loans), total

    async def get_overdue_loans(
        self,
        as_of: datetime | None = None,
        *,
        member_name: str | None = None,
        book_title: str | None = None,
        sort_by: LoanSortField = LoanSortField.DUE_AT,
        sort_dir: SortDir = SortDir.ASC,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[OverdueLoan], int]:
        """List ACTIVE loans past due, with each one's overdue day count and
        estimated fine. Copy is eager-loaded: late_fee_per_day is needed per
        row and the relationship is lazy="raise"."""
        as_of = as_of or datetime.now(UTC)
        filters: list[ColumnElement[bool]] = [Loan.status == LoanStatus.ACTIVE, Loan.due_at < as_of]

        extra_filters, joins = self._member_and_book_filters(
            member_name=member_name, book_title=book_title
        )
        filters.extend(extra_filters)

        loans, total = await self.repository.list_paginated(
            filters=filters,
            joins=joins,
            options=[selectinload(Loan.copy)],
            sort_by=_SORT_COLUMNS[sort_by],
            sort_dir=sort_dir,
            limit=limit,
            offset=offset,
        )
        overdue = [
            OverdueLoan(
                loan=loan,
                days_overdue=self._overdue_days(loan.due_at, as_of),
                estimated_fine=self._calculate_fine(loan.due_at, as_of, loan.copy.late_fee_per_day),
            )
            for loan in loans
        ]
        return overdue, total
