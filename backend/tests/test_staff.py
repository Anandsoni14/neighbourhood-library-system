from uuid import uuid4

import pytest
from httpx import AsyncClient

from core.exceptions import ConflictError, NotFoundError
from core.security import create_access_token, verify_password
from models.enums import StaffRole, StaffStatus
from services.staff import StaffService

# staff_service, admin_headers, and librarian_headers fixtures live in conftest.py.


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
        acting_admin = await staff_service.create_staff(
            employee_code="EMP-399",
            first_name="Acting",
            last_name="Admin",
            email="acting-admin@library.com",
            password="password123",
            role=StaffRole.ADMIN,
        )
        staff = await staff_service.create_staff(
            employee_code="EMP-400",
            first_name="Dan",
            last_name="Staff",
            email="dan@library.com",
            password="password123",
        )
        deactivated = await staff_service.deactivate_staff(
            staff.staff_id, acting_staff_id=acting_admin.staff_id
        )
        assert deactivated.status == StaffStatus.INACTIVE

    async def test_deactivate_staff_is_idempotent(self, staff_service: StaffService) -> None:
        acting_admin = await staff_service.create_staff(
            employee_code="EMP-401",
            first_name="Acting",
            last_name="Admin",
            email="acting-admin2@library.com",
            password="password123",
            role=StaffRole.ADMIN,
        )
        staff = await staff_service.create_staff(
            employee_code="EMP-402",
            first_name="Gail",
            last_name="Staff",
            email="gail@library.com",
            password="password123",
        )
        await staff_service.deactivate_staff(staff.staff_id, acting_staff_id=acting_admin.staff_id)
        deactivated_again = await staff_service.deactivate_staff(
            staff.staff_id, acting_staff_id=acting_admin.staff_id
        )
        assert deactivated_again.status == StaffStatus.INACTIVE

    async def test_deactivate_staff_refuses_self_deactivation(
        self, staff_service: StaffService
    ) -> None:
        admin = await staff_service.create_staff(
            employee_code="EMP-403",
            first_name="Solo",
            last_name="Admin",
            email="solo-admin@library.com",
            password="password123",
            role=StaffRole.ADMIN,
        )
        with pytest.raises(ConflictError):
            await staff_service.deactivate_staff(admin.staff_id, acting_staff_id=admin.staff_id)

    async def test_deactivate_staff_refuses_last_active_admin(
        self, staff_service: StaffService
    ) -> None:
        only_admin = await staff_service.create_staff(
            employee_code="EMP-404",
            first_name="Only",
            last_name="Admin",
            email="only-admin@library.com",
            password="password123",
            role=StaffRole.ADMIN,
        )
        other_staff = await staff_service.create_staff(
            employee_code="EMP-405",
            first_name="Other",
            last_name="Staff",
            email="other-staff@library.com",
            password="password123",
        )
        with pytest.raises(ConflictError):
            await staff_service.deactivate_staff(
                only_admin.staff_id, acting_staff_id=other_staff.staff_id
            )

    async def test_deactivate_staff_allows_when_another_admin_remains(
        self, staff_service: StaffService
    ) -> None:
        first_admin = await staff_service.create_staff(
            employee_code="EMP-406",
            first_name="First",
            last_name="Admin",
            email="first-admin@library.com",
            password="password123",
            role=StaffRole.ADMIN,
        )
        second_admin = await staff_service.create_staff(
            employee_code="EMP-407",
            first_name="Second",
            last_name="Admin",
            email="second-admin@library.com",
            password="password123",
            role=StaffRole.ADMIN,
        )
        deactivated = await staff_service.deactivate_staff(
            first_admin.staff_id, acting_staff_id=second_admin.staff_id
        )
        assert deactivated.status == StaffStatus.INACTIVE

    async def test_activate_staff(self, staff_service: StaffService) -> None:
        acting_admin = await staff_service.create_staff(
            employee_code="EMP-408",
            first_name="Acting",
            last_name="Admin",
            email="acting-admin3@library.com",
            password="password123",
            role=StaffRole.ADMIN,
        )
        staff = await staff_service.create_staff(
            employee_code="EMP-409",
            first_name="Hana",
            last_name="Staff",
            email="hana@library.com",
            password="password123",
        )
        await staff_service.deactivate_staff(staff.staff_id, acting_staff_id=acting_admin.staff_id)
        reactivated = await staff_service.activate_staff(staff.staff_id)
        assert reactivated.status == StaffStatus.ACTIVE

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
        data = response.json()
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)

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

    async def test_deactivate_staff_endpoint(
        self, client: AsyncClient, admin_headers: dict[str, str]
    ) -> None:
        create_response = await client.post(
            "/api/v1/staff",
            json={
                "employee_code": "API-007",
                "first_name": "Grace",
                "last_name": "Staff",
                "email": "grace.api@library.com",
                "password": "supersecret123",
            },
            headers=admin_headers,
        )
        staff_id = create_response.json()["staff_id"]

        response = await client.post(f"/api/v1/staff/{staff_id}/deactivate", headers=admin_headers)
        assert response.status_code == 200
        assert response.json()["status"] == "INACTIVE"

    async def test_activate_staff_endpoint(
        self, client: AsyncClient, admin_headers: dict[str, str]
    ) -> None:
        create_response = await client.post(
            "/api/v1/staff",
            json={
                "employee_code": "API-008",
                "first_name": "Henry",
                "last_name": "Staff",
                "email": "henry.api@library.com",
                "password": "supersecret123",
            },
            headers=admin_headers,
        )
        staff_id = create_response.json()["staff_id"]
        await client.post(f"/api/v1/staff/{staff_id}/deactivate", headers=admin_headers)

        response = await client.post(f"/api/v1/staff/{staff_id}/activate", headers=admin_headers)
        assert response.status_code == 200
        assert response.json()["status"] == "ACTIVE"

    async def test_deactivate_staff_endpoint_librarian_forbidden_403(
        self, client: AsyncClient, admin_headers: dict[str, str], librarian_headers: dict[str, str]
    ) -> None:
        create_response = await client.post(
            "/api/v1/staff",
            json={
                "employee_code": "API-009",
                "first_name": "Iris",
                "last_name": "Staff",
                "email": "iris.api@library.com",
                "password": "supersecret123",
            },
            headers=admin_headers,
        )
        staff_id = create_response.json()["staff_id"]

        response = await client.post(
            f"/api/v1/staff/{staff_id}/deactivate", headers=librarian_headers
        )
        assert response.status_code == 403

    async def test_deactivate_staff_endpoint_refuses_self_deactivation(
        self, client: AsyncClient, staff_service: StaffService
    ) -> None:
        admin = await staff_service.create_staff(
            employee_code="API-010",
            first_name="Self",
            last_name="Admin",
            email="self-admin@library.com",
            password="supersecret123",
            role=StaffRole.ADMIN,
        )
        headers = {"Authorization": f"Bearer {create_access_token(admin.staff_id, admin.role)}"}

        response = await client.post(f"/api/v1/staff/{admin.staff_id}/deactivate", headers=headers)
        assert response.status_code == 409

    async def test_deactivate_staff_endpoint_allows_when_another_admin_remains(
        self, client: AsyncClient, staff_service: StaffService, admin_headers: dict[str, str]
    ) -> None:
        # `admin_headers` created one ADMIN (the caller); deactivating a
        # second ADMIN here still leaves that first one active, so it's
        # allowed. (The "last admin" refusal itself is only reachable at the
        # service layer — see test_deactivate_staff_refuses_last_active_admin
        # — because the HTTP endpoint requires the caller to be a *second*
        # ACTIVE ADMIN, and self-deactivation is refused separately, so by
        # the time a request can even reach this handler there are always at
        # least two active admins in play.)
        second_admin = await staff_service.create_staff(
            employee_code="API-011",
            first_name="Second",
            last_name="Admin",
            email="second-admin-api@library.com",
            password="supersecret123",
            role=StaffRole.ADMIN,
        )

        response = await client.post(
            f"/api/v1/staff/{second_admin.staff_id}/deactivate", headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "INACTIVE"
