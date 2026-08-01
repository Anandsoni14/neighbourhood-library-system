from enum import StrEnum
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_staff
from api.pagination import Page, PaginationParams
from core.pagination import SortDir
from db.session import get_db
from models import Category
from services.category import CategoryService

router = APIRouter(
    prefix="/api/v1/categories",
    tags=["categories"],
    dependencies=[Depends(get_current_staff)],
)


class CategorySortField(StrEnum):
    """Columns a category listing may be sorted by."""

    NAME = "name"
    CREATED_AT = "created_at"


_SORT_COLUMNS = {
    CategorySortField.NAME: Category.name,
    CategorySortField.CREATED_AT: Category.created_at,
}


class CategoryArchiveFilter(StrEnum):
    """Tri-state so "archived only" is expressible, not just "active plus archived"."""

    ACTIVE = "active"
    ARCHIVED = "archived"
    ALL = "all"


_ARCHIVE_FILTERS: dict[CategoryArchiveFilter, bool | None] = {
    CategoryArchiveFilter.ACTIVE: False,
    CategoryArchiveFilter.ARCHIVED: True,
    CategoryArchiveFilter.ALL: None,
}


class CategoryCreateRequest(BaseModel):
    """Request schema for creating a category."""

    name: str
    description: str | None = None


class CategoryUpdateRequest(BaseModel):
    """Request schema for updating a category."""

    name: str | None = None
    description: str | None = None


class CategoryResponse(BaseModel):
    """Response schema for a category."""

    model_config = ConfigDict(from_attributes=True)

    category_id: UUID
    name: str
    description: str | None
    is_archived: bool


@router.post("", response_model=CategoryResponse, status_code=201)
async def create_category(
    req: CategoryCreateRequest, db: AsyncSession = Depends(get_db)
) -> CategoryResponse:
    """Create a new category."""
    service = CategoryService(db)
    category = await service.create_category(name=req.name, description=req.description)
    return CategoryResponse.model_validate(category)


@router.get("", response_model=Page[CategoryResponse])
async def list_categories(
    pagination: PaginationParams = Depends(),
    name: str | None = Query(None, description="Case-insensitive substring match."),
    archived: CategoryArchiveFilter = Query(CategoryArchiveFilter.ACTIVE),
    sort_by: CategorySortField = Query(CategorySortField.NAME),
    sort_dir: SortDir = Query(SortDir.ASC),
    db: AsyncSession = Depends(get_db),
) -> Page[CategoryResponse]:
    """List categories. Filters combine; archived ones are excluded by default."""
    service = CategoryService(db)
    categories, total = await service.list_categories(
        name=name,
        is_archived=_ARCHIVE_FILTERS[archived],
        sort_by=_SORT_COLUMNS[sort_by],
        sort_dir=sort_dir,
        limit=pagination.limit,
        offset=pagination.skip,
    )
    return Page.create([CategoryResponse.model_validate(c) for c in categories], total, pagination)


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(category_id: UUID, db: AsyncSession = Depends(get_db)) -> CategoryResponse:
    """Fetch a category by ID."""
    service = CategoryService(db)
    category = await service.get_category(category_id)
    return CategoryResponse.model_validate(category)


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: UUID, req: CategoryUpdateRequest, db: AsyncSession = Depends(get_db)
) -> CategoryResponse:
    """Update a category."""
    service = CategoryService(db)
    category = await service.update_category(category_id, **req.model_dump(exclude_unset=True))
    return CategoryResponse.model_validate(category)


# Deliberately no DELETE: book.category_id is ondelete=RESTRICT, so deleting
# a used category always 409s. Archiving is the reversible equivalent.
@router.post("/{category_id}/archive", response_model=CategoryResponse)
async def archive_category(
    category_id: UUID, db: AsyncSession = Depends(get_db)
) -> CategoryResponse:
    """Archive a category so it no longer appears in pickers or default listings."""
    service = CategoryService(db)
    category = await service.archive_category(category_id)
    return CategoryResponse.model_validate(category)


@router.post("/{category_id}/unarchive", response_model=CategoryResponse)
async def unarchive_category(
    category_id: UUID, db: AsyncSession = Depends(get_db)
) -> CategoryResponse:
    """Restore a previously archived category."""
    service = CategoryService(db)
    category = await service.unarchive_category(category_id)
    return CategoryResponse.model_validate(category)
