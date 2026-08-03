from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ConflictError, NotFoundError
from models.enums import MembershipStatus
from services.member import MemberService


@pytest.fixture
async def member_service(db: AsyncSession) -> MemberService:
    return MemberService(db)


class TestMemberService:
    """Test MemberService business logic."""

    async def test_create_member(self, member_service: MemberService) -> None:
        member = await member_service.create_member(
            first_name="Jane", last_name="Doe", email="jane.doe@example.com"
        )
        assert member.email == "jane.doe@example.com"
        assert member.membership_status == MembershipStatus.ACTIVE

    async def test_create_member_duplicate_email_raises_conflict(
        self, member_service: MemberService
    ) -> None:
        await member_service.create_member(
            first_name="Jane", last_name="Doe", email="dup@example.com"
        )
        with pytest.raises(ConflictError):
            await member_service.create_member(
                first_name="John", last_name="Doe", email="dup@example.com"
            )

    async def test_create_member_duplicate_government_id_raises_conflict(
        self, member_service: MemberService
    ) -> None:
        await member_service.create_member(
            first_name="Jane",
            last_name="Doe",
            email="jane@example.com",
            government_id_type="PASSPORT",
            government_id_number="X123456",
        )
        with pytest.raises(ConflictError):
            await member_service.create_member(
                first_name="John",
                last_name="Smith",
                email="john@example.com",
                government_id_type="PASSPORT",
                government_id_number="X123456",
            )

    async def test_get_member_not_found_raises(self, member_service: MemberService) -> None:
        with pytest.raises(NotFoundError):
            await member_service.get_member(uuid4())

    async def test_list_members(self, member_service: MemberService) -> None:
        await member_service.create_member(first_name="A", last_name="B", email="a@example.com")
        await member_service.create_member(first_name="C", last_name="D", email="c@example.com")
        members, total = await member_service.list_members()
        assert len(members) >= 2
        assert total >= 2

    async def test_list_members_by_status(self, member_service: MemberService) -> None:
        member = await member_service.create_member(
            first_name="A", last_name="B", email="status@example.com"
        )
        await member_service.update_member(member.member_id, membership_status="BLOCKED")
        blocked, total = await member_service.list_members(status=MembershipStatus.BLOCKED)
        assert total == 1
        assert blocked[0].member_id == member.member_id

    async def test_list_members_combines_status_and_name(
        self, member_service: MemberService
    ) -> None:
        """Status and name narrow together rather than one overriding the other."""
        blocked = await member_service.create_member(
            first_name="Zoe", last_name="Blocked", email="zoe.blocked@example.com"
        )
        await member_service.update_member(blocked.member_id, membership_status="BLOCKED")
        await member_service.create_member(
            first_name="Zoe", last_name="Active", email="zoe.active@example.com"
        )

        results, total = await member_service.list_members(
            status=MembershipStatus.BLOCKED, name="Zoe"
        )

        assert total == 1
        assert results[0].member_id == blocked.member_id

    async def test_list_members_by_phone_number(self, member_service: MemberService) -> None:
        member = await member_service.create_member(
            first_name="Phone",
            last_name="Filter",
            email="phone.filter@example.com",
            phone_number="+15551234567",
        )
        await member_service.create_member(
            first_name="Other", last_name="Member", email="other.member@example.com"
        )

        results, total = await member_service.list_members(phone_number="5551234")

        assert total == 1
        assert results[0].member_id == member.member_id

    async def test_filtered_list_still_paginates(self, member_service: MemberService) -> None:
        """A filtered query honours limit/offset and reports the filtered total."""
        for index in range(4):
            await member_service.create_member(
                first_name="Paged", last_name=f"Member{index}", email=f"paged{index}@example.com"
            )

        page, total = await member_service.list_members(name="Paged", limit=3, offset=0)

        assert total == 4
        assert len(page) == 3

    async def test_update_member(self, member_service: MemberService) -> None:
        member = await member_service.create_member(
            first_name="Jane", last_name="Doe", email="update@example.com"
        )
        updated = await member_service.update_member(member.member_id, city="Springfield")
        assert updated.city == "Springfield"

    async def test_update_member_email_conflict(self, member_service: MemberService) -> None:
        await member_service.create_member(first_name="A", last_name="B", email="taken@example.com")
        member2 = await member_service.create_member(
            first_name="C", last_name="D", email="free@example.com"
        )
        with pytest.raises(ConflictError):
            await member_service.update_member(member2.member_id, email="taken@example.com")

    async def test_search_members_by_name(self, member_service: MemberService) -> None:
        await member_service.create_member(
            first_name="Alice", last_name="Wonderland", email="alice@example.com"
        )
        await member_service.create_member(
            first_name="Bob", last_name="Builder", email="bob@example.com"
        )
        results, total = await member_service.list_members(name="Alice")
        assert total == 1
        assert results[0].first_name == "Alice"


class TestMembersAPI:
    """Test Members API endpoints."""

    async def test_create_member_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        response = await client.post(
            "/api/v1/members",
            json={
                "first_name": "Jane",
                "last_name": "Doe",
                "email": "jane.api@example.com",
            },
            headers=librarian_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "jane.api@example.com"
        assert data["membership_status"] == "ACTIVE"

    async def test_create_member_endpoint_no_token_401(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/members",
            json={"first_name": "Jane", "last_name": "Doe", "email": "no-token@example.com"},
        )
        assert response.status_code == 401

    async def test_create_member_invalid_email(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        response = await client.post(
            "/api/v1/members",
            json={"first_name": "Jane", "last_name": "Doe", "email": "not-an-email"},
            headers=librarian_headers,
        )
        assert response.status_code == 422

    async def test_create_member_blank_first_name_422(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        for first_name in ["", "   "]:
            response = await client.post(
                "/api/v1/members",
                json={
                    "first_name": first_name,
                    "last_name": "Doe",
                    "email": f"blank-name-{first_name!r}@example.com",
                },
                headers=librarian_headers,
            )
            assert response.status_code == 422

    async def test_create_member_first_name_too_long_422(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        response = await client.post(
            "/api/v1/members",
            json={
                "first_name": "x" * 81,
                "last_name": "Doe",
                "email": "too-long-name@example.com",
            },
            headers=librarian_headers,
        )
        assert response.status_code == 422

    @pytest.mark.parametrize("phone_number", ["123", "12345678901", "98a6543210", "12345 6789"])
    async def test_create_member_rejects_invalid_phone_number(
        self, client: AsyncClient, librarian_headers: dict[str, str], phone_number: str
    ) -> None:
        response = await client.post(
            "/api/v1/members",
            json={
                "first_name": "Jane",
                "last_name": "Doe",
                "email": "phone-invalid@example.com",
                "phone_number": phone_number,
            },
            headers=librarian_headers,
        )
        assert response.status_code == 422

    async def test_create_member_accepts_valid_phone_number(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        response = await client.post(
            "/api/v1/members",
            json={
                "first_name": "Jane",
                "last_name": "Doe",
                "email": "phone-valid@example.com",
                "phone_number": "9876543210",
            },
            headers=librarian_headers,
        )
        assert response.status_code == 201
        assert response.json()["phone_number"] == "9876543210"

    @pytest.mark.parametrize("postal_code", ["12A45", "SW1A 1AA", "abcde"])
    async def test_create_member_rejects_invalid_postal_code(
        self, client: AsyncClient, librarian_headers: dict[str, str], postal_code: str
    ) -> None:
        response = await client.post(
            "/api/v1/members",
            json={
                "first_name": "Jane",
                "last_name": "Doe",
                "email": "postal-invalid@example.com",
                "postal_code": postal_code,
            },
            headers=librarian_headers,
        )
        assert response.status_code == 422

    async def test_create_member_accepts_valid_postal_code(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        response = await client.post(
            "/api/v1/members",
            json={
                "first_name": "Jane",
                "last_name": "Doe",
                "email": "postal-valid@example.com",
                "postal_code": "560001",
            },
            headers=librarian_headers,
        )
        assert response.status_code == 201
        assert response.json()["postal_code"] == "560001"

    async def test_list_members_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        response = await client.get("/api/v1/members", headers=librarian_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)

    async def test_list_members_endpoint_filters_by_phone_number(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        await client.post(
            "/api/v1/members",
            json={
                "first_name": "Phone",
                "last_name": "Endpoint",
                "email": "phone.endpoint@example.com",
                "phone_number": "9876543210",
            },
            headers=librarian_headers,
        )
        await client.post(
            "/api/v1/members",
            json={
                "first_name": "Other",
                "last_name": "Endpoint",
                "email": "other.endpoint@example.com",
            },
            headers=librarian_headers,
        )

        response = await client.get(
            "/api/v1/members", params={"phone_number": "987654"}, headers=librarian_headers
        )

        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["email"] == "phone.endpoint@example.com"

    async def test_get_member_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        create_response = await client.post(
            "/api/v1/members",
            json={"first_name": "Test", "last_name": "User", "email": "test.get@example.com"},
            headers=librarian_headers,
        )
        member_id = create_response.json()["member_id"]

        response = await client.get(f"/api/v1/members/{member_id}", headers=librarian_headers)
        assert response.status_code == 200
        assert response.json()["email"] == "test.get@example.com"

    async def test_get_member_not_found(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        response = await client.get(f"/api/v1/members/{uuid4()}", headers=librarian_headers)
        assert response.status_code == 404

    async def test_update_member_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        create_response = await client.post(
            "/api/v1/members",
            json={"first_name": "Test", "last_name": "User", "email": "test.upd@example.com"},
            headers=librarian_headers,
        )
        member_id = create_response.json()["member_id"]

        response = await client.put(
            f"/api/v1/members/{member_id}",
            json={"membership_status": "BLOCKED"},
            headers=librarian_headers,
        )
        assert response.status_code == 200
        assert response.json()["membership_status"] == "BLOCKED"

    async def test_suspend_member_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        create_response = await client.post(
            "/api/v1/members",
            json={"first_name": "Test", "last_name": "User", "email": "test.suspend@example.com"},
            headers=librarian_headers,
        )
        member_id = create_response.json()["member_id"]

        response = await client.post(
            f"/api/v1/members/{member_id}/suspend", headers=librarian_headers
        )
        assert response.status_code == 200
        assert response.json()["membership_status"] == "BLOCKED"

    async def test_reactivate_member_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        create_response = await client.post(
            "/api/v1/members",
            json={
                "first_name": "Test",
                "last_name": "User",
                "email": "test.reactivate@example.com",
            },
            headers=librarian_headers,
        )
        member_id = create_response.json()["member_id"]
        await client.post(f"/api/v1/members/{member_id}/suspend", headers=librarian_headers)

        response = await client.post(
            f"/api/v1/members/{member_id}/reactivate", headers=librarian_headers
        )
        assert response.status_code == 200
        assert response.json()["membership_status"] == "ACTIVE"

    async def test_suspended_member_cannot_borrow(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        """API-level pin of the pre-existing service rule (services/loan.py) that
        a non-ACTIVE member cannot be issued a loan."""
        member_response = await client.post(
            "/api/v1/members",
            json={
                "first_name": "Blocked",
                "last_name": "Borrower",
                "email": "blocked.borrower@example.com",
            },
            headers=librarian_headers,
        )
        member_id = member_response.json()["member_id"]
        await client.post(f"/api/v1/members/{member_id}/suspend", headers=librarian_headers)

        book_response = await client.post(
            "/api/v1/books",
            json={"title": "Borrow Test Book", "author": "Author"},
            headers=librarian_headers,
        )
        book_id = book_response.json()["book_id"]
        copy_response = await client.post(
            "/api/v1/book-copies",
            json={"book_id": book_id, "barcode": "SUSPEND-TEST-001"},
            headers=librarian_headers,
        )
        copy_id = copy_response.json()["copy_id"]

        response = await client.post(
            "/api/v1/loans",
            json={"copy_id": copy_id, "member_id": member_id},
            headers=librarian_headers,
        )
        assert response.status_code == 409

    async def test_delete_member_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        create_response = await client.post(
            "/api/v1/members",
            json={"first_name": "Test", "last_name": "User", "email": "test.del@example.com"},
            headers=librarian_headers,
        )
        member_id = create_response.json()["member_id"]

        response = await client.delete(f"/api/v1/members/{member_id}", headers=librarian_headers)
        assert response.status_code == 204

        response = await client.get(f"/api/v1/members/{member_id}", headers=librarian_headers)
        assert response.status_code == 404

    async def test_search_members_endpoint(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        await client.post(
            "/api/v1/members",
            json={
                "first_name": "Zelda",
                "last_name": "Search",
                "email": "zelda@example.com",
            },
            headers=librarian_headers,
        )
        response = await client.get("/api/v1/members/search?name=Zelda", headers=librarian_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["first_name"] == "Zelda"
