from enum import StrEnum
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_staff
from api.pagination import Page, PaginationParams
from core.pagination import SortDir
from db.session import get_db
from models import Book, Category
from services.book import BookService

router = APIRouter(
    prefix="/api/v1/books",
    tags=["books"],
    dependencies=[Depends(get_current_staff)],
)


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
    # Sorts on the joined category table; BookService always applies the OUTER
    # join, so books with no category still sort (as NULL) rather than vanish.
    BookSortField.CATEGORY: Category.name,
    BookSortField.PUBLISHED_YEAR: Book.published_year,
    BookSortField.CREATED_AT: Book.created_at,
}


class BookArchiveFilter(StrEnum):
    """Which slice of the catalogue a listing should return.

    Tri-state rather than a boolean `include_archived`: that flag can only ever
    express "active plus archived", never "archived only", so the archived view
    the UI needs would require a second parameter later.
    """

    ACTIVE = "active"
    ARCHIVED = "archived"
    ALL = "all"


_ARCHIVE_FILTERS: dict[BookArchiveFilter, bool | None] = {
    BookArchiveFilter.ACTIVE: False,
    BookArchiveFilter.ARCHIVED: True,
    BookArchiveFilter.ALL: None,
}


class BookRequest(BaseModel):
    """Request schema for creating/updating a book."""

    title: str
    author: str
    publisher: str | None = None
    isbn: str | None = None
    category_id: UUID | None = None
    description: str | None = None
    published_year: int | None = None


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


@router.post("", response_model=BookResponse, status_code=201)
async def create_book(req: BookRequest, db: AsyncSession = Depends(get_db)) -> BookResponse:
    """Create a new book."""
    service = BookService(db)
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
    archived: BookArchiveFilter = Query(BookArchiveFilter.ACTIVE),
    in_stock: bool | None = Query(
        None, description="True for books with at least one AVAILABLE copy, False for none."
    ),
    sort_by: BookSortField = Query(BookSortField.TITLE),
    sort_dir: SortDir = Query(SortDir.ASC),
    db: AsyncSession = Depends(get_db),
) -> Page[BookResponse]:
    """List books. Every supplied filter is applied together.

    Archived books are excluded by default; pass `archived=archived` for only
    those, or `archived=all` for both.
    """
    service = BookService(db)
    books, total = await service.list_books(
        title=title,
        author=author,
        category_id=category_id,
        isbn=isbn,
        is_archived=_ARCHIVE_FILTERS[archived],
        in_stock=in_stock,
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
    archived: BookArchiveFilter = Query(BookArchiveFilter.ACTIVE),
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
        is_archived=_ARCHIVE_FILTERS[archived],
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
        category_id=req.category_id,
        description=req.description,
        published_year=req.published_year,
    )
    return BookResponse.model_validate(book)


# Deliberately no DELETE. A book with copies cannot be removed without
# destroying the loan history attached to those copies; archiving is the
# reversible equivalent the UI actually needs. FastAPI returns 405 for DELETE
# on this path now, which is the correct signal that the operation is gone.
@router.post("/{book_id}/archive", response_model=BookResponse)
async def archive_book(book_id: UUID, db: AsyncSession = Depends(get_db)) -> BookResponse:
    """Archive a book, hiding it from the default listing and blocking new loans."""
    service = BookService(db)
    book = await service.archive_book(book_id)
    return BookResponse.model_validate(book)


@router.post("/{book_id}/unarchive", response_model=BookResponse)
async def unarchive_book(book_id: UUID, db: AsyncSession = Depends(get_db)) -> BookResponse:
    """Restore a previously archived book."""
    service = BookService(db)
    book = await service.unarchive_book(book_id)
    return BookResponse.model_validate(book)
