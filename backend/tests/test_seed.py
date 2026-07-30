"""Tests for scripts/seed.py — the sample-data seed run by the Docker
entrypoint. Never run against the dev database; `db` here is the same
rollback-scoped, `test_database_url`-backed session every other test uses.
"""

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import (
    Book,
    BookCopy,
    Category,
    Loan,
    LoanStatus,
    Member,
    Staff,
    StaffRole,
    Transaction,
)
from scripts.seed import seed

_SEEDED_MODELS = (Category, Staff, Book, BookCopy, Member, Loan, Transaction)


async def _counts(session: AsyncSession) -> dict[type, int]:
    counts: dict[type, int] = {}
    for model in _SEEDED_MODELS:
        result = await session.execute(select(func.count()).select_from(model))
        counts[model] = result.scalar_one()
    return counts


async def test_seed_is_idempotent(db: AsyncSession) -> None:
    """Running the seed twice must not duplicate a single row — this is the
    property the Docker entrypoint depends on across every container restart."""
    await seed(db)
    first_run_counts = await _counts(db)
    assert all(count > 0 for count in first_run_counts.values())

    await seed(db)
    second_run_counts = await _counts(db)

    assert first_run_counts == second_run_counts


async def test_seed_creates_the_documented_admin_account(db: AsyncSession) -> None:
    await seed(db)

    admin = (
        await db.execute(select(Staff).where(Staff.email == "admin@locallibrary.com"))
    ).scalar_one()

    assert admin.employee_code == "LL-001"
    assert admin.role == StaffRole.ADMIN

    # Re-running must not create a second row under the same natural key —
    # this is the specific scenario the "hand-seeded before this script
    # existed" note in seed.py's docstring is guarding against.
    await seed(db)
    admins = (
        (await db.execute(select(Staff).where(Staff.email == "admin@locallibrary.com")))
        .scalars()
        .all()
    )
    assert len(admins) == 1


async def test_seed_produces_overdue_active_loans(db: AsyncSession) -> None:
    """The dashboard's overdue view needs real data to be meaningful."""
    await seed(db)

    result = await db.execute(
        select(Loan).where(Loan.status == LoanStatus.ACTIVE, Loan.due_at < datetime.now(UTC))
    )
    overdue = result.scalars().all()

    assert len(overdue) >= 5


async def test_seed_leaves_at_least_one_archived_book_and_category(db: AsyncSession) -> None:
    await seed(db)

    archived_books = (
        await db.execute(select(func.count()).select_from(Book).where(Book.is_archived.is_(True)))
    ).scalar_one()
    archived_categories = (
        await db.execute(
            select(func.count()).select_from(Category).where(Category.is_archived.is_(True))
        )
    ).scalar_one()

    assert archived_books >= 1
    assert archived_categories >= 1
