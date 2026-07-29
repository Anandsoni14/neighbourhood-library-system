from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ConflictError, NotFoundError
from db.session import get_db
from models.enums import CopyCondition, LoanStatus
from services.loan import LoanService

router = APIRouter(prefix="/api/v1/loans", tags=["loans"])


class LoanIssueRequest(BaseModel):
    """Request schema for issuing a loan. due_at is always server-computed."""

    copy_id: UUID
    member_id: UUID
    issued_by_staff_id: UUID
    remarks: str | None = None


class LoanReturnRequest(BaseModel):
    """Request schema for returning a loan."""

    return_condition: CopyCondition
    received_by_staff_id: UUID
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


@router.post("", response_model=LoanResponse, status_code=201)
async def issue_loan(req: LoanIssueRequest, db: AsyncSession = Depends(get_db)) -> LoanResponse:
    """Issue a loan (borrow a book copy)."""
    service = LoanService(db)
    try:
        loan = await service.issue_loan(
            copy_id=req.copy_id,
            member_id=req.member_id,
            issued_by_staff_id=req.issued_by_staff_id,
            remarks=req.remarks,
        )
        return LoanResponse.model_validate(loan)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.post("/{loan_id}/return", response_model=LoanResponse)
async def return_loan(
    loan_id: UUID, req: LoanReturnRequest, db: AsyncSession = Depends(get_db)
) -> LoanResponse:
    """Return a loan (check in a borrowed copy)."""
    service = LoanService(db)
    try:
        loan = await service.return_loan(
            loan_id=loan_id,
            return_condition=req.return_condition,
            received_by_staff_id=req.received_by_staff_id,
            remarks=req.remarks,
        )
        return LoanResponse.model_validate(loan)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.get("", response_model=list[LoanResponse])
async def list_loans(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    member_id: UUID | None = Query(None),
    status: LoanStatus | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[LoanResponse]:
    """List loans with optional filtering by member or status."""
    service = LoanService(db)
    if member_id is not None:
        loans = await service.list_loans_by_member(member_id)
    elif status is not None:
        loans = await service.list_loans_by_status(status)
    else:
        loans = await service.list_loans(limit=limit, offset=skip)
    return [LoanResponse.model_validate(loan) for loan in loans]


@router.get("/{loan_id}", response_model=LoanResponse)
async def get_loan(loan_id: UUID, db: AsyncSession = Depends(get_db)) -> LoanResponse:
    """Fetch a loan by ID."""
    service = LoanService(db)
    try:
        loan = await service.get_loan(loan_id)
        return LoanResponse.model_validate(loan)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
