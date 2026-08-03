from typing import cast
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator

from api.deps import get_category_service, get_current_staff
from api.pagination import Page, PaginationParams, build_page
from api.responses import CONFLICT, NOT_FOUND, UNAUTHORIZED
from api.validators import RequestModel
from core.pagination import ARCHIVE_FILTER_VALUES, ArchiveFilter, SortDir
from services.category import CategoryService, CategorySortField, CategoryUpdateFields

router = APIRouter(
    prefix="/api/v1/categories",
    tags=["categories"],
    dependencies=[Depends(get_current_staff)],
    responses={**UNAUTHORIZED},
)


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


@router.post("", response_model=CategoryResponse, status_code=201, responses={**CONFLICT})
async def create_category(
    req: CategoryCreateRequest, service: CategoryService = Depends(get_category_service)
) -> CategoryResponse:
    """Create a new category."""
    category = await service.create_category(name=req.name, description=req.description)
    return CategoryResponse.model_validate(category)


@router.get("", response_model=Page[CategoryResponse])
async def list_categories(
    pagination: PaginationParams = Depends(),
    name: str | None = Query(None, description="Case-insensitive substring match."),
    archived: ArchiveFilter = Query(ArchiveFilter.ACTIVE),
    sort_by: CategorySortField = Query(CategorySortField.NAME),
    sort_dir: SortDir = Query(SortDir.ASC),
    service: CategoryService = Depends(get_category_service),
) -> Page[CategoryResponse]:
    """List categories. Filters combine; archived ones are excluded by default."""
    categories, total = await service.list_categories(
        name=name,
        is_archived=ARCHIVE_FILTER_VALUES[archived],
        sort_by=sort_by,
        sort_dir=sort_dir,
        limit=pagination.limit,
        offset=pagination.skip,
    )
    return build_page(categories, total, pagination, CategoryResponse)


@router.get("/{category_id}", response_model=CategoryResponse, responses={**NOT_FOUND})
async def get_category(
    category_id: UUID, service: CategoryService = Depends(get_category_service)
) -> CategoryResponse:
    """Fetch a category by ID."""
    category = await service.get_category(category_id)
    return CategoryResponse.model_validate(category)


@router.put(
    "/{category_id}", response_model=CategoryResponse, responses={**NOT_FOUND, **CONFLICT}
)
async def update_category(
    category_id: UUID,
    req: CategoryUpdateRequest,
    service: CategoryService = Depends(get_category_service),
) -> CategoryResponse:
    """Update a category."""
    # exclude_unset keeps "omitted" distinct from "explicitly null"; cast marks
    # where Pydantic's typing stops and the mapping begins.
    category = await service.update_category(
        category_id, cast(CategoryUpdateFields, req.model_dump(exclude_unset=True))
    )
    return CategoryResponse.model_validate(category)


# Deliberately no DELETE: book.category_id is ondelete=RESTRICT, so deleting
# a used category always 409s. Archiving is the reversible equivalent.
@router.post("/{category_id}/archive", response_model=CategoryResponse, responses={**NOT_FOUND})
async def archive_category(
    category_id: UUID, service: CategoryService = Depends(get_category_service)
) -> CategoryResponse:
    """Archive a category so it no longer appears in pickers or default listings."""
    category = await service.archive_category(category_id)
    return CategoryResponse.model_validate(category)


@router.post(
    "/{category_id}/unarchive", response_model=CategoryResponse, responses={**NOT_FOUND}
)
async def unarchive_category(
    category_id: UUID, service: CategoryService = Depends(get_category_service)
) -> CategoryResponse:
    """Restore a previously archived category."""
    category = await service.unarchive_category(category_id)
    return CategoryResponse.model_validate(category)
