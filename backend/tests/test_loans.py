from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import (
    BookUnavailableException,
    LoanAlreadyReturnedException,
    LoanNotFoundException,
    MemberNotEligibleException,
    NotFoundError,
)
from core.security import create_access_token
from models import Loan
from models.book import BookCopy
from models.enums import CopyCondition, CopyStatus, LoanStatus
from models.member import Member
from models.staff import Staff
from services.book import BookService
from services.book_copy import BookCopyService
from services.loan import LoanService
from services.member import MemberService
from services.staff import StaffService


@pytest.fixture
async def book_service(db: AsyncSession) -> BookService:
    return BookService(db)


@pytest.fixture
async def copy_service(db: AsyncSession) -> BookCopyService:
    return BookCopyService(db)


@pytest.fixture
async def member_service(db: AsyncSession) -> MemberService:
    return MemberService(db)


@pytest.fixture
async def staff_service(db: AsyncSession) -> StaffService:
    return StaffService(db)


@pytest.fixture
async def loan_service(db: AsyncSession) -> LoanService:
    return LoanService(db)


async def _make_copy(
    book_service: BookService, copy_service: BookCopyService, **overrides: Any
) -> BookCopy:
    book = await book_service.create_book(title="Test Book", author="Test Author")
    kwargs: dict[str, Any] = {"book_id": book.book_id, "barcode": f"BC-{uuid4()}"}
    kwargs.update(overrides)
    return await copy_service.create_copy(**kwargs)


async def _make_member(member_service: MemberService, **overrides: Any) -> Member:
    kwargs: dict[str, Any] = {
        "first_name": "Jane",
        "last_name": "Doe",
        "email": f"{uuid4()}@example.com",
    }
    kwargs.update(overrides)
    return await member_service.create_member(**kwargs)


async def _make_staff(staff_service: StaffService, **overrides: Any) -> Staff:
    kwargs: dict[str, Any] = {
        "employee_code": f"EMP-{uuid4().hex[:8]}",
        "first_name": "Staff",
        "last_name": "Member",
        "email": f"{uuid4()}@library.com",
        "password": "password123",
    }
    kwargs.update(overrides)
    return await staff_service.create_staff(**kwargs)


class TestLoanService:
    """Test LoanService business logic."""

    async def test_issue_loan(
        self,
        book_service: BookService,
        copy_service: BookCopyService,
        member_service: MemberService,
        staff_service: StaffService,
        loan_service: LoanService,
    ) -> None:
        copy = await _make_copy(book_service, copy_service)
        member = await _make_member(member_service)
        staff = await _make_staff(staff_service)

        loan = await loan_service.issue_loan(
            copy_id=copy.copy_id, member_id=member.member_id, issued_by_staff_id=staff.staff_id
        )

        assert loan.status == LoanStatus.ACTIVE
        assert loan.borrow_condition == copy.condition
        assert loan.due_at == loan.borrowed_at + timedelta(days=copy.max_borrow_days)

        refreshed_copy = await copy_service.get_copy(copy.copy_id)
        assert refreshed_copy.status == CopyStatus.BORROWED

    async def test_issue_loan_blocked_member_raises(
        self,
        book_service: BookService,
        copy_service: BookCopyService,
        member_service: MemberService,
        staff_service: StaffService,
        loan_service: LoanService,
    ) -> None:
        copy = await _make_copy(book_service, copy_service)
        member = await _make_member(member_service)
        await member_service.update_member(member.member_id, membership_status="BLOCKED")
        staff = await _make_staff(staff_service)

        with pytest.raises(MemberNotEligibleException):
            await loan_service.issue_loan(
                copy_id=copy.copy_id,
                member_id=member.member_id,
                issued_by_staff_id=staff.staff_id,
            )

    async def test_issue_loan_inactive_member_raises(
        self,
        book_service: BookService,
        copy_service: BookCopyService,
        member_service: MemberService,
        staff_service: StaffService,
        loan_service: LoanService,
    ) -> None:
        copy = await _make_copy(book_service, copy_service)
        member = await _make_member(member_service)
        await member_service.update_member(member.member_id, membership_status="INACTIVE")
        staff = await _make_staff(staff_service)

        with pytest.raises(MemberNotEligibleException):
            await loan_service.issue_loan(
                copy_id=copy.copy_id,
                member_id=member.member_id,
                issued_by_staff_id=staff.staff_id,
            )

    async def test_issue_loan_unavailable_copy_raises(
        self,
        book_service: BookService,
        copy_service: BookCopyService,
        member_service: MemberService,
        staff_service: StaffService,
        loan_service: LoanService,
    ) -> None:
        copy = await _make_copy(book_service, copy_service)
        member = await _make_member(member_service)
        staff = await _make_staff(staff_service)
        await loan_service.issue_loan(
            copy_id=copy.copy_id, member_id=member.member_id, issued_by_staff_id=staff.staff_id
        )

        other_member = await _make_member(member_service)
        with pytest.raises(BookUnavailableException):
            await loan_service.issue_loan(
                copy_id=copy.copy_id,
                member_id=other_member.member_id,
                issued_by_staff_id=staff.staff_id,
            )

    async def test_issue_loan_member_not_found_raises(
        self,
        book_service: BookService,
        copy_service: BookCopyService,
        staff_service: StaffService,
        loan_service: LoanService,
    ) -> None:
        copy = await _make_copy(book_service, copy_service)
        staff = await _make_staff(staff_service)
        with pytest.raises(NotFoundError):
            await loan_service.issue_loan(
                copy_id=copy.copy_id, member_id=uuid4(), issued_by_staff_id=staff.staff_id
            )

    async def test_issue_loan_copy_not_found_raises(
        self,
        member_service: MemberService,
        staff_service: StaffService,
        loan_service: LoanService,
    ) -> None:
        member = await _make_member(member_service)
        staff = await _make_staff(staff_service)
        with pytest.raises(NotFoundError):
            await loan_service.issue_loan(
                copy_id=uuid4(), member_id=member.member_id, issued_by_staff_id=staff.staff_id
            )

    async def test_issue_loan_staff_not_found_raises(
        self,
        book_service: BookService,
        copy_service: BookCopyService,
        member_service: MemberService,
        loan_service: LoanService,
    ) -> None:
        copy = await _make_copy(book_service, copy_service)
        member = await _make_member(member_service)
        with pytest.raises(NotFoundError):
            await loan_service.issue_loan(
                copy_id=copy.copy_id, member_id=member.member_id, issued_by_staff_id=uuid4()
            )

    async def test_issue_loan_double_issue_raises_conflict(
        self,
        book_service: BookService,
        copy_service: BookCopyService,
        member_service: MemberService,
        staff_service: StaffService,
        loan_service: LoanService,
        db: AsyncSession,
    ) -> None:
        copy = await _make_copy(book_service, copy_service)
        member = await _make_member(member_service)
        staff = await _make_staff(staff_service)

        # Pre-create a competing ACTIVE loan directly via the repository,
        # bypassing the service, so issue_loan's pre-check is what catches it.
        competing_loan = Loan(
            copy_id=copy.copy_id,
            member_id=member.member_id,
            issued_by_staff_id=staff.staff_id,
            due_at=datetime.now(UTC) + timedelta(days=14),
            borrow_condition=copy.condition,
        )
        await loan_service.repository.add(competing_loan)

        with pytest.raises(BookUnavailableException):
            await loan_service.issue_loan(
                copy_id=copy.copy_id,
                member_id=member.member_id,
                issued_by_staff_id=staff.staff_id,
            )

    async def test_return_loan_no_fee(
        self,
        book_service: BookService,
        copy_service: BookCopyService,
        member_service: MemberService,
        staff_service: StaffService,
        loan_service: LoanService,
    ) -> None:
        copy = await _make_copy(book_service, copy_service)
        member = await _make_member(member_service)
        staff = await _make_staff(staff_service)
        loan = await loan_service.issue_loan(
            copy_id=copy.copy_id, member_id=member.member_id, issued_by_staff_id=staff.staff_id
        )

        returned = await loan_service.return_loan(
            loan_id=loan.loan_id,
            return_condition=CopyCondition.GOOD,
            received_by_staff_id=staff.staff_id,
        )

        assert returned.status == LoanStatus.RETURNED
        assert returned.calculated_fine == Decimal("0.00")
        assert returned.returned_at is not None
        assert returned.closed_at is not None

        refreshed_copy = await copy_service.get_copy(copy.copy_id)
        assert refreshed_copy.status == CopyStatus.AVAILABLE
        assert refreshed_copy.condition == CopyCondition.GOOD

    async def test_return_loan_with_overdue_fee(
        self,
        book_service: BookService,
        copy_service: BookCopyService,
        member_service: MemberService,
        staff_service: StaffService,
        loan_service: LoanService,
        db: AsyncSession,
    ) -> None:
        copy = await _make_copy(book_service, copy_service, late_fee_per_day=Decimal("2.50"))
        member = await _make_member(member_service)
        staff = await _make_staff(staff_service)
        loan = await loan_service.issue_loan(
            copy_id=copy.copy_id, member_id=member.member_id, issued_by_staff_id=staff.staff_id
        )

        # Backdate both borrowed_at and due_at (chk_loan_due_after_borrow requires
        # due_at > borrowed_at). due_at is set 2.5 days ago, comfortably inside the
        # (2, 3] day window so ceil() deterministically yields 3 overdue days
        # regardless of the small delay between this assignment and return_loan().
        loan.borrowed_at = datetime.now(UTC) - timedelta(days=17)
        loan.due_at = datetime.now(UTC) - timedelta(days=2, hours=12)
        db.add(loan)
        await db.flush()

        returned = await loan_service.return_loan(
            loan_id=loan.loan_id,
            return_condition=CopyCondition.GOOD,
            received_by_staff_id=staff.staff_id,
        )

        assert returned.calculated_fine == Decimal("7.50")

    async def test_return_loan_damaged_sets_maintenance(
        self,
        book_service: BookService,
        copy_service: BookCopyService,
        member_service: MemberService,
        staff_service: StaffService,
        loan_service: LoanService,
    ) -> None:
        copy = await _make_copy(book_service, copy_service)
        member = await _make_member(member_service)
        staff = await _make_staff(staff_service)
        loan = await loan_service.issue_loan(
            copy_id=copy.copy_id, member_id=member.member_id, issued_by_staff_id=staff.staff_id
        )

        await loan_service.return_loan(
            loan_id=loan.loan_id,
            return_condition=CopyCondition.DAMAGED,
            received_by_staff_id=staff.staff_id,
        )

        refreshed_copy = await copy_service.get_copy(copy.copy_id)
        assert refreshed_copy.status == CopyStatus.MAINTENANCE
        assert refreshed_copy.condition == CopyCondition.DAMAGED

    async def test_return_already_returned_loan_raises(
        self,
        book_service: BookService,
        copy_service: BookCopyService,
        member_service: MemberService,
        staff_service: StaffService,
        loan_service: LoanService,
    ) -> None:
        copy = await _make_copy(book_service, copy_service)
        member = await _make_member(member_service)
        staff = await _make_staff(staff_service)
        loan = await loan_service.issue_loan(
            copy_id=copy.copy_id, member_id=member.member_id, issued_by_staff_id=staff.staff_id
        )
        await loan_service.return_loan(
            loan_id=loan.loan_id,
            return_condition=CopyCondition.GOOD,
            received_by_staff_id=staff.staff_id,
        )

        with pytest.raises(LoanAlreadyReturnedException):
            await loan_service.return_loan(
                loan_id=loan.loan_id,
                return_condition=CopyCondition.GOOD,
                received_by_staff_id=staff.staff_id,
            )

    async def test_return_loan_not_found_raises(self, loan_service: LoanService) -> None:
        with pytest.raises(LoanNotFoundException):
            await loan_service.return_loan(
                loan_id=uuid4(),
                return_condition=CopyCondition.GOOD,
                received_by_staff_id=uuid4(),
            )

    async def test_return_loan_receiving_staff_not_found_raises(
        self,
        book_service: BookService,
        copy_service: BookCopyService,
        member_service: MemberService,
        staff_service: StaffService,
        loan_service: LoanService,
    ) -> None:
        copy = await _make_copy(book_service, copy_service)
        member = await _make_member(member_service)
        staff = await _make_staff(staff_service)
        loan = await loan_service.issue_loan(
            copy_id=copy.copy_id, member_id=member.member_id, issued_by_staff_id=staff.staff_id
        )

        with pytest.raises(NotFoundError):
            await loan_service.return_loan(
                loan_id=loan.loan_id,
                return_condition=CopyCondition.GOOD,
                received_by_staff_id=uuid4(),
            )

    async def test_list_loans_by_member(
        self,
        book_service: BookService,
        copy_service: BookCopyService,
        member_service: MemberService,
        staff_service: StaffService,
        loan_service: LoanService,
    ) -> None:
        copy = await _make_copy(book_service, copy_service)
        member = await _make_member(member_service)
        staff = await _make_staff(staff_service)
        await loan_service.issue_loan(
            copy_id=copy.copy_id, member_id=member.member_id, issued_by_staff_id=staff.staff_id
        )

        results, total = await loan_service.list_loans(member_id=member.member_id)
        assert total == 1
        assert len(results) == 1

    async def test_list_loans_by_status(
        self,
        book_service: BookService,
        copy_service: BookCopyService,
        member_service: MemberService,
        staff_service: StaffService,
        loan_service: LoanService,
    ) -> None:
        copy = await _make_copy(book_service, copy_service)
        member = await _make_member(member_service)
        staff = await _make_staff(staff_service)
        await loan_service.issue_loan(
            copy_id=copy.copy_id, member_id=member.member_id, issued_by_staff_id=staff.staff_id
        )

        results, total = await loan_service.list_loans(status=LoanStatus.ACTIVE)
        assert total == 1
        assert len(results) == 1

    async def test_list_loans_combines_member_and_status(
        self,
        book_service: BookService,
        copy_service: BookCopyService,
        member_service: MemberService,
        staff_service: StaffService,
        loan_service: LoanService,
    ) -> None:
        """Regression: member_id and status used to be mutually exclusive."""
        staff = await _make_staff(staff_service)
        member = await _make_member(member_service)
        returned_copy = await _make_copy(book_service, copy_service)
        active_copy = await _make_copy(book_service, copy_service)

        returned_loan = await loan_service.issue_loan(
            copy_id=returned_copy.copy_id,
            member_id=member.member_id,
            issued_by_staff_id=staff.staff_id,
        )
        await loan_service.return_loan(
            loan_id=returned_loan.loan_id,
            return_condition=CopyCondition.GOOD,
            received_by_staff_id=staff.staff_id,
        )
        active_loan = await loan_service.issue_loan(
            copy_id=active_copy.copy_id,
            member_id=member.member_id,
            issued_by_staff_id=staff.staff_id,
        )

        results, total = await loan_service.list_loans(
            member_id=member.member_id, status=LoanStatus.ACTIVE
        )

        assert total == 1
        assert results[0].loan_id == active_loan.loan_id

    async def test_get_loan_not_found_raises(self, loan_service: LoanService) -> None:
        with pytest.raises(LoanNotFoundException):
            await loan_service.get_loan(uuid4())

    async def test_issue_loan_on_archived_book_raises(
        self,
        book_service: BookService,
        copy_service: BookCopyService,
        member_service: MemberService,
        staff_service: StaffService,
        loan_service: LoanService,
    ) -> None:
        copy = await _make_copy(book_service, copy_service)
        await book_service.archive_book(copy.book_id)
        member = await _make_member(member_service)
        staff = await _make_staff(staff_service)

        with pytest.raises(BookUnavailableException):
            await loan_service.issue_loan(
                copy_id=copy.copy_id, member_id=member.member_id, issued_by_staff_id=staff.staff_id
            )

    async def test_return_loan_on_archived_book_still_works(
        self,
        book_service: BookService,
        copy_service: BookCopyService,
        member_service: MemberService,
        staff_service: StaffService,
        loan_service: LoanService,
    ) -> None:
        """Archiving only blocks *new* loans; an outstanding one must still be
        returnable so the copy doesn't get stuck BORROWED forever."""
        copy = await _make_copy(book_service, copy_service)
        member = await _make_member(member_service)
        staff = await _make_staff(staff_service)
        loan = await loan_service.issue_loan(
            copy_id=copy.copy_id, member_id=member.member_id, issued_by_staff_id=staff.staff_id
        )
        await book_service.archive_book(copy.book_id)

        returned = await loan_service.return_loan(
            loan_id=loan.loan_id,
            return_condition=CopyCondition.GOOD,
            received_by_staff_id=staff.staff_id,
        )

        assert returned.status == LoanStatus.RETURNED


class TestLoansAPI:
    """Test Loans API endpoints."""

    async def _setup_loan_prerequisites(
        self, client: AsyncClient, db: AsyncSession
    ) -> dict[str, Any]:
        # Staff creation is ADMIN-gated; bootstrap directly via the service
        # (bypassing HTTP/auth) rather than chicken-and-egging a token first.
        # Every other resource here (books/members/book-copies) is behind
        # get_current_staff, so this token is built first and reused below.
        staff = await StaffService(db).create_staff(
            employee_code=f"EMP-{uuid4().hex[:8]}",
            first_name="API",
            last_name="Staff",
            email=f"{uuid4()}@library.com",
            password="password123",
        )
        token = create_access_token(staff.staff_id, staff.role)
        headers = {"Authorization": f"Bearer {token}"}

        book_resp = await client.post(
            "/api/v1/books",
            json={"title": "API Test Book", "author": "Author"},
            headers=headers,
        )
        book_id = book_resp.json()["book_id"]
        copy_resp = await client.post(
            "/api/v1/book-copies",
            json={"book_id": book_id, "barcode": f"API-{uuid4()}"},
            headers=headers,
        )
        copy_id = copy_resp.json()["copy_id"]
        member_resp = await client.post(
            "/api/v1/members",
            json={
                "first_name": "API",
                "last_name": "Member",
                "email": f"{uuid4()}@example.com",
            },
            headers=headers,
        )
        member_id = member_resp.json()["member_id"]

        return {"copy_id": copy_id, "member_id": member_id, "headers": headers}

    async def test_issue_loan_endpoint(self, client: AsyncClient, db: AsyncSession) -> None:
        ids = await self._setup_loan_prerequisites(client, db)
        response = await client.post(
            "/api/v1/loans",
            json={"copy_id": ids["copy_id"], "member_id": ids["member_id"]},
            headers=ids["headers"],
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "ACTIVE"
        assert data["calculated_fine"] == "0.00"

    async def test_issue_loan_endpoint_no_token_401(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        ids = await self._setup_loan_prerequisites(client, db)
        response = await client.post(
            "/api/v1/loans",
            json={"copy_id": ids["copy_id"], "member_id": ids["member_id"]},
        )
        assert response.status_code == 401

    async def test_issue_loan_endpoint_blocked_member_409(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        ids = await self._setup_loan_prerequisites(client, db)
        await client.put(
            f"/api/v1/members/{ids['member_id']}",
            json={"membership_status": "BLOCKED"},
            headers=ids["headers"],
        )
        response = await client.post(
            "/api/v1/loans",
            json={"copy_id": ids["copy_id"], "member_id": ids["member_id"]},
            headers=ids["headers"],
        )
        assert response.status_code == 409

    async def test_issue_loan_endpoint_unavailable_copy_409(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        ids = await self._setup_loan_prerequisites(client, db)
        await client.post(
            "/api/v1/loans",
            json={"copy_id": ids["copy_id"], "member_id": ids["member_id"]},
            headers=ids["headers"],
        )
        other_member_resp = await client.post(
            "/api/v1/members",
            json={
                "first_name": "Other",
                "last_name": "Member",
                "email": f"{uuid4()}@example.com",
            },
            headers=ids["headers"],
        )
        response = await client.post(
            "/api/v1/loans",
            json={
                "copy_id": ids["copy_id"],
                "member_id": other_member_resp.json()["member_id"],
            },
            headers=ids["headers"],
        )
        assert response.status_code == 409

    async def test_issue_loan_endpoint_not_found_404(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        ids = await self._setup_loan_prerequisites(client, db)
        response = await client.post(
            "/api/v1/loans",
            json={"copy_id": str(uuid4()), "member_id": ids["member_id"]},
            headers=ids["headers"],
        )
        assert response.status_code == 404

    async def test_issue_loan_endpoint_archived_book_409(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        ids = await self._setup_loan_prerequisites(client, db)
        copy = await db.get(BookCopy, ids["copy_id"])
        assert copy is not None
        await BookService(db).archive_book(copy.book_id)

        response = await client.post(
            "/api/v1/loans",
            json={"copy_id": ids["copy_id"], "member_id": ids["member_id"]},
            headers=ids["headers"],
        )
        assert response.status_code == 409

    async def test_return_loan_endpoint(self, client: AsyncClient, db: AsyncSession) -> None:
        ids = await self._setup_loan_prerequisites(client, db)
        issue_resp = await client.post(
            "/api/v1/loans",
            json={"copy_id": ids["copy_id"], "member_id": ids["member_id"]},
            headers=ids["headers"],
        )
        loan_id = issue_resp.json()["loan_id"]

        response = await client.post(
            f"/api/v1/loans/{loan_id}/return",
            json={"return_condition": "GOOD"},
            headers=ids["headers"],
        )
        assert response.status_code == 200
        assert response.json()["status"] == "RETURNED"

    async def test_return_loan_endpoint_already_returned_409(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        ids = await self._setup_loan_prerequisites(client, db)
        issue_resp = await client.post(
            "/api/v1/loans",
            json={"copy_id": ids["copy_id"], "member_id": ids["member_id"]},
            headers=ids["headers"],
        )
        loan_id = issue_resp.json()["loan_id"]
        await client.post(
            f"/api/v1/loans/{loan_id}/return",
            json={"return_condition": "GOOD"},
            headers=ids["headers"],
        )

        response = await client.post(
            f"/api/v1/loans/{loan_id}/return",
            json={"return_condition": "GOOD"},
            headers=ids["headers"],
        )
        assert response.status_code == 409

    async def test_return_loan_endpoint_not_found_404(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        ids = await self._setup_loan_prerequisites(client, db)
        response = await client.post(
            f"/api/v1/loans/{uuid4()}/return",
            json={"return_condition": "GOOD"},
            headers=ids["headers"],
        )
        assert response.status_code == 404

    async def test_list_loans_endpoint_by_member_filter(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        ids = await self._setup_loan_prerequisites(client, db)
        await client.post(
            "/api/v1/loans",
            json={"copy_id": ids["copy_id"], "member_id": ids["member_id"]},
            headers=ids["headers"],
        )

        response = await client.get(f"/api/v1/loans?member_id={ids['member_id']}")
        assert response.status_code == 200
        assert response.json()["total"] == 1

    async def test_list_loans_endpoint_by_status_filter(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        ids = await self._setup_loan_prerequisites(client, db)
        await client.post(
            "/api/v1/loans",
            json={"copy_id": ids["copy_id"], "member_id": ids["member_id"]},
            headers=ids["headers"],
        )

        response = await client.get("/api/v1/loans?status=ACTIVE")
        assert response.status_code == 200
        assert response.json()["total"] >= 1

    async def test_get_loan_endpoint(self, client: AsyncClient, db: AsyncSession) -> None:
        ids = await self._setup_loan_prerequisites(client, db)
        issue_resp = await client.post(
            "/api/v1/loans",
            json={"copy_id": ids["copy_id"], "member_id": ids["member_id"]},
            headers=ids["headers"],
        )
        loan_id = issue_resp.json()["loan_id"]

        response = await client.get(f"/api/v1/loans/{loan_id}")
        assert response.status_code == 200
        assert response.json()["loan_id"] == loan_id

    async def test_overdue_loans_endpoint(self, client: AsyncClient, db: AsyncSession) -> None:
        ids = await self._setup_loan_prerequisites(client, db)
        issue_resp = await client.post(
            "/api/v1/loans",
            json={"copy_id": ids["copy_id"], "member_id": ids["member_id"]},
            headers=ids["headers"],
        )
        loan_id = issue_resp.json()["loan_id"]

        # Backdate to comfortably inside the (2, 3] day window (see the fee-calc
        # test above) so ceil() deterministically yields 3 overdue days.
        loan = await db.get(Loan, loan_id)
        assert loan is not None
        loan.borrowed_at = datetime.now(UTC) - timedelta(days=20)
        loan.due_at = datetime.now(UTC) - timedelta(days=2, hours=12)
        db.add(loan)
        await db.flush()

        response = await client.get("/api/v1/loans/overdue")
        assert response.status_code == 200
        data = response.json()
        matching = [entry for entry in data["items"] if entry["loan_id"] == loan_id]
        assert len(matching) == 1
        assert matching[0]["days_overdue"] == 3
        assert Decimal(matching[0]["estimated_fine"]) == Decimal("15.00")

    async def test_overdue_loans_endpoint_excludes_not_yet_due(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        ids = await self._setup_loan_prerequisites(client, db)
        issue_resp = await client.post(
            "/api/v1/loans",
            json={"copy_id": ids["copy_id"], "member_id": ids["member_id"]},
            headers=ids["headers"],
        )
        loan_id = issue_resp.json()["loan_id"]

        response = await client.get("/api/v1/loans/overdue")
        assert response.status_code == 200
        assert loan_id not in [entry["loan_id"] for entry in response.json()["items"]]
