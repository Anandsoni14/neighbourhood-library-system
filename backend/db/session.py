from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from core.config import get_settings

engine = create_async_engine(get_settings().database_url, pool_pre_ping=True)

AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    """Yields a session scoped to one request/operation, committing once on success.

    A service that calls the repository layer multiple times within a single
    request still shares this one session, so the whole operation commits or
    rolls back atomically at this boundary rather than per-repository-call.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
