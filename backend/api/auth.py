from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr

from api.deps import get_auth_service, get_current_staff
from api.staff import StaffResponse
from api.validators import LoginPassword
from models import Staff
from services.auth import AuthService

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class LoginRequest(BaseModel):
    """Request schema for staff login."""

    email: EmailStr
    password: LoginPassword


class TokenResponse(BaseModel):
    """Response schema for a successful login."""

    access_token: str
    token_type: str = "bearer"
    staff: StaffResponse


@router.post("/login", response_model=TokenResponse)
async def login(
    req: LoginRequest, service: AuthService = Depends(get_auth_service)
) -> TokenResponse:
    """Authenticate a staff member and issue a bearer token."""
    staff, token = await service.login(req.email, req.password)
    return TokenResponse(access_token=token, staff=StaffResponse.model_validate(staff))


@router.get("/me", response_model=StaffResponse)
async def read_current_staff(current_staff: Staff = Depends(get_current_staff)) -> StaffResponse:
    """Return the authenticated staff member's own record."""
    return StaffResponse.model_validate(current_staff)
