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

    async def test_create_member_endpoint(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/members",
            json={
                "first_name": "Jane",
                "last_name": "Doe",
                "email": "jane.api@example.com",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "jane.api@example.com"
        assert data["membership_status"] == "ACTIVE"

    async def test_create_member_invalid_email(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/members",
            json={"first_name": "Jane", "last_name": "Doe", "email": "not-an-email"},
        )
        assert response.status_code == 422

    async def test_list_members_endpoint(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/members")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)

    async def test_get_member_endpoint(self, client: AsyncClient) -> None:
        create_response = await client.post(
            "/api/v1/members",
            json={"first_name": "Test", "last_name": "User", "email": "test.get@example.com"},
        )
        member_id = create_response.json()["member_id"]

        response = await client.get(f"/api/v1/members/{member_id}")
        assert response.status_code == 200
        assert response.json()["email"] == "test.get@example.com"

    async def test_get_member_not_found(self, client: AsyncClient) -> None:
        response = await client.get(f"/api/v1/members/{uuid4()}")
        assert response.status_code == 404

    async def test_update_member_endpoint(self, client: AsyncClient) -> None:
        create_response = await client.post(
            "/api/v1/members",
            json={"first_name": "Test", "last_name": "User", "email": "test.upd@example.com"},
        )
        member_id = create_response.json()["member_id"]

        response = await client.put(
            f"/api/v1/members/{member_id}", json={"membership_status": "BLOCKED"}
        )
        assert response.status_code == 200
        assert response.json()["membership_status"] == "BLOCKED"

    async def test_delete_member_endpoint(self, client: AsyncClient) -> None:
        create_response = await client.post(
            "/api/v1/members",
            json={"first_name": "Test", "last_name": "User", "email": "test.del@example.com"},
        )
        member_id = create_response.json()["member_id"]

        response = await client.delete(f"/api/v1/members/{member_id}")
        assert response.status_code == 204

        response = await client.get(f"/api/v1/members/{member_id}")
        assert response.status_code == 404

    async def test_search_members_endpoint(self, client: AsyncClient) -> None:
        await client.post(
            "/api/v1/members",
            json={
                "first_name": "Zelda",
                "last_name": "Search",
                "email": "zelda@example.com",
            },
        )
        response = await client.get("/api/v1/members/search?name=Zelda")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["first_name"] == "Zelda"
