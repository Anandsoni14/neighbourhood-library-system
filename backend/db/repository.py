from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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

    async def list_all(self) -> Sequence[ModelT]:
        result = await self._session.execute(select(self._model))
        return result.scalars().all()
