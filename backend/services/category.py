import logging
from enum import StrEnum
from typing import Any, TypedDict
from uuid import UUID

from sqlalchemy import ColumnElement
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from core.exceptions import NotFoundError
from core.pagination import SortDir
from models import Category
from repositories.category import CategoryRepository
from services.uniqueness import ensure_unique

logger = logging.getLogger(__name__)


class CategorySortField(StrEnum):
    """Columns a category listing may be sorted by."""

    NAME = "name"
    CREATED_AT = "created_at"


_SORT_COLUMNS: dict[CategorySortField, InstrumentedAttribute[Any]] = {
    CategorySortField.NAME: Category.name,
    CategorySortField.CREATED_AT: Category.created_at,
}


class CategoryUpdateFields(TypedDict, total=False):
    """Fields `update_category` may set. A key's *presence* is meaningful —
    an explicit `description: None` clears the value, while omitting the key
    leaves it alone — so this stays a mapping rather than explicit parameters."""

    name: str
    description: str | None


class CategoryService:
    """Category service with business logic."""

    def __init__(self, session: AsyncSession) -> None:
        self.repository = CategoryRepository(session)

    async def create_category(self, name: str, description: str | None = None) -> Category:
        """Create a new category. Name must be unique."""
        await ensure_unique(
            lambda: self.repository.get_by_name(name),
            id_attr="category_id",
            current_id=None,
            message=f"Category '{name}' already exists",
        )

        category = Category(name=name, description=description)
        created = await self.repository.add(category)
        logger.info(
            "category_created",
            extra={"category_id": str(created.category_id), "name": name},
        )
        return created

    async def get_category(self, category_id: UUID) -> Category:
        """Fetch a category by ID."""
        category = await self.repository.get_by_id(category_id)
        if not category:
            raise NotFoundError(f"Category {category_id} not found")
        return category

    async def list_categories(
        self,
        *,
        name: str | None = None,
        is_archived: bool | None = False,
        sort_by: CategorySortField = CategorySortField.NAME,
        sort_dir: SortDir = SortDir.ASC,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Category], int]:
        """List categories matching every filter. `is_archived`: False/True/None
        = active/archived/both."""
        filters: list[ColumnElement[bool]] = []
        if name:
            filters.append(Category.name.ilike(f"%{name}%"))
        if is_archived is not None:
            filters.append(Category.is_archived.is_(is_archived))

        categories, total = await self.repository.list_paginated(
            filters=filters,
            sort_by=_SORT_COLUMNS[sort_by],
            sort_dir=sort_dir,
            limit=limit,
            offset=offset,
        )
        return list(categories), total

    async def update_category(self, category_id: UUID, fields: CategoryUpdateFields) -> Category:
        """Update category fields. Name must remain unique."""
        category = await self.get_category(category_id)

        if "name" in fields and fields["name"] and fields["name"] != category.name:
            await ensure_unique(
                lambda: self.repository.get_by_name(fields["name"]),
                id_attr="category_id",
                current_id=category_id,
                message=f"Category '{fields['name']}' already exists",
            )

        self.repository.assign(category, fields, skip_none=False)
        await self.repository.save(category)
        logger.info("category_updated", extra={"category_id": str(category_id)})
        return category

    async def archive_category(self, category_id: UUID) -> Category:
        """Archive a category, hiding it from listings and the book form. Idempotent."""
        category = await self.get_category(category_id)
        category.is_archived = True
        await self.repository.save(category)
        logger.info("category_archived", extra={"category_id": str(category_id)})
        return category

    async def unarchive_category(self, category_id: UUID) -> Category:
        """Restore an archived category. Idempotent, same rationale as archive."""
        category = await self.get_category(category_id)
        category.is_archived = False
        await self.repository.save(category)
        logger.info("category_unarchived", extra={"category_id": str(category_id)})
        return category
