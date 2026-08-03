from enum import StrEnum
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_staff
from api.pagination import Page, PaginationParams, build_page
from api.validators import RequestModel
from core.pagination import ARCHIVE_FILTER_VALUES, ArchiveFilter, SortDir
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


class CategoryCreateRequest(RequestModel):
    """Request schema for creating a category."""

    name: str = Field(min_length=1, max_length=80)
    description: str | None = None


class CategoryUpdateRequest(RequestModel):
    """Request schema for updating a category."""

    name: str | None = Field(None, min_length=1, max_length=80)
    description: str | None = None

    @field_validator("name")
    @classmethod
    def _reject_null(cls, value: str | None) -> str | None:
        """`name` is required in the database; omit the field to leave it
        unchanged instead of sending `null`."""
        if value is None:
            raise ValueError("name cannot be null")
        return value


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
    archived: ArchiveFilter = Query(ArchiveFilter.ACTIVE),
    sort_by: CategorySortField = Query(CategorySortField.NAME),
    sort_dir: SortDir = Query(SortDir.ASC),
    db: AsyncSession = Depends(get_db),
) -> Page[CategoryResponse]:
    """List categories. Filters combine; archived ones are excluded by default."""
    service = CategoryService(db)
    categories, total = await service.list_categories(
        name=name,
        is_archived=ARCHIVE_FILTER_VALUES[archived],
        sort_by=_SORT_COLUMNS[sort_by],
        sort_dir=sort_dir,
        limit=pagination.limit,
        offset=pagination.skip,
    )
    return build_page(categories, total, pagination, CategoryResponse)


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
