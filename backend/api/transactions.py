from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ConflictError, NotFoundError
from db.session import get_db
from models.enums import PaymentMode, TransactionStatus, TransactionType
from services.transaction import TransactionService

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])


class TransactionCreateRequest(BaseModel):
    """Request schema for recording a new fee or waiver."""

    member_id: UUID
    transaction_type: TransactionType
    amount: Decimal
    loan_id: UUID | None = None
    payment_reference: str | None = None


class TransactionPaymentRequest(BaseModel):
    """Request schema for recording a payment against a PENDING transaction."""

    payment_mode: PaymentMode
    payment_reference: str | None = None


class TransactionFailureRequest(BaseModel):
    """Request schema for marking a PENDING transaction's payment attempt as failed."""

    payment_mode: PaymentMode | None = None
    payment_reference: str | None = None


class TransactionResponse(BaseModel):
    """Response schema for a transaction."""

    model_config = ConfigDict(from_attributes=True)

    transaction_id: UUID
    loan_id: UUID | None
    member_id: UUID
    transaction_type: TransactionType
    payment_mode: PaymentMode | None
    amount: Decimal
    payment_reference: str | None
    status: TransactionStatus
    created_at: datetime


@router.post("", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    req: TransactionCreateRequest, db: AsyncSession = Depends(get_db)
) -> TransactionResponse:
    """Record a new fee or waiver against a member's ledger."""
    service = TransactionService(db)
    try:
        transaction = await service.create_transaction(
            member_id=req.member_id,
            transaction_type=req.transaction_type,
            amount=req.amount,
            loan_id=req.loan_id,
            payment_reference=req.payment_reference,
        )
        return TransactionResponse.model_validate(transaction)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.get("", response_model=list[TransactionResponse])
async def list_transactions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    member_id: UUID | None = Query(None),
    loan_id: UUID | None = Query(None),
    status: TransactionStatus | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[TransactionResponse]:
    """List transactions with optional filtering by member, loan, or status."""
    service = TransactionService(db)
    if member_id is not None:
        transactions = await service.list_transactions_by_member(member_id)
    elif loan_id is not None:
        transactions = await service.list_transactions_by_loan(loan_id)
    elif status is not None:
        transactions = await service.list_transactions_by_status(status)
    else:
        transactions = await service.list_transactions(limit=limit, offset=skip)
    return [TransactionResponse.model_validate(t) for t in transactions]


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: UUID, db: AsyncSession = Depends(get_db)
) -> TransactionResponse:
    """Fetch a transaction by ID."""
    service = TransactionService(db)
    try:
        transaction = await service.get_transaction(transaction_id)
        return TransactionResponse.model_validate(transaction)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/{transaction_id}/pay", response_model=TransactionResponse)
async def pay_transaction(
    transaction_id: UUID, req: TransactionPaymentRequest, db: AsyncSession = Depends(get_db)
) -> TransactionResponse:
    """Record a successful payment against a PENDING transaction."""
    service = TransactionService(db)
    try:
        transaction = await service.record_payment(
            transaction_id=transaction_id,
            payment_mode=req.payment_mode,
            payment_reference=req.payment_reference,
        )
        return TransactionResponse.model_validate(transaction)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.post("/{transaction_id}/fail", response_model=TransactionResponse)
async def fail_transaction(
    transaction_id: UUID, req: TransactionFailureRequest, db: AsyncSession = Depends(get_db)
) -> TransactionResponse:
    """Mark a PENDING transaction's payment attempt as failed."""
    service = TransactionService(db)
    try:
        transaction = await service.mark_failed(
            transaction_id=transaction_id,
            payment_mode=req.payment_mode,
            payment_reference=req.payment_reference,
        )
        return TransactionResponse.model_validate(transaction)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.post("/{transaction_id}/waive", response_model=TransactionResponse)
async def waive_transaction(
    transaction_id: UUID, db: AsyncSession = Depends(get_db)
) -> TransactionResponse:
    """Waive a PENDING fee, forgiving the amount owed."""
    service = TransactionService(db)
    try:
        transaction = await service.waive_transaction(transaction_id)
        return TransactionResponse.model_validate(transaction)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
