from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_staff
from api.pagination import Page, PaginationParams, build_page
from core.pagination import SortDir
from db.session import get_db
from models import Loan, Staff
from models.enums import CopyCondition, LoanStatus
from services.loan import LoanService

router = APIRouter(
    prefix="/api/v1/loans",
    tags=["loans"],
    dependencies=[Depends(get_current_staff)],
)


class LoanSortField(StrEnum):
    """Columns a loan listing may be sorted by."""

    BORROWED_AT = "borrowed_at"
    DUE_AT = "due_at"
    RETURNED_AT = "returned_at"
    STATUS = "status"
    CALCULATED_FINE = "calculated_fine"


_SORT_COLUMNS = {
    LoanSortField.BORROWED_AT: Loan.borrowed_at,
    LoanSortField.DUE_AT: Loan.due_at,
    LoanSortField.RETURNED_AT: Loan.returned_at,
    LoanSortField.STATUS: Loan.status,
    LoanSortField.CALCULATED_FINE: Loan.calculated_fine,
}


class LoanIssueRequest(BaseModel):
    """due_at is server-computed; issued_by_staff_id is the authenticated caller."""

    copy_id: UUID
    member_id: UUID
    remarks: str | None = None


class LoanReturnRequest(BaseModel):
    """received_by_staff_id is the authenticated caller, not a request field."""

    return_condition: CopyCondition
    remarks: str | None = None


class LoanResponse(BaseModel):
    """Response schema for a loan."""

    model_config = ConfigDict(from_attributes=True)

    loan_id: UUID
    copy_id: UUID
    member_id: UUID
    issued_by_staff_id: UUID
    received_by_staff_id: UUID | None
    borrowed_at: datetime
    due_at: datetime
    returned_at: datetime | None
    borrow_condition: CopyCondition
    return_condition: CopyCondition | None
    status: LoanStatus
    calculated_fine: Decimal
    remarks: str | None
    created_at: datetime
    closed_at: datetime | None


class OverdueLoanResponse(LoanResponse):
    """A loan past due, with its current overdue day count and fine estimate."""

    days_overdue: int
    estimated_fine: Decimal


@router.post("", response_model=LoanResponse, status_code=201)
async def issue_loan(
    req: LoanIssueRequest,
    db: AsyncSession = Depends(get_db),
    current_staff: Staff = Depends(get_current_staff),
) -> LoanResponse:
    """Issue a loan (borrow a book copy)."""
    service = LoanService(db)
    loan = await service.issue_loan(
        copy_id=req.copy_id,
        member_id=req.member_id,
        issued_by_staff_id=current_staff.staff_id,
        remarks=req.remarks,
    )
    return LoanResponse.model_validate(loan)


@router.post("/{loan_id}/return", response_model=LoanResponse)
async def return_loan(
    loan_id: UUID,
    req: LoanReturnRequest,
    db: AsyncSession = Depends(get_db),
    current_staff: Staff = Depends(get_current_staff),
) -> LoanResponse:
    """Return a loan (check in a borrowed copy)."""
    service = LoanService(db)
    loan = await service.return_loan(
        loan_id=loan_id,
        return_condition=req.return_condition,
        received_by_staff_id=current_staff.staff_id,
        remarks=req.remarks,
    )
    return LoanResponse.model_validate(loan)


@router.get("", response_model=Page[LoanResponse])
async def list_loans(
    pagination: PaginationParams = Depends(),
    member_id: UUID | None = Query(None),
    copy_id: UUID | None = Query(None),
    status: LoanStatus | None = Query(None),
    member_name: str | None = Query(None, description="Matches first or last name."),
    book_title: str | None = Query(None, description="Case-insensitive substring match."),
    copy_barcode: str | None = Query(None, description="Case-insensitive substring match."),
    sort_by: LoanSortField = Query(LoanSortField.BORROWED_AT),
    sort_dir: SortDir = Query(SortDir.DESC),
    db: AsyncSession = Depends(get_db),
) -> Page[LoanResponse]:
    """List loans. Filters combine; defaults to newest first."""
    service = LoanService(db)
    loans, total = await service.list_loans(
        member_id=member_id,
        copy_id=copy_id,
        status=status,
        member_name=member_name,
        book_title=book_title,
        copy_barcode=copy_barcode,
        sort_by=_SORT_COLUMNS[sort_by],
        sort_dir=sort_dir,
        limit=pagination.limit,
        offset=pagination.skip,
    )
    return build_page(loans, total, pagination, LoanResponse)


@router.get("/overdue", response_model=Page[OverdueLoanResponse])
async def list_overdue_loans(
    pagination: PaginationParams = Depends(),
    member_name: str | None = Query(None, description="Matches first or last name."),
    book_title: str | None = Query(None, description="Case-insensitive substring match."),
    sort_by: LoanSortField = Query(LoanSortField.DUE_AT),
    sort_dir: SortDir = Query(SortDir.ASC),
    db: AsyncSession = Depends(get_db),
) -> Page[OverdueLoanResponse]:
    """List ACTIVE loans past due, with overdue day count and estimated fine.

    Declared before /{loan_id} so this static path isn't swallowed by the
    loan_id UUID path parameter.
    """
    service = LoanService(db)
    overdue, total = await service.get_overdue_loans(
        member_name=member_name,
        book_title=book_title,
        sort_by=_SORT_COLUMNS[sort_by],
        sort_dir=sort_dir,
        limit=pagination.limit,
        offset=pagination.skip,
    )
    items = [
        OverdueLoanResponse(
            **LoanResponse.model_validate(entry.loan).model_dump(),
            days_overdue=entry.days_overdue,
            estimated_fine=entry.estimated_fine,
        )
        for entry in overdue
    ]
    return Page.create(items, total, pagination)


@router.get("/{loan_id}", response_model=LoanResponse)
async def get_loan(loan_id: UUID, db: AsyncSession = Depends(get_db)) -> LoanResponse:
    """Fetch a loan by ID."""
    service = LoanService(db)
    loan = await service.get_loan(loan_id)
    return LoanResponse.model_validate(loan)
