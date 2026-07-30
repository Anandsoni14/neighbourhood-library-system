from decimal import Decimal
from typing import Any
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import (
    LoanMemberMismatchException,
    NotFoundError,
    TransactionNotFoundException,
    TransactionNotPendingException,
)
from models.book import BookCopy
from models.enums import PaymentMode, TransactionStatus, TransactionType
from models.loan import Loan
from models.member import Member
from models.staff import Staff
from services.book import BookService
from services.book_copy import BookCopyService
from services.loan import LoanService
from services.member import MemberService
from services.staff import StaffService
from services.transaction import TransactionService


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


@pytest.fixture
async def transaction_service(db: AsyncSession) -> TransactionService:
    return TransactionService(db)


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


async def _make_loan(
    book_service: BookService,
    copy_service: BookCopyService,
    member_service: MemberService,
    staff_service: StaffService,
    loan_service: LoanService,
) -> Loan:
    copy = await _make_copy(book_service, copy_service)
    member = await _make_member(member_service)
    staff = await _make_staff(staff_service)
    return await loan_service.issue_loan(
        copy_id=copy.copy_id, member_id=member.member_id, issued_by_staff_id=staff.staff_id
    )


class TestTransactionService:
    """Test TransactionService business logic."""

    async def test_create_late_fee_transaction(
        self,
        book_service: BookService,
        copy_service: BookCopyService,
        member_service: MemberService,
        staff_service: StaffService,
        loan_service: LoanService,
        transaction_service: TransactionService,
    ) -> None:
        loan = await _make_loan(
            book_service, copy_service, member_service, staff_service, loan_service
        )

        transaction = await transaction_service.create_transaction(
            member_id=loan.member_id,
            transaction_type=TransactionType.LATE_FEE,
            amount=Decimal("7.50"),
            loan_id=loan.loan_id,
        )

        assert transaction.status == TransactionStatus.PENDING
        assert transaction.payment_mode is None
        assert transaction.amount == Decimal("7.50")

    async def test_create_waiver_is_immediately_waived(
        self, member_service: MemberService, transaction_service: TransactionService
    ) -> None:
        member = await _make_member(member_service)

        transaction = await transaction_service.create_transaction(
            member_id=member.member_id,
            transaction_type=TransactionType.WAIVER,
            amount=Decimal("5.00"),
        )

        assert transaction.status == TransactionStatus.WAIVED
        assert transaction.payment_mode is None

    async def test_create_transaction_member_not_found_raises(
        self, transaction_service: TransactionService
    ) -> None:
        with pytest.raises(NotFoundError):
            await transaction_service.create_transaction(
                member_id=uuid4(),
                transaction_type=TransactionType.LATE_FEE,
                amount=Decimal("5.00"),
            )

    async def test_create_transaction_loan_not_found_raises(
        self, member_service: MemberService, transaction_service: TransactionService
    ) -> None:
        member = await _make_member(member_service)
        with pytest.raises(NotFoundError):
            await transaction_service.create_transaction(
                member_id=member.member_id,
                transaction_type=TransactionType.LATE_FEE,
                amount=Decimal("5.00"),
                loan_id=uuid4(),
            )

    async def test_create_transaction_loan_member_mismatch_raises(
        self,
        book_service: BookService,
        copy_service: BookCopyService,
        member_service: MemberService,
        staff_service: StaffService,
        loan_service: LoanService,
        transaction_service: TransactionService,
    ) -> None:
        loan = await _make_loan(
            book_service, copy_service, member_service, staff_service, loan_service
        )
        other_member = await _make_member(member_service)

        with pytest.raises(LoanMemberMismatchException):
            await transaction_service.create_transaction(
                member_id=other_member.member_id,
                transaction_type=TransactionType.LATE_FEE,
                amount=Decimal("5.00"),
                loan_id=loan.loan_id,
            )

    async def test_record_payment_marks_success(
        self, member_service: MemberService, transaction_service: TransactionService
    ) -> None:
        member = await _make_member(member_service)
        transaction = await transaction_service.create_transaction(
            member_id=member.member_id,
            transaction_type=TransactionType.DAMAGE_FEE,
            amount=Decimal("20.00"),
        )

        paid = await transaction_service.record_payment(
            transaction_id=transaction.transaction_id,
            payment_mode=PaymentMode.CASH,
            payment_reference="RCPT-1",
        )

        assert paid.status == TransactionStatus.SUCCESS
        assert paid.payment_mode == PaymentMode.CASH
        assert paid.payment_reference == "RCPT-1"

    async def test_record_payment_not_found_raises(
        self, transaction_service: TransactionService
    ) -> None:
        with pytest.raises(TransactionNotFoundException):
            await transaction_service.record_payment(
                transaction_id=uuid4(), payment_mode=PaymentMode.CASH
            )

    async def test_record_payment_on_already_settled_raises(
        self, member_service: MemberService, transaction_service: TransactionService
    ) -> None:
        member = await _make_member(member_service)
        transaction = await transaction_service.create_transaction(
            member_id=member.member_id,
            transaction_type=TransactionType.DAMAGE_FEE,
            amount=Decimal("20.00"),
        )
        await transaction_service.record_payment(
            transaction_id=transaction.transaction_id, payment_mode=PaymentMode.CASH
        )

        with pytest.raises(TransactionNotPendingException):
            await transaction_service.record_payment(
                transaction_id=transaction.transaction_id, payment_mode=PaymentMode.CARD
            )

    async def test_mark_failed(
        self, member_service: MemberService, transaction_service: TransactionService
    ) -> None:
        member = await _make_member(member_service)
        transaction = await transaction_service.create_transaction(
            member_id=member.member_id,
            transaction_type=TransactionType.LATE_FEE,
            amount=Decimal("3.00"),
        )

        failed = await transaction_service.mark_failed(
            transaction_id=transaction.transaction_id, payment_mode=PaymentMode.ONLINE
        )

        assert failed.status == TransactionStatus.FAILED

    async def test_waive_transaction(
        self, member_service: MemberService, transaction_service: TransactionService
    ) -> None:
        member = await _make_member(member_service)
        transaction = await transaction_service.create_transaction(
            member_id=member.member_id,
            transaction_type=TransactionType.LATE_FEE,
            amount=Decimal("3.00"),
        )

        waived = await transaction_service.waive_transaction(transaction.transaction_id)

        assert waived.status == TransactionStatus.WAIVED
        assert waived.payment_mode is None

    async def test_waive_already_waived_raises(
        self, member_service: MemberService, transaction_service: TransactionService
    ) -> None:
        member = await _make_member(member_service)
        transaction = await transaction_service.create_transaction(
            member_id=member.member_id,
            transaction_type=TransactionType.WAIVER,
            amount=Decimal("3.00"),
        )

        with pytest.raises(TransactionNotPendingException):
            await transaction_service.waive_transaction(transaction.transaction_id)

    async def test_list_transactions_by_member(
        self, member_service: MemberService, transaction_service: TransactionService
    ) -> None:
        member = await _make_member(member_service)
        await transaction_service.create_transaction(
            member_id=member.member_id,
            transaction_type=TransactionType.LATE_FEE,
            amount=Decimal("3.00"),
        )

        results, total = await transaction_service.list_transactions(member_id=member.member_id)
        assert total == 1
        assert len(results) == 1

    async def test_list_transactions_by_status(
        self, member_service: MemberService, transaction_service: TransactionService
    ) -> None:
        member = await _make_member(member_service)
        await transaction_service.create_transaction(
            member_id=member.member_id,
            transaction_type=TransactionType.LATE_FEE,
            amount=Decimal("3.00"),
        )

        results, total = await transaction_service.list_transactions(
            status=TransactionStatus.PENDING
        )
        assert total >= 1
        assert len(results) >= 1

    async def test_list_transactions_combines_member_and_status(
        self, member_service: MemberService, transaction_service: TransactionService
    ) -> None:
        """Regression: member_id and status used to be mutually exclusive, so
        "this member's outstanding fees" silently returned every member's."""
        member = await _make_member(member_service)
        other = await _make_member(member_service)
        pending = await transaction_service.create_transaction(
            member_id=member.member_id,
            transaction_type=TransactionType.LATE_FEE,
            amount=Decimal("4.00"),
        )
        settled = await transaction_service.create_transaction(
            member_id=member.member_id,
            transaction_type=TransactionType.LATE_FEE,
            amount=Decimal("6.00"),
        )
        await transaction_service.waive_transaction(settled.transaction_id)
        await transaction_service.create_transaction(
            member_id=other.member_id,
            transaction_type=TransactionType.LATE_FEE,
            amount=Decimal("9.00"),
        )

        results, total = await transaction_service.list_transactions(
            member_id=member.member_id, status=TransactionStatus.PENDING
        )

        assert total == 1
        assert results[0].transaction_id == pending.transaction_id

    async def test_get_transaction_not_found_raises(
        self, transaction_service: TransactionService
    ) -> None:
        with pytest.raises(TransactionNotFoundException):
            await transaction_service.get_transaction(uuid4())


class TestTransactionsAPI:
    """Test Transactions API endpoints."""

    async def _make_member_via_api(self, client: AsyncClient, headers: dict[str, str]) -> str:
        resp = await client.post(
            "/api/v1/members",
            json={
                "first_name": "API",
                "last_name": "Member",
                "email": f"{uuid4()}@example.com",
            },
            headers=headers,
        )
        member_id: str = resp.json()["member_id"]
        return member_id

    async def test_create_transaction_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        member_id = await self._make_member_via_api(client, librarian_headers)
        response = await client.post(
            "/api/v1/transactions",
            json={
                "member_id": member_id,
                "transaction_type": "LATE_FEE",
                "amount": "5.00",
            },
            headers=librarian_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "PENDING"

    async def test_create_transaction_endpoint_no_token_401(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/transactions",
            json={
                "member_id": str(uuid4()),
                "transaction_type": "LATE_FEE",
                "amount": "5.00",
            },
        )
        assert response.status_code == 401

    async def test_create_transaction_endpoint_member_not_found_404(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        response = await client.post(
            "/api/v1/transactions",
            json={
                "member_id": str(uuid4()),
                "transaction_type": "LATE_FEE",
                "amount": "5.00",
            },
            headers=librarian_headers,
        )
        assert response.status_code == 404

    async def test_pay_transaction_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        member_id = await self._make_member_via_api(client, librarian_headers)
        create_resp = await client.post(
            "/api/v1/transactions",
            json={"member_id": member_id, "transaction_type": "DAMAGE_FEE", "amount": "10.00"},
            headers=librarian_headers,
        )
        transaction_id = create_resp.json()["transaction_id"]

        response = await client.post(
            f"/api/v1/transactions/{transaction_id}/pay",
            json={"payment_mode": "CARD", "payment_reference": "REF-1"},
            headers=librarian_headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "SUCCESS"

    async def test_pay_transaction_endpoint_already_settled_409(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        member_id = await self._make_member_via_api(client, librarian_headers)
        create_resp = await client.post(
            "/api/v1/transactions",
            json={"member_id": member_id, "transaction_type": "DAMAGE_FEE", "amount": "10.00"},
            headers=librarian_headers,
        )
        transaction_id = create_resp.json()["transaction_id"]
        await client.post(
            f"/api/v1/transactions/{transaction_id}/pay",
            json={"payment_mode": "CARD"},
            headers=librarian_headers,
        )

        response = await client.post(
            f"/api/v1/transactions/{transaction_id}/pay",
            json={"payment_mode": "CASH"},
            headers=librarian_headers,
        )
        assert response.status_code == 409

    async def test_fail_transaction_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        member_id = await self._make_member_via_api(client, librarian_headers)
        create_resp = await client.post(
            "/api/v1/transactions",
            json={"member_id": member_id, "transaction_type": "LATE_FEE", "amount": "2.00"},
            headers=librarian_headers,
        )
        transaction_id = create_resp.json()["transaction_id"]

        response = await client.post(
            f"/api/v1/transactions/{transaction_id}/fail", json={}, headers=librarian_headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "FAILED"

    async def test_waive_transaction_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        member_id = await self._make_member_via_api(client, librarian_headers)
        create_resp = await client.post(
            "/api/v1/transactions",
            json={"member_id": member_id, "transaction_type": "LATE_FEE", "amount": "2.00"},
            headers=librarian_headers,
        )
        transaction_id = create_resp.json()["transaction_id"]

        response = await client.post(
            f"/api/v1/transactions/{transaction_id}/waive", headers=librarian_headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "WAIVED"

    async def test_get_transaction_endpoint_not_found_404(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        response = await client.get(f"/api/v1/transactions/{uuid4()}", headers=librarian_headers)
        assert response.status_code == 404

    async def test_list_transactions_endpoint_by_member_filter(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        member_id = await self._make_member_via_api(client, librarian_headers)
        await client.post(
            "/api/v1/transactions",
            json={"member_id": member_id, "transaction_type": "LATE_FEE", "amount": "2.00"},
            headers=librarian_headers,
        )

        response = await client.get(
            f"/api/v1/transactions?member_id={member_id}", headers=librarian_headers
        )
        assert response.status_code == 200
        assert response.json()["total"] == 1
