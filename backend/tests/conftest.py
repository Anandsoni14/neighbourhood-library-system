from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.factory import create_app
from db.session import engine, get_db


@pytest.fixture
async def db() -> AsyncIterator[AsyncSession]:
    """Session scoped to one outer transaction, rolled back after the test.

    Uses SQLAlchemy's external-transaction test pattern (join_transaction_mode=
    "create_savepoint"): application code that calls session.commit() (e.g.
    db.session.get_db) actually commits into a savepoint, not the outer
    transaction, so the final rollback here discards everything regardless of
    how many commits happened during the test. This keeps tests from leaving
    permanent rows in the dev database and isolates tests from each other.
    """
    async with engine.connect() as connection:
        await connection.begin()
        test_sessionmaker = async_sessionmaker(
            bind=connection,
            join_transaction_mode="create_savepoint",
            expire_on_commit=False,
        )
        async with test_sessionmaker() as session:
            yield session
        await connection.rollback()


@pytest.fixture
async def client(db: AsyncSession) -> AsyncIterator[AsyncClient]:
    """HTTP client whose get_db dependency is overridden to share the test's `db` session."""
    app = create_app()

    async def _override_get_db() -> AsyncIterator[AsyncSession]:
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client
    app.dependency_overrides.clear()
