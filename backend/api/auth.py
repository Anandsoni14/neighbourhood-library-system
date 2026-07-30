from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_staff
from api.staff import StaffResponse
from db.session import get_db
from models import Staff
from services.auth import AuthService

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class LoginRequest(BaseModel):
    """Request schema for staff login."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Response schema for a successful login."""

    access_token: str
    token_type: str = "bearer"
    staff: StaffResponse


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Authenticate a staff member and issue a bearer token."""
    service = AuthService(db)
    staff, token = await service.login(req.email, req.password)
    return TokenResponse(access_token=token, staff=StaffResponse.model_validate(staff))


@router.get("/me", response_model=StaffResponse)
async def read_current_staff(current_staff: Staff = Depends(get_current_staff)) -> StaffResponse:
    """Return the authenticated staff member's own record."""
    return StaffResponse.model_validate(current_staff)
