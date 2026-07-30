from enum import StrEnum
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from api.pagination import Page, PaginationParams
from core.pagination import SortDir
from db.session import get_db
from models import Book
from services.book import BookService

router = APIRouter(prefix="/api/v1/books", tags=["books"])


class BookSortField(StrEnum):
    """Columns a book listing may be sorted by.

    An allowlist rather than a free-text column name: FastAPI rejects anything
    else with 422 before it reaches the query builder.
    """

    TITLE = "title"
    AUTHOR = "author"
    CATEGORY = "category"
    PUBLISHED_YEAR = "published_year"
    CREATED_AT = "created_at"


_SORT_COLUMNS = {
    BookSortField.TITLE: Book.title,
    BookSortField.AUTHOR: Book.author,
    BookSortField.CATEGORY: Book.category,
    BookSortField.PUBLISHED_YEAR: Book.published_year,
    BookSortField.CREATED_AT: Book.created_at,
}


class BookRequest(BaseModel):
    """Request schema for creating/updating a book."""

    title: str
    author: str
    publisher: str | None = None
    isbn: str | None = None
    category: str | None = None
    description: str | None = None
    published_year: int | None = None


class BookResponse(BaseModel):
    """Response schema for a book."""

    model_config = ConfigDict(from_attributes=True)

    book_id: UUID
    title: str
    author: str
    publisher: str | None
    isbn: str | None
    category: str | None
    description: str | None
    published_year: int | None


@router.post("", response_model=BookResponse, status_code=201)
async def create_book(req: BookRequest, db: AsyncSession = Depends(get_db)) -> BookResponse:
    """Create a new book."""
    service = BookService(db)
    book = await service.create_book(
        title=req.title,
        author=req.author,
        publisher=req.publisher,
        isbn=req.isbn,
        category=req.category,
        description=req.description,
        published_year=req.published_year,
    )
    return BookResponse.model_validate(book)


@router.get("", response_model=Page[BookResponse])
async def list_books(
    pagination: PaginationParams = Depends(),
    title: str | None = Query(None, description="Case-insensitive substring match."),
    author: str | None = Query(None, description="Case-insensitive substring match."),
    category: str | None = Query(None, description="Case-insensitive substring match."),
    isbn: str | None = Query(None, description="Exact match."),
    sort_by: BookSortField = Query(BookSortField.TITLE),
    sort_dir: SortDir = Query(SortDir.ASC),
    db: AsyncSession = Depends(get_db),
) -> Page[BookResponse]:
    """List books. Every supplied filter is applied together."""
    service = BookService(db)
    books, total = await service.list_books(
        title=title,
        author=author,
        category=category,
        isbn=isbn,
        sort_by=_SORT_COLUMNS[sort_by],
        sort_dir=sort_dir,
        limit=pagination.limit,
        offset=pagination.skip,
    )
    return Page.create([BookResponse.model_validate(b) for b in books], total, pagination)


@router.get("/search", response_model=Page[BookResponse])
async def search_books(
    pagination: PaginationParams = Depends(),
    title: str | None = Query(None),
    isbn: str | None = Query(None),
    sort_by: BookSortField = Query(BookSortField.TITLE),
    sort_dir: SortDir = Query(SortDir.ASC),
    db: AsyncSession = Depends(get_db),
) -> Page[BookResponse]:
    """Search books by title and/or ISBN.

    Declared before /{book_id} so this static path isn't captured by the
    book_id UUID path parameter.
    """
    if not title and not isbn:
        raise HTTPException(
            status_code=400, detail="Provide at least one search parameter (title or isbn)"
        )
    service = BookService(db)
    books, total = await service.list_books(
        title=title,
        isbn=isbn,
        sort_by=_SORT_COLUMNS[sort_by],
        sort_dir=sort_dir,
        limit=pagination.limit,
        offset=pagination.skip,
    )
    return Page.create([BookResponse.model_validate(b) for b in books], total, pagination)


@router.get("/{book_id}", response_model=BookResponse)
async def get_book(book_id: UUID, db: AsyncSession = Depends(get_db)) -> BookResponse:
    """Fetch a book by ID."""
    service = BookService(db)
    book = await service.get_book(book_id)
    return BookResponse.model_validate(book)


@router.put("/{book_id}", response_model=BookResponse)
async def update_book(
    book_id: UUID, req: BookRequest, db: AsyncSession = Depends(get_db)
) -> BookResponse:
    """Update a book."""
    service = BookService(db)
    book = await service.update_book(
        book_id,
        title=req.title,
        author=req.author,
        publisher=req.publisher,
        isbn=req.isbn,
        category=req.category,
        description=req.description,
        published_year=req.published_year,
    )
    return BookResponse.model_validate(book)


@router.delete("/{book_id}", status_code=204)
async def delete_book(book_id: UUID, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a book."""
    service = BookService(db)
    await service.delete_book(book_id)
