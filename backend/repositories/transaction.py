from sqlalchemy.ext.asyncio import AsyncSession

from db.repository import BaseRepository
from models import Transaction


class TransactionRepository(BaseRepository[Transaction]):
    """Transaction repository.

    Listing and filtering go through BaseRepository.list_paginated, so this
    class only needs to bind the model.
    """

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Transaction)
