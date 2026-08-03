from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from api.deps import get_current_staff, get_staff_service, require_role
from api.pagination import Page, PaginationParams, build_page
from api.validators import Password, PhoneNumber, RequestModel
from core.exceptions import AuthorizationException
from core.pagination import SortDir
from models import Staff
from models.enums import StaffRole, StaffStatus
from services.staff import StaffService, StaffSortField

router = APIRouter(prefix="/api/v1/staff", tags=["staff"])


class StaffCreateRequest(RequestModel):
    """Request schema for creating a staff member."""

    employee_code: str = Field(min_length=1, max_length=32)
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    email: EmailStr = Field(max_length=160)
    password: Password
    phone_number: PhoneNumber | None = None
    role: StaffRole | None = None


class StaffUpdateRequest(RequestModel):
    """Request schema for updating a staff member (excludes password)."""

    first_name: str | None = Field(None, min_length=1, max_length=80)
    last_name: str | None = Field(None, min_length=1, max_length=80)
    email: EmailStr | None = Field(None, max_length=160)
    phone_number: PhoneNumber | None = None
    role: StaffRole | None = None
    status: StaffStatus | None = None


class ChangePasswordRequest(RequestModel):
    """Request schema for changing a staff member's password."""

    new_password: Password


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
    service: StaffService = Depends(get_staff_service),
    _current_staff: Staff = Depends(require_role(StaffRole.ADMIN)),
) -> StaffResponse:
    """Create a new staff member. ADMIN only."""
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
    employee_code: str | None = Query(None, description="Case-insensitive substring match."),
    email: str | None = Query(None, description="Case-insensitive substring match."),
    phone_number: str | None = Query(None, description="Case-insensitive substring match."),
    sort_by: StaffSortField = Query(StaffSortField.EMPLOYEE_CODE),
    sort_dir: SortDir = Query(SortDir.ASC),
    service: StaffService = Depends(get_staff_service),
    _current_staff: Staff = Depends(get_current_staff),
) -> Page[StaffResponse]:
    """List staff. Every supplied filter is applied together."""
    staff, total = await service.list_staff(
        role=role,
        status=status,
        name=name,
        employee_code=employee_code,
        email=email,
        phone_number=phone_number,
        sort_by=sort_by,
        sort_dir=sort_dir,
        limit=pagination.limit,
        offset=pagination.skip,
    )
    return build_page(staff, total, pagination, StaffResponse)


@router.get("/{staff_id}", response_model=StaffResponse)
async def get_staff(
    staff_id: UUID,
    service: StaffService = Depends(get_staff_service),
    _current_staff: Staff = Depends(get_current_staff),
) -> StaffResponse:
    """Fetch a staff member by ID."""
    staff = await service.get_staff(staff_id)
    return StaffResponse.model_validate(staff)


@router.put("/{staff_id}", response_model=StaffResponse)
async def update_staff(
    staff_id: UUID,
    req: StaffUpdateRequest,
    service: StaffService = Depends(get_staff_service),
    _current_staff: Staff = Depends(require_role(StaffRole.ADMIN)),
) -> StaffResponse:
    """Update a staff member (password changes use the dedicated endpoint). ADMIN only."""
    staff = await service.update_staff(
        staff_id,
        first_name=req.first_name,
        last_name=req.last_name,
        email=req.email,
        phone_number=req.phone_number,
        role=req.role,
        status=req.status,
    )
    return StaffResponse.model_validate(staff)


@router.post("/{staff_id}/change-password", response_model=StaffResponse)
async def change_password(
    staff_id: UUID,
    req: ChangePasswordRequest,
    service: StaffService = Depends(get_staff_service),
    current_staff: Staff = Depends(get_current_staff),
) -> StaffResponse:
    """Change a staff member's password. Staff may change their own; ADMIN may change anyone's."""
    if current_staff.staff_id != staff_id and current_staff.role != StaffRole.ADMIN:
        raise AuthorizationException("You may only change your own password")
    staff = await service.change_password(staff_id, req.new_password)
    return StaffResponse.model_validate(staff)


@router.post("/{staff_id}/deactivate", response_model=StaffResponse)
async def deactivate_staff(
    staff_id: UUID,
    service: StaffService = Depends(get_staff_service),
    current_staff: Staff = Depends(require_role(StaffRole.ADMIN)),
) -> StaffResponse:
    """Deactivate a staff member. ADMIN only (guards in StaffService.deactivate_staff)."""
    staff = await service.deactivate_staff(staff_id, acting_staff_id=current_staff.staff_id)
    return StaffResponse.model_validate(staff)


@router.post("/{staff_id}/activate", response_model=StaffResponse)
async def activate_staff(
    staff_id: UUID,
    service: StaffService = Depends(get_staff_service),
    _current_staff: Staff = Depends(require_role(StaffRole.ADMIN)),
) -> StaffResponse:
    """Reactivate a deactivated staff member. ADMIN only."""
    staff = await service.activate_staff(staff_id)
    return StaffResponse.model_validate(staff)


@router.delete("/{staff_id}", status_code=204)
async def delete_staff(
    staff_id: UUID,
    service: StaffService = Depends(get_staff_service),
    _current_staff: Staff = Depends(require_role(StaffRole.ADMIN)),
) -> None:
    """Delete a staff member. ADMIN only."""
    await service.delete_staff(staff_id)
