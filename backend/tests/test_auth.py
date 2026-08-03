from uuid import uuid4

import jwt
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_settings
from core.exceptions import AuthenticationException
from core.security import create_access_token
from models.enums import StaffRole, StaffStatus
from services.auth import AuthService
from services.staff import StaffService


@pytest.fixture
async def staff_service(db: AsyncSession) -> StaffService:
    return StaffService(db)


@pytest.fixture
async def auth_service(db: AsyncSession) -> AuthService:
    return AuthService(db)


class TestAuthService:
    """Test AuthService business logic."""

    async def test_login_success_issues_token_and_stamps_last_login(
        self, staff_service: StaffService, auth_service: AuthService
    ) -> None:
        await staff_service.create_staff(
            employee_code="AUTH-001",
            first_name="Alice",
            last_name="Admin",
            email="alice.auth@library.com",
            password="correctpassword",
        )

        staff, token = await auth_service.login("alice.auth@library.com", "correctpassword")

        assert staff.last_login_at is not None
        decoded = jwt.decode(token, options={"verify_signature": False})
        assert decoded["sub"] == str(staff.staff_id)
        assert decoded["role"] == staff.role.value

    async def test_login_wrong_password_raises(
        self, staff_service: StaffService, auth_service: AuthService
    ) -> None:
        await staff_service.create_staff(
            employee_code="AUTH-002",
            first_name="Bob",
            last_name="Staff",
            email="bob.auth@library.com",
            password="correctpassword",
        )
        with pytest.raises(AuthenticationException):
            await auth_service.login("bob.auth@library.com", "wrongpassword")

    async def test_login_unknown_email_raises(self, auth_service: AuthService) -> None:
        with pytest.raises(AuthenticationException):
            await auth_service.login("nobody@library.com", "whatever123")

    async def test_login_inactive_staff_raises(
        self, staff_service: StaffService, auth_service: AuthService
    ) -> None:
        staff = await staff_service.create_staff(
            employee_code="AUTH-003",
            first_name="Carol",
            last_name="Staff",
            email="carol.auth@library.com",
            password="correctpassword",
        )
        await staff_service.update_staff(staff.staff_id, status=StaffStatus.INACTIVE)

        with pytest.raises(AuthenticationException):
            await auth_service.login("carol.auth@library.com", "correctpassword")

    async def test_login_failure_message_is_identical_across_causes(
        self, staff_service: StaffService, auth_service: AuthService
    ) -> None:
        """Deliberate no-enumeration behaviour: wrong password, unknown email,
        and an inactive account must be indistinguishable to the caller, not
        just share a status code."""
        await staff_service.create_staff(
            employee_code="AUTH-004",
            first_name="Dana",
            last_name="Staff",
            email="dana.auth@library.com",
            password="correctpassword",
        )
        inactive = await staff_service.create_staff(
            employee_code="AUTH-005",
            first_name="Erin",
            last_name="Staff",
            email="erin.auth@library.com",
            password="correctpassword",
        )
        await staff_service.update_staff(inactive.staff_id, status=StaffStatus.INACTIVE)

        messages = set()
        for email, password in [
            ("dana.auth@library.com", "wrongpassword"),
            ("nobody-at-all@library.com", "whatever123"),
            ("erin.auth@library.com", "correctpassword"),
        ]:
            with pytest.raises(AuthenticationException) as exc_info:
                await auth_service.login(email, password)
            messages.add(str(exc_info.value))

        assert len(messages) == 1


class TestAuthAPI:
    """Test Auth API endpoints and the get_current_staff/require_role dependencies."""

    async def test_login_endpoint_success(self, client: AsyncClient, db: AsyncSession) -> None:
        staff_service = StaffService(db)
        await staff_service.create_staff(
            employee_code="AUTHAPI-002",
            first_name="Eve",
            last_name="Staff",
            email="eve.authapi@library.com",
            password="correctpassword",
        )

        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "eve.authapi@library.com", "password": "correctpassword"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["token_type"] == "bearer"
        assert data["staff"]["email"] == "eve.authapi@library.com"
        assert "access_token" in data

    async def test_login_endpoint_wrong_password_401(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        staff_service = StaffService(db)
        await staff_service.create_staff(
            employee_code="AUTHAPI-003",
            first_name="Frank",
            last_name="Staff",
            email="frank.authapi@library.com",
            password="correctpassword",
        )

        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "frank.authapi@library.com", "password": "wrongpassword"},
        )
        assert response.status_code == 401

    async def test_login_endpoint_password_too_long_422(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        """bcrypt refuses secrets over 72 bytes on verify as well as on hash;
        this must be a 422 at the boundary, not a crash."""
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@library.com", "password": "a" * 73},
        )
        assert response.status_code == 422

    async def test_me_endpoint_with_valid_token(
        self, client: AsyncClient, db: AsyncSession
    ) -> None:
        staff_service = StaffService(db)
        staff = await staff_service.create_staff(
            employee_code="AUTHAPI-004",
            first_name="Grace",
            last_name="Staff",
            email="grace.authapi@library.com",
            password="correctpassword",
        )
        token = create_access_token(staff.staff_id, staff.role)

        response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        assert response.json()["email"] == "grace.authapi@library.com"

    async def test_me_endpoint_no_token_401(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 401

    async def test_me_endpoint_invalid_token_401(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"}
        )
        assert response.status_code == 401

    async def test_me_endpoint_unknown_staff_id_401(self, client: AsyncClient) -> None:
        token = create_access_token(uuid4(), StaffRole.LIBRARIAN)
        response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401

    async def test_me_endpoint_malformed_sub_claim_401(self, client: AsyncClient) -> None:
        """A validly-signed token whose `sub` isn't a UUID used to raise
        ValueError and 500 instead of failing authentication."""
        settings = get_settings()
        token = jwt.encode(
            {"sub": "not-a-uuid", "role": "LIBRARIAN"},
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm,
        )
        response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401

    async def test_me_endpoint_missing_sub_claim_401(self, client: AsyncClient) -> None:
        """A token with no `sub` claim at all used to raise KeyError and 500."""
        settings = get_settings()
        token = jwt.encode(
            {"role": "LIBRARIAN"}, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
        )
        response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401
