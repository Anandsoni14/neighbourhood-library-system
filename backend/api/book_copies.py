from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from api.deps import get_book_copy_service, get_current_staff
from api.pagination import Page, PaginationParams, build_page
from api.responses import CONFLICT, NOT_FOUND, UNAUTHORIZED
from api.validators import RequestModel
from core.pagination import SortDir
from models.enums import CopyCondition, CopyStatus
from services.book_copy import BookCopyService, BookCopySortField

router = APIRouter(
    prefix="/api/v1/book-copies",
    tags=["book-copies"],
    dependencies=[Depends(get_current_staff)],
    responses={**UNAUTHORIZED},
)


class BookCopyCreateRequest(RequestModel):
    """Request schema for creating a book copy."""

    book_id: UUID
    barcode: str = Field(min_length=1, max_length=64)
    shelf_code: str | None = Field(None, max_length=32)
    condition: CopyCondition | None = None
    max_borrow_days: int | None = Field(None, gt=0, le=32767)
    late_fee_per_day: Decimal | None = Field(None, ge=0, max_digits=10, decimal_places=2)


class BookCopyUpdateRequest(RequestModel):
    """Request schema for updating a book copy."""

    barcode: str | None = Field(None, min_length=1, max_length=64)
    shelf_code: str | None = Field(None, max_length=32)
    condition: CopyCondition | None = None
    status: CopyStatus | None = None
    max_borrow_days: int | None = Field(None, gt=0, le=32767)
    late_fee_per_day: Decimal | None = Field(None, ge=0, max_digits=10, decimal_places=2)


class BookCopyResponse(BaseModel):
    """Response schema for a book copy."""

    model_config = ConfigDict(from_attributes=True)

    copy_id: UUID
    book_id: UUID
    barcode: str
    shelf_code: str | None
    condition: CopyCondition
    status: CopyStatus
    max_borrow_days: int
    late_fee_per_day: Decimal


@router.post(
    "", response_model=BookCopyResponse, status_code=201, responses={**NOT_FOUND, **CONFLICT}
)
async def create_book_copy(
    req: BookCopyCreateRequest, service: BookCopyService = Depends(get_book_copy_service)
) -> BookCopyResponse:
    """Create a new book copy."""
    copy = await service.create_copy(
        book_id=req.book_id,
        barcode=req.barcode,
        shelf_code=req.shelf_code,
        condition=req.condition,
        max_borrow_days=req.max_borrow_days,
        late_fee_per_day=req.late_fee_per_day,
    )
    return BookCopyResponse.model_validate(copy)


@router.get("", response_model=Page[BookCopyResponse])
async def list_book_copies(
    pagination: PaginationParams = Depends(),
    book_id: UUID | None = Query(None),
    status: CopyStatus | None = Query(None),
    condition: CopyCondition | None = Query(None),
    barcode: str | None = Query(None, description="Case-insensitive substring match."),
    sort_by: BookCopySortField = Query(BookCopySortField.BARCODE),
    sort_dir: SortDir = Query(SortDir.ASC),
    service: BookCopyService = Depends(get_book_copy_service),
) -> Page[BookCopyResponse]:
    """List book copies. Every supplied filter is applied together."""
    copies, total = await service.list_copies(
        book_id=book_id,
        status=status,
        condition=condition,
        barcode=barcode,
        sort_by=sort_by,
        sort_dir=sort_dir,
        limit=pagination.limit,
        offset=pagination.skip,
    )
    return build_page(copies, total, pagination, BookCopyResponse)


@router.get("/{copy_id}", response_model=BookCopyResponse, responses={**NOT_FOUND})
async def get_book_copy(
    copy_id: UUID, service: BookCopyService = Depends(get_book_copy_service)
) -> BookCopyResponse:
    """Fetch a book copy by ID."""
    copy = await service.get_copy(copy_id)
    return BookCopyResponse.model_validate(copy)


@router.put(
    "/{copy_id}", response_model=BookCopyResponse, responses={**NOT_FOUND, **CONFLICT}
)
async def update_book_copy(
    copy_id: UUID,
    req: BookCopyUpdateRequest,
    service: BookCopyService = Depends(get_book_copy_service),
) -> BookCopyResponse:
    """Update a book copy."""
    copy = await service.update_copy(
        copy_id,
        barcode=req.barcode,
        shelf_code=req.shelf_code,
        condition=req.condition,
        status=req.status,
        max_borrow_days=req.max_borrow_days,
        late_fee_per_day=req.late_fee_per_day,
    )
    return BookCopyResponse.model_validate(copy)


@router.delete("/{copy_id}", status_code=204, responses={**NOT_FOUND, **CONFLICT})
async def delete_book_copy(
    copy_id: UUID, service: BookCopyService = Depends(get_book_copy_service)
) -> None:
    """Delete a book copy."""
    await service.delete_copy(copy_id)
