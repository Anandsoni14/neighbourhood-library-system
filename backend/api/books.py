from typing import cast
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from api.deps import get_book_service, get_current_staff
from api.pagination import Page, PaginationParams, build_page
from api.responses import CONFLICT, NOT_FOUND, UNAUTHORIZED, VALIDATION_ERROR
from api.validators import RequestModel
from core.exceptions import ValidationError
from core.pagination import ARCHIVE_FILTER_VALUES, ArchiveFilter, SortDir
from services.book import BookService, BookSortField, BookUpdateFields

router = APIRouter(
    prefix="/api/v1/books",
    tags=["books"],
    dependencies=[Depends(get_current_staff)],
    responses={**UNAUTHORIZED},
)


class BookRequest(RequestModel):
    """Request schema for creating/updating a book."""

    title: str = Field(min_length=1, max_length=255)
    author: str = Field(min_length=1, max_length=160)
    publisher: str | None = Field(None, max_length=160)
    isbn: str | None = Field(None, min_length=1, max_length=20)
    category_id: UUID | None = None
    description: str | None = None
    published_year: int | None = Field(None, ge=1400, le=2100)


class CategoryRef(BaseModel):
    """The category a book belongs to, embedded so a listing needs no second call."""

    model_config = ConfigDict(from_attributes=True)

    category_id: UUID
    name: str


class BookResponse(BaseModel):
    """Response schema for a book."""

    model_config = ConfigDict(from_attributes=True)

    book_id: UUID
    title: str
    author: str
    publisher: str | None
    isbn: str | None
    category_id: UUID | None
    category: CategoryRef | None
    description: str | None
    published_year: int | None
    is_archived: bool


@router.post("", response_model=BookResponse, status_code=201, responses={**NOT_FOUND, **CONFLICT})
async def create_book(
    req: BookRequest, service: BookService = Depends(get_book_service)
) -> BookResponse:
    """Create a new book."""
    book = await service.create_book(
        title=req.title,
        author=req.author,
        publisher=req.publisher,
        isbn=req.isbn,
        category_id=req.category_id,
        description=req.description,
        published_year=req.published_year,
    )
    return BookResponse.model_validate(book)


@router.get("", response_model=Page[BookResponse])
async def list_books(
    pagination: PaginationParams = Depends(),
    title: str | None = Query(None, description="Case-insensitive substring match."),
    author: str | None = Query(None, description="Case-insensitive substring match."),
    category_id: UUID | None = Query(None),
    isbn: str | None = Query(None, description="Case-insensitive substring match."),
    archived: ArchiveFilter = Query(ArchiveFilter.ACTIVE),
    in_stock: bool | None = Query(
        None, description="True for books with at least one AVAILABLE copy, False for none."
    ),
    sort_by: BookSortField = Query(BookSortField.TITLE),
    sort_dir: SortDir = Query(SortDir.ASC),
    service: BookService = Depends(get_book_service),
) -> Page[BookResponse]:
    """List books. Filters combine; archived books are excluded by default."""
    books, total = await service.list_books(
        title=title,
        author=author,
        category_id=category_id,
        isbn=isbn,
        is_archived=ARCHIVE_FILTER_VALUES[archived],
        in_stock=in_stock,
        sort_by=sort_by,
        sort_dir=sort_dir,
        limit=pagination.limit,
        offset=pagination.skip,
    )
    return build_page(books, total, pagination, BookResponse)


@router.get("/search", response_model=Page[BookResponse], responses={**VALIDATION_ERROR})
async def search_books(
    pagination: PaginationParams = Depends(),
    title: str | None = Query(None),
    isbn: str | None = Query(None),
    archived: ArchiveFilter = Query(ArchiveFilter.ACTIVE),
    sort_by: BookSortField = Query(BookSortField.TITLE),
    sort_dir: SortDir = Query(SortDir.ASC),
    service: BookService = Depends(get_book_service),
) -> Page[BookResponse]:
    """Search books by title and/or ISBN. Declared before /{book_id} so this
    static path isn't captured by the book_id UUID path parameter."""
    if not title and not isbn:
        raise ValidationError("Provide at least one search parameter (title or isbn)")
    books, total = await service.list_books(
        title=title,
        isbn=isbn,
        is_archived=ARCHIVE_FILTER_VALUES[archived],
        sort_by=sort_by,
        sort_dir=sort_dir,
        limit=pagination.limit,
        offset=pagination.skip,
    )
    return build_page(books, total, pagination, BookResponse)


@router.get("/{book_id}", response_model=BookResponse, responses={**NOT_FOUND})
async def get_book(
    book_id: UUID, service: BookService = Depends(get_book_service)
) -> BookResponse:
    """Fetch a book by ID."""
    book = await service.get_book(book_id)
    return BookResponse.model_validate(book)


@router.put("/{book_id}", response_model=BookResponse, responses={**NOT_FOUND, **CONFLICT})
async def update_book(
    book_id: UUID, req: BookRequest, service: BookService = Depends(get_book_service)
) -> BookResponse:
    """Update a book."""
    # BookRequest is a full replacement, so every field is always present —
    # cast marks where Pydantic's typing stops and the mapping begins.
    book = await service.update_book(book_id, cast(BookUpdateFields, req.model_dump()))
    return BookResponse.model_validate(book)


# Deliberately no DELETE: a book with copies can't be removed without
# destroying loan history. Archiving is the reversible equivalent.
@router.post("/{book_id}/archive", response_model=BookResponse, responses={**NOT_FOUND})
async def archive_book(
    book_id: UUID, service: BookService = Depends(get_book_service)
) -> BookResponse:
    """Archive a book, hiding it from the default listing and blocking new loans."""
    book = await service.archive_book(book_id)
    return BookResponse.model_validate(book)


@router.post("/{book_id}/unarchive", response_model=BookResponse, responses={**NOT_FOUND})
async def unarchive_book(
    book_id: UUID, service: BookService = Depends(get_book_service)
) -> BookResponse:
    """Restore a previously archived book."""
    book = await service.unarchive_book(book_id)
    return BookResponse.model_validate(book)
