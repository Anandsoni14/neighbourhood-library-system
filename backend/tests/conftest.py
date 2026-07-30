from collections.abc import AsyncIterator
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.config import Config as AlembicConfig
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from alembic import command
from app.factory import create_app
from core.config import get_settings
from core.security import create_access_token
from db.session import get_db
from models.enums import StaffRole
from services.staff import StaffService

# A dedicated engine against `test_database_url`, never the dev database's
# `database_url`. `get_db` is dependency-overridden below for every test (see
# `client`), so db.session.engine is never touched by the suite regardless —
# this just makes the separation explicit and lets `db` below point somewhere
# that is never seeded with sample data.
test_engine = create_async_engine(get_settings().test_database_url, pool_pre_ping=True)

_BACKEND_DIR = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session", autouse=True)
def _migrate_test_database() -> None:
    """Bring `test_database_url` to head once per test session.

    Every model's PGENUM column declares create_type=False (the type is
    created once, by whichever table's migration adds it first), so a bare
    Base.metadata.create_all() cannot stand the schema up from an empty
    database — Alembic has to run. alembic/env.py only defaults to
    `database_url` when the Config's sqlalchemy.url is still unset, so setting
    it here first (to the test database) is what keeps this from touching the
    dev database instead.
    """
    cfg = AlembicConfig(str(_BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", get_settings().test_database_url)
    command.upgrade(cfg, "head")


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
    async with test_engine.connect() as connection:
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


@pytest.fixture
async def staff_service(db: AsyncSession) -> StaffService:
    return StaffService(db)


@pytest.fixture
async def librarian_headers(staff_service: StaffService) -> dict[str, str]:
    """Bearer-token headers for a freshly created LIBRARIAN.

    Books/members/book-copies/transactions/categories only require *some*
    authenticated staff (unlike staff-management, which is ADMIN-gated), so
    most tests across those routers use this rather than `admin_headers`.
    """
    librarian = await staff_service.create_staff(
        employee_code=f"LIB-{uuid4().hex[:8]}",
        first_name="Lib",
        last_name="User",
        email=f"{uuid4()}@library.com",
        password="libpassword123",
        role=StaffRole.LIBRARIAN,
    )
    token = create_access_token(librarian.staff_id, librarian.role)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def admin_headers(staff_service: StaffService) -> dict[str, str]:
    """Bearer-token headers for a freshly created ADMIN, for the ADMIN-only
    staff-management endpoints."""
    admin = await staff_service.create_staff(
        employee_code=f"ADMIN-{uuid4().hex[:8]}",
        first_name="Admin",
        last_name="User",
        email=f"{uuid4()}@library.com",
        password="adminpass123",
        role=StaffRole.ADMIN,
    )
    token = create_access_token(admin.staff_id, admin.role)
    return {"Authorization": f"Bearer {token}"}
