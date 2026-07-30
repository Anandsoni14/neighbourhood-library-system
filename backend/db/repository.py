from collections.abc import Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, func, inspect, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql.base import ExecutableOption

from core.pagination import SortDir
from db.base import Base


class BaseRepository[ModelT: Base]:
    """Generic persistence operations shared by all repositories.

    Contains no business logic and never commits: the owning session's
    commit/rollback boundary (see db.session.get_db) is what defines the
    transaction for a logical operation.
    """

    def __init__(self, session: AsyncSession, model: type[ModelT]) -> None:
        self._session = session
        self._model = model

    async def get_by_id(self, entity_id: UUID) -> ModelT | None:
        return await self._session.get(self._model, entity_id)

    async def add(self, entity: ModelT) -> ModelT:
        self._session.add(entity)
        await self._session.flush()
        return entity

    async def delete(self, entity: ModelT) -> None:
        await self._session.delete(entity)

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
        """Return one page of rows plus the total row count matching `filters`.

        LIMIT/OFFSET are applied in SQL, so the database returns only the page
        rather than the whole table for the application to slice.

        `filters` is a sequence of SQLAlchemy predicates ANDed together, which is
        what lets callers combine filters freely instead of having to pick
        exactly one. The count query reuses the same predicates, so `total`
        always describes the filtered set.

        `joins` is a sequence of relationship attributes LEFT OUTER JOINed onto
        both statements, so `filters`/`sort_by` may reference a related table's
        columns (e.g. sorting books by category name). OUTER rather than INNER so
        rows whose relationship is NULL are not silently dropped. The count query
        gets the same joins, otherwise a filter on a joined column would raise;
        joining many-to-one against a unique key cannot duplicate rows, so `total`
        stays correct.

        A primary-key tiebreaker is always appended to ORDER BY: without it, rows
        with equal sort values have no guaranteed relative order between queries,
        and a client paging through the result could see a row twice or miss one.
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
