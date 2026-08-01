"""Idempotent sample-data seed.

Run by scripts/entrypoint.sh after migrations, only when SEED_SAMPLE_DATA=true.
Never invoked by pytest (a separate test_database_url is used instead).

PKs are derived deterministically via uuid5(SEED_NAMESPACE, "<kind>:<key>"), so
re-running against an already-seeded DB inserts nothing new. `staff`/`member`/
`book` are additionally checked by natural key (email/email/isbn), since a
hand-seeded admin account could predate this script under a different PK.
Existing rows are never updated, so local edits survive a restart.
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import NAMESPACE_URL, UUID, uuid5

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import hash_password
from db.session import AsyncSessionLocal, engine
from models import Book, BookCopy, Category, Loan, Member, Staff, Transaction
from models.enums import (
    CopyCondition,
    CopyStatus,
    LoanStatus,
    MembershipStatus,
    PaymentMode,
    StaffRole,
    StaffStatus,
    TransactionStatus,
    TransactionType,
)

logger = logging.getLogger(__name__)

# Fixed namespace so uuid5(SEED_NAMESPACE, key) is the same value on every run
# and every container restart.
SEED_NAMESPACE = uuid5(NAMESPACE_URL, "neighbour-library.seed")

# An arbitrary constant, just needs to be stable and unlikely to collide with
# a lock some other part of the app might take.
_ADVISORY_LOCK_KEY = 913_705_001


def _seed_id(key: str) -> UUID:
    return uuid5(SEED_NAMESPACE, key)


async def _get_or_create_category(
    session: AsyncSession, *, name: str, description: str | None = None, is_archived: bool = False
) -> Category:
    existing = (
        await session.execute(select(Category).where(Category.name == name))
    ).scalar_one_or_none()
    if existing:
        return existing
    category = Category(
        category_id=_seed_id(f"category:{name}"),
        name=name,
        description=description,
        is_archived=is_archived,
    )
    session.add(category)
    await session.flush()
    return category


async def _get_or_create_staff(
    session: AsyncSession,
    *,
    employee_code: str,
    first_name: str,
    last_name: str,
    email: str,
    password: str,
    role: StaffRole,
    status: StaffStatus = StaffStatus.ACTIVE,
) -> Staff:
    # Natural-key check (email), not a PK check — see module docstring.
    existing = (
        await session.execute(select(Staff).where(Staff.email == email))
    ).scalar_one_or_none()
    if existing:
        return existing
    staff = Staff(
        staff_id=_seed_id(f"staff:{email}"),
        employee_code=employee_code,
        first_name=first_name,
        last_name=last_name,
        email=email,
        password_hash=hash_password(password),
        role=role,
        status=status,
    )
    session.add(staff)
    await session.flush()
    return staff


async def _get_or_create_member(
    session: AsyncSession,
    *,
    first_name: str,
    last_name: str,
    email: str,
    phone_number: str,
    postal_code: str,
    membership_status: MembershipStatus = MembershipStatus.ACTIVE,
) -> Member:
    existing = (
        await session.execute(select(Member).where(Member.email == email))
    ).scalar_one_or_none()
    if existing:
        return existing
    member = Member(
        member_id=_seed_id(f"member:{email}"),
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone_number=phone_number,
        postal_code=postal_code,
        country="India",
        membership_status=membership_status,
    )
    session.add(member)
    await session.flush()
    return member


async def _get_or_create_book(
    session: AsyncSession,
    *,
    isbn: str,
    title: str,
    author: str,
    category: Category,
    published_year: int,
    is_archived: bool = False,
) -> Book:
    existing = (await session.execute(select(Book).where(Book.isbn == isbn))).scalar_one_or_none()
    if existing:
        return existing
    book = Book(
        book_id=_seed_id(f"book:{isbn}"),
        title=title,
        author=author,
        isbn=isbn,
        category_id=category.category_id,
        published_year=published_year,
        is_archived=is_archived,
    )
    session.add(book)
    await session.flush()
    return book


async def _get_or_create_copy(
    session: AsyncSession,
    *,
    barcode: str,
    book: Book,
    condition: CopyCondition = CopyCondition.GOOD,
) -> BookCopy:
    existing = (
        await session.execute(select(BookCopy).where(BookCopy.barcode == barcode))
    ).scalar_one_or_none()
    if existing:
        return existing
    copy = BookCopy(
        copy_id=_seed_id(f"copy:{barcode}"),
        book_id=book.book_id,
        barcode=barcode,
        condition=condition,
    )
    session.add(copy)
    await session.flush()
    return copy


async def _get_or_create_loan(
    session: AsyncSession, *, key: str, **fields: object
) -> tuple[Loan, bool]:
    """Returns (loan, created); callers only mutate the copy's status/condition
    when `created` is True, so a later reseed can't clobber a real status change."""
    loan_id = _seed_id(f"loan:{key}")
    existing = await session.get(Loan, loan_id)
    if existing:
        return existing, False
    loan = Loan(loan_id=loan_id, **fields)
    session.add(loan)
    await session.flush()
    return loan, True


async def _get_or_create_transaction(
    session: AsyncSession, *, key: str, **fields: object
) -> Transaction:
    transaction_id = _seed_id(f"transaction:{key}")
    existing = await session.get(Transaction, transaction_id)
    if existing:
        return existing
    transaction = Transaction(transaction_id=transaction_id, **fields)
    session.add(transaction)
    await session.flush()
    return transaction


async def seed(session: AsyncSession) -> None:
    """Populate a small, internally-consistent sample dataset."""
    # Scoped to this transaction; released automatically on commit/rollback.
    # Insurance against two seed processes racing on the same empty tables —
    # not currently possible (the entrypoint runs once per container) but
    # cheap to guard against if that ever changes.
    await session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": _ADVISORY_LOCK_KEY})

    now = datetime.now(UTC)

    # --- Categories ---------------------------------------------------
    category_names = [
        "Fiction",
        "Non-Fiction",
        "Science",
        "Technology",
        "History",
        "Biography",
        "Children",
        "Mystery",
        "Poetry",
        "Reference",
    ]
    categories = [await _get_or_create_category(session, name=name) for name in category_names]
    # One archived category, to exercise the archived filter.
    await _get_or_create_category(session, name="Periodicals", is_archived=True)

    # --- Staff ----------------------------------------------------------
    admin = await _get_or_create_staff(
        session,
        employee_code="LL-001",
        first_name="Admin",
        last_name="User",
        email="admin@locallibrary.com",
        password="admin$12345",
        role=StaffRole.ADMIN,
    )
    await _get_or_create_staff(
        session,
        employee_code="LL-002",
        first_name="Maria",
        last_name="Lopez",
        email="maria.lopez@locallibrary.com",
        password="librarian$2345",
        role=StaffRole.LIBRARIAN,
    )
    await _get_or_create_staff(
        session,
        employee_code="LL-003",
        first_name="James",
        last_name="Chen",
        email="james.chen@locallibrary.com",
        password="librarian$3456",
        role=StaffRole.LIBRARIAN,
    )
    await _get_or_create_staff(
        session,
        employee_code="LL-004",
        first_name="Priya",
        last_name="Singh",
        email="priya.singh@locallibrary.com",
        password="librarian$4567",
        role=StaffRole.LIBRARIAN,
        status=StaffStatus.INACTIVE,
    )

    # --- Books + copies ---------------------------------------------------
    book_specs = [
        ("Fiction", "The Silent Orchard", "Elena Marsh", 2015),
        ("Fiction", "A Long Way from Home", "Daniel Okafor", 2009),
        ("Fiction", "The Cartographer's Daughter", "Priya Menon", 2018),
        ("Non-Fiction", "Thinking in Systems", "Donella Meadows", 2008),
        ("Non-Fiction", "The Power of Habit", "Charles Duhigg", 2012),
        ("Science", "A Brief History of Time", "Stephen Hawking", 1988),
        ("Science", "The Selfish Gene", "Richard Dawkins", 1976),
        ("Science", "Cosmos", "Carl Sagan", 1980),
        ("Technology", "Clean Code", "Robert C. Martin", 2008),
        ("Technology", "The Pragmatic Programmer", "Andrew Hunt", 1999),
        ("Technology", "Designing Data-Intensive Applications", "Martin Kleppmann", 2017),
        ("Technology", "Refactoring", "Martin Fowler", 1999),
        ("History", "Sapiens", "Yuval Noah Harari", 2011),
        ("History", "Guns, Germs, and Steel", "Jared Diamond", 1997),
        ("Biography", "Steve Jobs", "Walter Isaacson", 2011),
        ("Biography", "Long Walk to Freedom", "Nelson Mandela", 1994),
        ("Children", "The Wind in the Willows", "Kenneth Grahame", 1908),
        ("Children", "Charlotte's Web", "E. B. White", 1952),
        ("Mystery", "The Hound of the Baskervilles", "Arthur Conan Doyle", 1902),
        ("Mystery", "Gone Girl", "Gillian Flynn", 2012),
        ("Poetry", "Leaves of Grass", "Walt Whitman", 1855),
        ("Poetry", "The Waste Land", "T. S. Eliot", 1922),
        ("Reference", "The Elements of Style", "William Strunk Jr.", 1918),
        ("Reference", "A Dictionary of Modern English Usage", "H. W. Fowler", 1926),
    ]
    category_by_name = {category.name: category for category in categories}

    books: list[Book] = []
    for index, (category_name, title, author, year) in enumerate(book_specs, start=1):
        # The last two books are archived, to exercise the archive filter and
        # the "cannot borrow / cannot add a copy to an archived book" rules.
        is_archived = index > len(book_specs) - 2
        book = await _get_or_create_book(
            session,
            isbn=f"SEED-ISBN-{index:04d}",
            title=title,
            author=author,
            category=category_by_name[category_name],
            published_year=year,
            is_archived=is_archived,
        )
        books.append(book)

    copies: list[BookCopy] = []
    barcode_counter = 1
    for index, book in enumerate(books):
        copies_for_book = 3 if index < 12 else 2
        for _ in range(copies_for_book):
            copy = await _get_or_create_copy(
                session,
                barcode=f"LMS-BC-{barcode_counter:04d}",
                book=book,
                condition=CopyCondition.GOOD if barcode_counter % 5 else CopyCondition.NEW,
            )
            copies.append(copy)
            barcode_counter += 1

    # --- Members ----------------------------------------------------------
    member_specs = [
        ("Ada", "Lovelace", "ada.lovelace@example.com", MembershipStatus.ACTIVE),
        ("Grace", "Hopper", "grace.hopper@example.com", MembershipStatus.ACTIVE),
        ("Alan", "Turing", "alan.turing@example.com", MembershipStatus.ACTIVE),
        ("Katherine", "Johnson", "katherine.johnson@example.com", MembershipStatus.ACTIVE),
        ("Margaret", "Hamilton", "margaret.hamilton@example.com", MembershipStatus.ACTIVE),
        ("Alonzo", "Church", "alonzo.church@example.com", MembershipStatus.ACTIVE),
        ("Radia", "Perlman", "radia.perlman@example.com", MembershipStatus.ACTIVE),
        ("Marcus", "Reed", "marcus.reed@example.com", MembershipStatus.BLOCKED),
        ("Sofia", "Alvarez", "sofia.alvarez@example.com", MembershipStatus.BLOCKED),
        ("Tobias", "Klein", "tobias.klein@example.com", MembershipStatus.INACTIVE),
    ]
    members: list[Member] = []
    for i, (first, last, email, status) in enumerate(member_specs, start=1):
        member = await _get_or_create_member(
            session,
            first_name=first,
            last_name=last,
            email=email,
            phone_number=f"90000{i:05d}",
            postal_code=f"5600{i:02d}",
            membership_status=status,
        )
        members.append(member)
    active_members = [
        m
        for m, (_, _, _, status) in zip(members, member_specs, strict=True)
        if status == MembershipStatus.ACTIVE
    ]

    # --- Loans --------------------------------------------------------
    # 6 ACTIVE, not yet due (borrowed 1..6 days ago, all due in the future).
    for i in range(6):
        borrowed_at = now - timedelta(days=i + 1)
        due_at = borrowed_at + timedelta(days=14)
        copy = copies[i]
        member = active_members[i % len(active_members)]
        loan, created = await _get_or_create_loan(
            session,
            key=f"active-not-due-{i}",
            copy_id=copy.copy_id,
            member_id=member.member_id,
            issued_by_staff_id=admin.staff_id,
            borrowed_at=borrowed_at,
            due_at=due_at,
            borrow_condition=copy.condition,
            status=LoanStatus.ACTIVE,
        )
        if created:
            copy.status = CopyStatus.BORROWED

    # 5 ACTIVE, overdue by a spread of day counts.
    overdue_days = [2, 3, 9, 21, 45]
    for i, days_overdue in enumerate(overdue_days):
        copy = copies[6 + i]
        member = active_members[i % len(active_members)]
        due_at = now - timedelta(days=days_overdue)
        borrowed_at = due_at - timedelta(days=14)
        loan, created = await _get_or_create_loan(
            session,
            key=f"active-overdue-{days_overdue}",
            copy_id=copy.copy_id,
            member_id=member.member_id,
            issued_by_staff_id=admin.staff_id,
            borrowed_at=borrowed_at,
            due_at=due_at,
            borrow_condition=copy.condition,
            status=LoanStatus.ACTIVE,
        )
        if created:
            copy.status = CopyStatus.BORROWED

    # 8 RETURNED, half on time (no fine), half late (a fine each).
    returned_fines = [Decimal("0.00"), Decimal("0.00"), Decimal("0.00"), Decimal("0.00")]
    returned_fines += [Decimal("10.00"), Decimal("25.00"), Decimal("50.00"), Decimal("75.00")]
    for i, fine in enumerate(returned_fines):
        copy = copies[11 + i]
        member = active_members[i % len(active_members)]
        borrowed_at = now - timedelta(days=30 + i)
        due_at = borrowed_at + timedelta(days=14)
        # Every seeded copy uses the default $5.00/day late fee, so the days
        # late implied by `fine` is exactly fine / 5 — keeping returned_at
        # consistent with the fine rather than just plausible-looking.
        days_late = int(fine / Decimal("5.00"))
        returned_at = (
            due_at + timedelta(days=days_late) if days_late else due_at - timedelta(days=1)
        )
        loan, created = await _get_or_create_loan(
            session,
            key=f"returned-{i}",
            copy_id=copy.copy_id,
            member_id=member.member_id,
            issued_by_staff_id=admin.staff_id,
            received_by_staff_id=admin.staff_id,
            borrowed_at=borrowed_at,
            due_at=due_at,
            returned_at=returned_at,
            closed_at=returned_at,
            borrow_condition=copy.condition,
            return_condition=copy.condition,
            status=LoanStatus.RETURNED,
            calculated_fine=fine,
        )
        if created:
            copy.status = CopyStatus.AVAILABLE

    # --- Transactions -------------------------------------------------
    fined_member = active_members[0]
    await _get_or_create_transaction(
        session,
        key="late-fee-pending-1",
        member_id=fined_member.member_id,
        transaction_type=TransactionType.LATE_FEE,
        payment_mode=PaymentMode.CASH,
        amount=Decimal("10.00"),
        status=TransactionStatus.PENDING,
    )
    await _get_or_create_transaction(
        session,
        key="late-fee-success-1",
        member_id=active_members[1 % len(active_members)].member_id,
        transaction_type=TransactionType.LATE_FEE,
        payment_mode=PaymentMode.UPI,
        amount=Decimal("25.00"),
        status=TransactionStatus.SUCCESS,
    )
    await _get_or_create_transaction(
        session,
        key="late-fee-waived-1",
        member_id=active_members[2 % len(active_members)].member_id,
        transaction_type=TransactionType.WAIVER,
        payment_mode=None,
        amount=Decimal("50.00"),
        status=TransactionStatus.WAIVED,
    )

    await session.commit()
    logger.info("seed_complete")


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    async with AsyncSessionLocal() as session:
        await seed(session)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
