from collections.abc import Mapping, Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, func, inspect, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql.base import ExecutableOption

from core.pagination import SortDir
from db.base import Base


class BaseRepository[ModelT: Base]:
    """Generic persistence operations shared by all repositories. No business
    logic, never commits — the owning session (db.session.get_db) owns that."""

    def __init__(self, session: AsyncSession, model: type[ModelT]) -> None:
        self._session = session
        self._model = model

    async def get_by_id(self, entity_id: UUID) -> ModelT | None:
        return await self._session.get(self._model, entity_id)

    async def add(self, entity: ModelT) -> ModelT:
        self._session.add(entity)
        await self._session.flush()
        return entity

    async def save(self, entity: ModelT) -> ModelT:
        """Persist a mutated entity. Same add()+flush() shape as add() itself
        — reads already go through the repository; this is the write-path
        counterpart, used after updating or archiving/reactivating an entity."""
        self._session.add(entity)
        await self._session.flush()
        return entity

    async def delete(self, entity: ModelT) -> None:
        await self._session.delete(entity)
        await self._session.flush()

    async def get_by(self, column: InstrumentedAttribute[Any], value: Any) -> ModelT | None:
        """Fetch by exact match on a single column. The named lookup methods
        on each repository (get_by_email, search_by_isbn, ...) call this —
        kept as named methods so call sites elsewhere are unaffected."""
        result = await self._session.execute(select(self._model).where(column == value))
        return result.scalar_one_or_none()

    def assign(
        self, entity: ModelT, fields: Mapping[str, Any], *, skip_none: bool = False
    ) -> ModelT:
        """Set every key in `fields` as an attribute on `entity`. `skip_none`
        matches each service's current behavior exactly: False for book/
        category (an omitted key still overwrites with its Pydantic default
        of None), True for copy/member/staff (None means "leave unchanged")."""
        for key, value in fields.items():
            if skip_none and value is None:
                continue
            if hasattr(entity, key):
                setattr(entity, key, value)
        return entity

    async def list_paginated(
        self,
        *,
        filters: Sequence[ColumnElement[bool]] = (),
        sort_by: InstrumentedAttribute[Any] | None = None,
        sort_dir: SortDir = SortDir.ASC,
        limit: int = 100,
        offset: int = 0,
        options: Sequence[ExecutableOption] = (),
        joins: Sequence[InstrumentedAttribute[Any]] = (),
    ) -> tuple[Sequence[ModelT], int]:
        """Return one page of rows plus the total count matching `filters`.

        `filters` are ANDed and reused for the count query, so `total` always
        matches the filtered set. `joins` are LEFT OUTER (so a NULL relationship
        doesn't drop the row) and applied to both statements. A primary-key
        tiebreaker is always appended to ORDER BY for stable paging.
        """
        where = list(filters)

        stmt = select(self._model)
        for relationship in joins:
            stmt = stmt.outerjoin(relationship)
        if where:
            stmt = stmt.where(*where)
        if options:
            stmt = stmt.options(*options)

        order_by: list[ColumnElement[Any]] = []
        if sort_by is not None:
            order_by.append(sort_by.desc() if sort_dir is SortDir.DESC else sort_by.asc())
        order_by.extend(column.asc() for column in inspect(self._model).primary_key)

        stmt = stmt.order_by(*order_by).limit(limit).offset(offset)
        rows = (await self._session.execute(stmt)).scalars().all()

        count_stmt = select(func.count()).select_from(self._model)
        for relationship in joins:
            count_stmt = count_stmt.outerjoin(relationship)
        if where:
            count_stmt = count_stmt.where(*where)
        total = (await self._session.execute(count_stmt)).scalar_one()

        return rows, total
