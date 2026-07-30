from enum import StrEnum
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_staff, require_role
from api.pagination import Page, PaginationParams
from core.exceptions import AuthorizationException
from core.pagination import SortDir
from db.session import get_db
from models import Staff
from models.enums import StaffRole, StaffStatus
from services.staff import StaffService

router = APIRouter(prefix="/api/v1/staff", tags=["staff"])


class StaffSortField(StrEnum):
    """Columns a staff listing may be sorted by."""

    EMPLOYEE_CODE = "employee_code"
    FIRST_NAME = "first_name"
    LAST_NAME = "last_name"
    EMAIL = "email"
    ROLE = "role"
    STATUS = "status"


_SORT_COLUMNS = {
    StaffSortField.EMPLOYEE_CODE: Staff.employee_code,
    StaffSortField.FIRST_NAME: Staff.first_name,
    StaffSortField.LAST_NAME: Staff.last_name,
    StaffSortField.EMAIL: Staff.email,
    StaffSortField.ROLE: Staff.role,
    StaffSortField.STATUS: Staff.status,
}


class StaffCreateRequest(BaseModel):
    """Request schema for creating a staff member."""

    employee_code: str
    first_name: str
    last_name: str
    email: EmailStr
    password: str = Field(min_length=8)
    phone_number: str | None = None
    role: StaffRole | None = None


class StaffUpdateRequest(BaseModel):
    """Request schema for updating a staff member (excludes password)."""

    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    phone_number: str | None = None
    role: StaffRole | None = None
    status: StaffStatus | None = None


class ChangePasswordRequest(BaseModel):
    """Request schema for changing a staff member's password."""

    new_password: str = Field(min_length=8)


class StaffResponse(BaseModel):
    """Response schema for a staff member. Never includes password_hash."""

    model_config = ConfigDict(from_attributes=True)

    staff_id: UUID
    employee_code: str
    first_name: str
    last_name: str
    email: str
    phone_number: str | None
    role: StaffRole
    status: StaffStatus


@router.post("", response_model=StaffResponse, status_code=201)
async def create_staff(
    req: StaffCreateRequest,
    db: AsyncSession = Depends(get_db),
    _current_staff: Staff = Depends(require_role(StaffRole.ADMIN)),
) -> StaffResponse:
    """Create a new staff member. ADMIN only."""
    service = StaffService(db)
    staff = await service.create_staff(
        employee_code=req.employee_code,
        first_name=req.first_name,
        last_name=req.last_name,
        email=req.email,
        password=req.password,
        phone_number=req.phone_number,
        role=req.role,
    )
    return StaffResponse.model_validate(staff)


@router.get("", response_model=Page[StaffResponse])
async def list_staff(
    pagination: PaginationParams = Depends(),
    role: StaffRole | None = Query(None),
    status: StaffStatus | None = Query(None),
    name: str | None = Query(None, description="Matches first or last name."),
    sort_by: StaffSortField = Query(StaffSortField.EMPLOYEE_CODE),
    sort_dir: SortDir = Query(SortDir.ASC),
    db: AsyncSession = Depends(get_db),
    _current_staff: Staff = Depends(get_current_staff),
) -> Page[StaffResponse]:
    """List staff. Every supplied filter is applied together."""
    service = StaffService(db)
    staff, total = await service.list_staff(
        role=role,
        status=status,
        name=name,
        sort_by=_SORT_COLUMNS[sort_by],
        sort_dir=sort_dir,
        limit=pagination.limit,
        offset=pagination.skip,
    )
    return Page.create([StaffResponse.model_validate(s) for s in staff], total, pagination)


@router.get("/{staff_id}", response_model=StaffResponse)
async def get_staff(
    staff_id: UUID,
    db: AsyncSession = Depends(get_db),
    _current_staff: Staff = Depends(get_current_staff),
) -> StaffResponse:
    """Fetch a staff member by ID."""
    service = StaffService(db)
    staff = await service.get_staff(staff_id)
    return StaffResponse.model_validate(staff)


@router.put("/{staff_id}", response_model=StaffResponse)
async def update_staff(
    staff_id: UUID,
    req: StaffUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _current_staff: Staff = Depends(require_role(StaffRole.ADMIN)),
) -> StaffResponse:
    """Update a staff member (password changes use the dedicated endpoint). ADMIN only."""
    service = StaffService(db)
    staff = await service.update_staff(staff_id, **req.model_dump(exclude_unset=True))
    return StaffResponse.model_validate(staff)


@router.post("/{staff_id}/change-password", response_model=StaffResponse)
async def change_password(
    staff_id: UUID,
    req: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_staff: Staff = Depends(get_current_staff),
) -> StaffResponse:
    """Change a staff member's password. Staff may change their own; ADMIN may change anyone's."""
    if current_staff.staff_id != staff_id and current_staff.role != StaffRole.ADMIN:
        raise AuthorizationException("You may only change your own password")
    service = StaffService(db)
    staff = await service.change_password(staff_id, req.new_password)
    return StaffResponse.model_validate(staff)


@router.delete("/{staff_id}", status_code=204)
async def delete_staff(
    staff_id: UUID,
    db: AsyncSession = Depends(get_db),
    _current_staff: Staff = Depends(require_role(StaffRole.ADMIN)),
) -> None:
    """Delete a staff member. ADMIN only."""
    service = StaffService(db)
    await service.delete_staff(staff_id)
