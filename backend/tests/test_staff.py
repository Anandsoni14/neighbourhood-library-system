from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ConflictError, NotFoundError
from core.security import create_access_token, verify_password
from models.enums import StaffRole, StaffStatus
from services.staff import StaffService


@pytest.fixture
async def staff_service(db: AsyncSession) -> StaffService:
    return StaffService(db)


@pytest.fixture
async def admin_headers(staff_service: StaffService) -> dict[str, str]:
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


@pytest.fixture
async def librarian_headers(staff_service: StaffService) -> dict[str, str]:
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


class TestStaffService:
    """Test StaffService business logic."""

    async def test_create_staff_hashes_password(self, staff_service: StaffService) -> None:
        staff = await staff_service.create_staff(
            employee_code="EMP-001",
            first_name="Alice",
            last_name="Librarian",
            email="alice@library.com",
            password="supersecret123",
        )
        assert staff.password_hash != "supersecret123"
        assert verify_password("supersecret123", staff.password_hash)
        assert staff.role == StaffRole.LIBRARIAN
        assert staff.status == StaffStatus.ACTIVE

    async def test_create_staff_duplicate_employee_code_raises_conflict(
        self, staff_service: StaffService
    ) -> None:
        await staff_service.create_staff(
            employee_code="EMP-DUP",
            first_name="A",
            last_name="B",
            email="a@library.com",
            password="password123",
        )
        with pytest.raises(ConflictError):
            await staff_service.create_staff(
                employee_code="EMP-DUP",
                first_name="C",
                last_name="D",
                email="c@library.com",
                password="password123",
            )

    async def test_create_staff_duplicate_email_raises_conflict(
        self, staff_service: StaffService
    ) -> None:
        await staff_service.create_staff(
            employee_code="EMP-100",
            first_name="A",
            last_name="B",
            email="dup@library.com",
            password="password123",
        )
        with pytest.raises(ConflictError):
            await staff_service.create_staff(
                employee_code="EMP-101",
                first_name="C",
                last_name="D",
                email="dup@library.com",
                password="password123",
            )

    async def test_get_staff_not_found_raises(self, staff_service: StaffService) -> None:
        with pytest.raises(NotFoundError):
            await staff_service.get_staff(uuid4())

    async def test_update_staff(self, staff_service: StaffService) -> None:
        staff = await staff_service.create_staff(
            employee_code="EMP-200",
            first_name="Bob",
            last_name="Admin",
            email="bob@library.com",
            password="password123",
        )
        updated = await staff_service.update_staff(staff.staff_id, role=StaffRole.ADMIN)
        assert updated.role == StaffRole.ADMIN

    async def test_update_staff_rejects_password_hash_field(
        self, staff_service: StaffService
    ) -> None:
        staff = await staff_service.create_staff(
            employee_code="EMP-201",
            first_name="Bob",
            last_name="Admin",
            email="bob2@library.com",
            password="password123",
        )
        with pytest.raises(ConflictError):
            await staff_service.update_staff(staff.staff_id, password_hash="hacked")

    async def test_change_password(self, staff_service: StaffService) -> None:
        staff = await staff_service.create_staff(
            employee_code="EMP-300",
            first_name="Carol",
            last_name="Staff",
            email="carol@library.com",
            password="oldpassword1",
        )
        updated = await staff_service.change_password(staff.staff_id, "newpassword2")
        assert verify_password("newpassword2", updated.password_hash)
        assert not verify_password("oldpassword1", updated.password_hash)

    async def test_deactivate_staff(self, staff_service: StaffService) -> None:
        staff = await staff_service.create_staff(
            employee_code="EMP-400",
            first_name="Dan",
            last_name="Staff",
            email="dan@library.com",
            password="password123",
        )
        deactivated = await staff_service.deactivate_staff(staff.staff_id)
        assert deactivated.status == StaffStatus.INACTIVE

    async def test_delete_staff(self, staff_service: StaffService) -> None:
        staff = await staff_service.create_staff(
            employee_code="EMP-500",
            first_name="Eve",
            last_name="Staff",
            email="eve@library.com",
            password="password123",
        )
        await staff_service.delete_staff(staff.staff_id)
        with pytest.raises(NotFoundError):
            await staff_service.get_staff(staff.staff_id)


class TestStaffAPI:
    """Test Staff API endpoints."""

    async def test_create_staff_endpoint(
        self, client: AsyncClient, admin_headers: dict[str, str]
    ) -> None:
        response = await client.post(
            "/api/v1/staff",
            json={
                "employee_code": "API-001",
                "first_name": "Alice",
                "last_name": "Librarian",
                "email": "alice.api@library.com",
                "password": "supersecret123",
            },
            headers=admin_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["employee_code"] == "API-001"
        assert "password" not in data
        assert "password_hash" not in data

    async def test_create_staff_endpoint_no_token_401(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/staff",
            json={
                "employee_code": "API-001B",
                "first_name": "Alice",
                "last_name": "Librarian",
                "email": "alice.b@library.com",
                "password": "supersecret123",
            },
        )
        assert response.status_code == 401

    async def test_create_staff_endpoint_librarian_forbidden_403(
        self, client: AsyncClient, librarian_headers: dict[str, str]
    ) -> None:
        response = await client.post(
            "/api/v1/staff",
            json={
                "employee_code": "API-001C",
                "first_name": "Alice",
                "last_name": "Librarian",
                "email": "alice.c@library.com",
                "password": "supersecret123",
            },
            headers=librarian_headers,
        )
        assert response.status_code == 403

    async def test_create_staff_short_password_rejected(
        self, client: AsyncClient, admin_headers: dict[str, str]
    ) -> None:
        response = await client.post(
            "/api/v1/staff",
            json={
                "employee_code": "API-002",
                "first_name": "Bob",
                "last_name": "Staff",
                "email": "bob.api@library.com",
                "password": "short",
            },
            headers=admin_headers,
        )
        assert response.status_code == 422

    async def test_list_staff_endpoint(
        self, client: AsyncClient, admin_headers: dict[str, str]
    ) -> None:
        response = await client.get("/api/v1/staff", headers=admin_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_get_staff_endpoint(
        self, client: AsyncClient, admin_headers: dict[str, str]
    ) -> None:
        create_response = await client.post(
            "/api/v1/staff",
            json={
                "employee_code": "API-003",
                "first_name": "Carol",
                "last_name": "Staff",
                "email": "carol.api@library.com",
                "password": "supersecret123",
            },
            headers=admin_headers,
        )
        staff_id = create_response.json()["staff_id"]

        response = await client.get(f"/api/v1/staff/{staff_id}", headers=admin_headers)
        assert response.status_code == 200
        assert response.json()["email"] == "carol.api@library.com"

    async def test_get_staff_not_found(
        self, client: AsyncClient, admin_headers: dict[str, str]
    ) -> None:
        response = await client.get(f"/api/v1/staff/{uuid4()}", headers=admin_headers)
        assert response.status_code == 404

    async def test_update_staff_endpoint(
        self, client: AsyncClient, admin_headers: dict[str, str]
    ) -> None:
        create_response = await client.post(
            "/api/v1/staff",
            json={
                "employee_code": "API-004",
                "first_name": "Dan",
                "last_name": "Staff",
                "email": "dan.api@library.com",
                "password": "supersecret123",
            },
            headers=admin_headers,
        )
        staff_id = create_response.json()["staff_id"]

        response = await client.put(
            f"/api/v1/staff/{staff_id}", json={"role": "ADMIN"}, headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["role"] == "ADMIN"

    async def test_change_password_endpoint(
        self, client: AsyncClient, admin_headers: dict[str, str]
    ) -> None:
        create_response = await client.post(
            "/api/v1/staff",
            json={
                "employee_code": "API-005",
                "first_name": "Eve",
                "last_name": "Staff",
                "email": "eve.api@library.com",
                "password": "supersecret123",
            },
            headers=admin_headers,
        )
        staff_id = create_response.json()["staff_id"]

        response = await client.post(
            f"/api/v1/staff/{staff_id}/change-password",
            json={"new_password": "newpassword456"},
            headers=admin_headers,
        )
        assert response.status_code == 200

    async def test_change_password_endpoint_other_staff_forbidden_403(
        self,
        client: AsyncClient,
        admin_headers: dict[str, str],
        librarian_headers: dict[str, str],
    ) -> None:
        create_response = await client.post(
            "/api/v1/staff",
            json={
                "employee_code": "API-005B",
                "first_name": "Eve",
                "last_name": "Staff",
                "email": "eve.b@library.com",
                "password": "supersecret123",
            },
            headers=admin_headers,
        )
        staff_id = create_response.json()["staff_id"]

        response = await client.post(
            f"/api/v1/staff/{staff_id}/change-password",
            json={"new_password": "newpassword456"},
            headers=librarian_headers,
        )
        assert response.status_code == 403

    async def test_delete_staff_endpoint(
        self, client: AsyncClient, admin_headers: dict[str, str]
    ) -> None:
        create_response = await client.post(
            "/api/v1/staff",
            json={
                "employee_code": "API-006",
                "first_name": "Frank",
                "last_name": "Staff",
                "email": "frank.api@library.com",
                "password": "supersecret123",
            },
            headers=admin_headers,
        )
        staff_id = create_response.json()["staff_id"]

        response = await client.delete(f"/api/v1/staff/{staff_id}", headers=admin_headers)
        assert response.status_code == 204

        response = await client.get(f"/api/v1/staff/{staff_id}", headers=admin_headers)
        assert response.status_code == 404
