from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ConflictError, NotFoundError
from db.session import get_db
from services.book import BookService

router = APIRouter(prefix="/api/v1/books", tags=["books"])


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
    try:
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
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.get("", response_model=list[BookResponse])
async def list_books(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
) -> list[BookResponse]:
    """List all books with pagination."""
    service = BookService(db)
    books = await service.list_books(limit=limit, offset=skip)
    return [BookResponse.model_validate(b) for b in books]


@router.get("/search", response_model=list[BookResponse])
async def search_books(
    title: str | None = Query(None),
    isbn: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[BookResponse]:
    """Search books by title and/or ISBN."""
    if not title and not isbn:
        raise HTTPException(
            status_code=400, detail="Provide at least one search parameter (title or isbn)"
        )
    service = BookService(db)
    books = await service.search_books(title=title, isbn=isbn)
    return [BookResponse.model_validate(b) for b in books]


@router.get("/{book_id}", response_model=BookResponse)
async def get_book(book_id: UUID, db: AsyncSession = Depends(get_db)) -> BookResponse:
    """Fetch a book by ID."""
    service = BookService(db)
    try:
        book = await service.get_book(book_id)
        return BookResponse.model_validate(book)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.put("/{book_id}", response_model=BookResponse)
async def update_book(
    book_id: UUID, req: BookRequest, db: AsyncSession = Depends(get_db)
) -> BookResponse:
    """Update a book."""
    service = BookService(db)
    try:
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
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.delete("/{book_id}", status_code=204)
async def delete_book(book_id: UUID, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a book."""
    service = BookService(db)
    try:
        await service.delete_book(book_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
