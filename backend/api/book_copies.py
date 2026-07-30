from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ConflictError, NotFoundError
from db.session import get_db
from models.enums import CopyCondition, CopyStatus
from services.book_copy import BookCopyService

router = APIRouter(prefix="/api/v1/book-copies", tags=["book-copies"])


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
    try:
        copy = await service.create_copy(
            book_id=req.book_id,
            barcode=req.barcode,
            shelf_code=req.shelf_code,
            condition=req.condition,
            max_borrow_days=req.max_borrow_days,
            late_fee_per_day=req.late_fee_per_day,
        )
        return BookCopyResponse.model_validate(copy)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.get("", response_model=list[BookCopyResponse])
async def list_book_copies(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    book_id: UUID | None = Query(None),
    status: CopyStatus | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[BookCopyResponse]:
    """List book copies with optional filtering by book or status."""
    service = BookCopyService(db)
    if book_id is not None:
        copies = await service.list_copies_by_book(book_id)
    elif status is not None:
        copies = await service.list_copies_by_status(status)
    else:
        copies = await service.list_copies(limit=limit, offset=skip)
    return [BookCopyResponse.model_validate(c) for c in copies]


@router.get("/{copy_id}", response_model=BookCopyResponse)
async def get_book_copy(copy_id: UUID, db: AsyncSession = Depends(get_db)) -> BookCopyResponse:
    """Fetch a book copy by ID."""
    service = BookCopyService(db)
    try:
        copy = await service.get_copy(copy_id)
        return BookCopyResponse.model_validate(copy)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.put("/{copy_id}", response_model=BookCopyResponse)
async def update_book_copy(
    copy_id: UUID, req: BookCopyUpdateRequest, db: AsyncSession = Depends(get_db)
) -> BookCopyResponse:
    """Update a book copy."""
    service = BookCopyService(db)
    try:
        copy = await service.update_copy(copy_id, **req.model_dump(exclude_unset=True))
        return BookCopyResponse.model_validate(copy)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.delete("/{copy_id}", status_code=204)
async def delete_book_copy(copy_id: UUID, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a book copy."""
    service = BookCopyService(db)
    try:
        await service.delete_copy(copy_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
