from sqlalchemy.ext.asyncio import AsyncSession

from db.repository import BaseRepository
from models import Transaction


class TransactionRepository(BaseRepository[Transaction]):
    """Transaction repository — filtering goes through BaseRepository.list_paginated."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Transaction)
