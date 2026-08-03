from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from api.deps import get_current_staff, get_transaction_service
from api.pagination import Page, PaginationParams, build_page
from api.responses import CONFLICT, NOT_FOUND, UNAUTHORIZED
from api.validators import RequestModel
from core.pagination import SortDir
from models.enums import PaymentMode, TransactionStatus, TransactionType
from services.transaction import TransactionService, TransactionSortField

router = APIRouter(
    prefix="/api/v1/transactions",
    tags=["transactions"],
    dependencies=[Depends(get_current_staff)],
    responses={**UNAUTHORIZED},
)


class TransactionCreateRequest(RequestModel):
    """Request schema for recording a new fee or waiver."""

    member_id: UUID
    transaction_type: TransactionType
    amount: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    loan_id: UUID | None = None
    payment_reference: str | None = Field(None, max_length=80)


class TransactionPaymentRequest(RequestModel):
    """Request schema for recording a payment against a PENDING transaction."""

    payment_mode: PaymentMode
    payment_reference: str | None = Field(None, max_length=80)


class TransactionFailureRequest(RequestModel):
    """Request schema for marking a PENDING transaction's payment attempt as failed."""

    payment_mode: PaymentMode | None = None
    payment_reference: str | None = Field(None, max_length=80)


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


@router.post(
    "",
    response_model=TransactionResponse,
    status_code=201,
    responses={**NOT_FOUND, **CONFLICT},
)
async def create_transaction(
    req: TransactionCreateRequest,
    service: TransactionService = Depends(get_transaction_service),
) -> TransactionResponse:
    """Record a new fee or waiver against a member's ledger."""
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
    service: TransactionService = Depends(get_transaction_service),
) -> Page[TransactionResponse]:
    """List transactions. Every supplied filter is applied together."""
    transactions, total = await service.list_transactions(
        member_id=member_id,
        loan_id=loan_id,
        status=status,
        transaction_type=transaction_type,
        sort_by=sort_by,
        sort_dir=sort_dir,
        limit=pagination.limit,
        offset=pagination.skip,
    )
    return build_page(transactions, total, pagination, TransactionResponse)


@router.get(
    "/{transaction_id}", response_model=TransactionResponse, responses={**NOT_FOUND}
)
async def get_transaction(
    transaction_id: UUID, service: TransactionService = Depends(get_transaction_service)
) -> TransactionResponse:
    """Fetch a transaction by ID."""
    transaction = await service.get_transaction(transaction_id)
    return TransactionResponse.model_validate(transaction)


@router.post(
    "/{transaction_id}/pay",
    response_model=TransactionResponse,
    responses={**NOT_FOUND, **CONFLICT},
)
async def pay_transaction(
    transaction_id: UUID,
    req: TransactionPaymentRequest,
    service: TransactionService = Depends(get_transaction_service),
) -> TransactionResponse:
    """Record a successful payment against a PENDING transaction."""
    transaction = await service.record_payment(
        transaction_id=transaction_id,
        payment_mode=req.payment_mode,
        payment_reference=req.payment_reference,
    )
    return TransactionResponse.model_validate(transaction)


@router.post(
    "/{transaction_id}/fail",
    response_model=TransactionResponse,
    responses={**NOT_FOUND, **CONFLICT},
)
async def fail_transaction(
    transaction_id: UUID,
    req: TransactionFailureRequest,
    service: TransactionService = Depends(get_transaction_service),
) -> TransactionResponse:
    """Mark a PENDING transaction's payment attempt as failed."""
    transaction = await service.mark_failed(
        transaction_id=transaction_id,
        payment_mode=req.payment_mode,
        payment_reference=req.payment_reference,
    )
    return TransactionResponse.model_validate(transaction)


@router.post(
    "/{transaction_id}/waive",
    response_model=TransactionResponse,
    responses={**NOT_FOUND, **CONFLICT},
)
async def waive_transaction(
    transaction_id: UUID, service: TransactionService = Depends(get_transaction_service)
) -> TransactionResponse:
    """Waive a PENDING fee, forgiving the amount owed."""
    transaction = await service.waive_transaction(transaction_id)
    return TransactionResponse.model_validate(transaction)
