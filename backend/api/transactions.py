from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from api.pagination import Page, PaginationParams
from core.pagination import SortDir
from db.session import get_db
from models import Transaction
from models.enums import PaymentMode, TransactionStatus, TransactionType
from services.transaction import TransactionService

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])


class TransactionSortField(StrEnum):
    """Columns a transaction listing may be sorted by."""

    CREATED_AT = "created_at"
    AMOUNT = "amount"
    STATUS = "status"
    TRANSACTION_TYPE = "transaction_type"


_SORT_COLUMNS = {
    TransactionSortField.CREATED_AT: Transaction.created_at,
    TransactionSortField.AMOUNT: Transaction.amount,
    TransactionSortField.STATUS: Transaction.status,
    TransactionSortField.TRANSACTION_TYPE: Transaction.transaction_type,
}


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
    transaction = await service.create_transaction(
        member_id=req.member_id,
        transaction_type=req.transaction_type,
        amount=req.amount,
        loan_id=req.loan_id,
        payment_reference=req.payment_reference,
    )
    return TransactionResponse.model_validate(transaction)


@router.get("", response_model=Page[TransactionResponse])
async def list_transactions(
    pagination: PaginationParams = Depends(),
    member_id: UUID | None = Query(None),
    loan_id: UUID | None = Query(None),
    status: TransactionStatus | None = Query(None),
    transaction_type: TransactionType | None = Query(None),
    sort_by: TransactionSortField = Query(TransactionSortField.CREATED_AT),
    sort_dir: SortDir = Query(SortDir.DESC),
    db: AsyncSession = Depends(get_db),
) -> Page[TransactionResponse]:
    """List transactions. Every supplied filter is applied together."""
    service = TransactionService(db)
    transactions, total = await service.list_transactions(
        member_id=member_id,
        loan_id=loan_id,
        status=status,
        transaction_type=transaction_type,
        sort_by=_SORT_COLUMNS[sort_by],
        sort_dir=sort_dir,
        limit=pagination.limit,
        offset=pagination.skip,
    )
    items = [TransactionResponse.model_validate(t) for t in transactions]
    return Page.create(items, total, pagination)


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: UUID, db: AsyncSession = Depends(get_db)
) -> TransactionResponse:
    """Fetch a transaction by ID."""
    service = TransactionService(db)
    transaction = await service.get_transaction(transaction_id)
    return TransactionResponse.model_validate(transaction)


@router.post("/{transaction_id}/pay", response_model=TransactionResponse)
async def pay_transaction(
    transaction_id: UUID, req: TransactionPaymentRequest, db: AsyncSession = Depends(get_db)
) -> TransactionResponse:
    """Record a successful payment against a PENDING transaction."""
    service = TransactionService(db)
    transaction = await service.record_payment(
        transaction_id=transaction_id,
        payment_mode=req.payment_mode,
        payment_reference=req.payment_reference,
    )
    return TransactionResponse.model_validate(transaction)


@router.post("/{transaction_id}/fail", response_model=TransactionResponse)
async def fail_transaction(
    transaction_id: UUID, req: TransactionFailureRequest, db: AsyncSession = Depends(get_db)
) -> TransactionResponse:
    """Mark a PENDING transaction's payment attempt as failed."""
    service = TransactionService(db)
    transaction = await service.mark_failed(
        transaction_id=transaction_id,
        payment_mode=req.payment_mode,
        payment_reference=req.payment_reference,
    )
    return TransactionResponse.model_validate(transaction)


@router.post("/{transaction_id}/waive", response_model=TransactionResponse)
async def waive_transaction(
    transaction_id: UUID, db: AsyncSession = Depends(get_db)
) -> TransactionResponse:
    """Waive a PENDING fee, forgiving the amount owed."""
    service = TransactionService(db)
    transaction = await service.waive_transaction(transaction_id)
    return TransactionResponse.model_validate(transaction)
