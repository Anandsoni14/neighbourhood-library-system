from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from api.pagination import Page, PaginationParams
from core.pagination import SortDir
from db.session import get_db
from models import BookCopy
from models.enums import CopyCondition, CopyStatus
from services.book_copy import BookCopyService

router = APIRouter(prefix="/api/v1/book-copies", tags=["book-copies"])


class BookCopySortField(StrEnum):
    """Columns a book copy listing may be sorted by."""

    BARCODE = "barcode"
    SHELF_CODE = "shelf_code"
    CONDITION = "condition"
    STATUS = "status"
    CREATED_AT = "created_at"


_SORT_COLUMNS = {
    BookCopySortField.BARCODE: BookCopy.barcode,
    BookCopySortField.SHELF_CODE: BookCopy.shelf_code,
    BookCopySortField.CONDITION: BookCopy.condition,
    BookCopySortField.STATUS: BookCopy.status,
    BookCopySortField.CREATED_AT: BookCopy.created_at,
}


class BookCopyCreateRequest(BaseModel):
    """Request schema for creating a book copy."""

    book_id: UUID
    barcode: str
    shelf_code: str | None = None
    condition: CopyCondition | None = None
    max_borrow_days: int | None = None
    late_fee_per_day: Decimal | None = None


class BookCopyUpdateRequest(BaseModel):
    """Request schema for updating a book copy."""

    barcode: str | None = None
    shelf_code: str | None = None
    condition: CopyCondition | None = None
    status: CopyStatus | None = None
    max_borrow_days: int | None = None
    late_fee_per_day: Decimal | None = None


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


@router.post("", response_model=BookCopyResponse, status_code=201)
async def create_book_copy(
    req: BookCopyCreateRequest, db: AsyncSession = Depends(get_db)
) -> BookCopyResponse:
    """Create a new book copy."""
    service = BookCopyService(db)
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
    db: AsyncSession = Depends(get_db),
) -> Page[BookCopyResponse]:
    """List book copies. Every supplied filter is applied together."""
    service = BookCopyService(db)
    copies, total = await service.list_copies(
        book_id=book_id,
        status=status,
        condition=condition,
        barcode=barcode,
        sort_by=_SORT_COLUMNS[sort_by],
        sort_dir=sort_dir,
        limit=pagination.limit,
        offset=pagination.skip,
    )
    return Page.create([BookCopyResponse.model_validate(c) for c in copies], total, pagination)


@router.get("/{copy_id}", response_model=BookCopyResponse)
async def get_book_copy(copy_id: UUID, db: AsyncSession = Depends(get_db)) -> BookCopyResponse:
    """Fetch a book copy by ID."""
    service = BookCopyService(db)
    copy = await service.get_copy(copy_id)
    return BookCopyResponse.model_validate(copy)


@router.put("/{copy_id}", response_model=BookCopyResponse)
async def update_book_copy(
    copy_id: UUID, req: BookCopyUpdateRequest, db: AsyncSession = Depends(get_db)
) -> BookCopyResponse:
    """Update a book copy."""
    service = BookCopyService(db)
    copy = await service.update_copy(copy_id, **req.model_dump(exclude_unset=True))
    return BookCopyResponse.model_validate(copy)


@router.delete("/{copy_id}", status_code=204)
async def delete_book_copy(copy_id: UUID, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a book copy."""
    service = BookCopyService(db)
    await service.delete_copy(copy_id)
