import logging
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from core.exceptions import ConflictError, NotFoundError
from core.pagination import SortDir
from models import Category
from repositories.category import CategoryRepository

logger = logging.getLogger(__name__)


class CategoryService:
    """Category service with business logic."""

    def __init__(self, session: AsyncSession) -> None:
        self.repository = CategoryRepository(session)
        self._session = session

    async def create_category(self, name: str, description: str | None = None) -> Category:
        """Create a new category. Name must be unique."""
        existing = await self.repository.get_by_name(name)
        if existing:
            raise ConflictError(f"Category '{name}' already exists")

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
        sort_by: InstrumentedAttribute[Any] | None = None,
        sort_dir: SortDir = SortDir.ASC,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Category], int]:
        """List categories matching every supplied filter, returning the page and total."""
        filters: list[ColumnElement[bool]] = []
        if name:
            filters.append(Category.name.ilike(f"%{name}%"))
        if is_archived is not None:
            filters.append(Category.is_archived.is_(is_archived))

        categories, total = await self.repository.list_paginated(
            filters=filters,
            sort_by=sort_by,
            sort_dir=sort_dir,
            limit=limit,
            offset=offset,
        )
        return list(categories), total

    async def update_category(self, category_id: UUID, **fields: Any) -> Category:
        """Update category fields. Name must remain unique."""
        category = await self.get_category(category_id)

        if "name" in fields and fields["name"] and fields["name"] != category.name:
            existing = await self.repository.get_by_name(fields["name"])
            if existing and existing.category_id != category_id:
                raise ConflictError(f"Category '{fields['name']}' already exists")

        for key, value in fields.items():
            if hasattr(category, key):
                setattr(category, key, value)

        self._session.add(category)
        await self._session.flush()
        logger.info("category_updated", extra={"category_id": str(category_id)})
        return category

    async def archive_category(self, category_id: UUID) -> Category:
        """Archive a category, hiding it from the default listing and the book form.

        Idempotent: archiving an already-archived category is a no-op rather than
        an error, so a double-click or a retried request behaves the same as one.
        """
        category = await self.get_category(category_id)
        category.is_archived = True
        self._session.add(category)
        await self._session.flush()
        logger.info("category_archived", extra={"category_id": str(category_id)})
        return category

    async def unarchive_category(self, category_id: UUID) -> Category:
        """Restore an archived category. Idempotent, same rationale as archive."""
        category = await self.get_category(category_id)
        category.is_archived = False
        self._session.add(category)
        await self._session.flush()
        logger.info("category_unarchived", extra={"category_id": str(category_id)})
        return category
