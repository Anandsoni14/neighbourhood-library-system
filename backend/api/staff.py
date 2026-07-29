from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ConflictError, NotFoundError
from db.session import get_db
from models.enums import StaffRole, StaffStatus
from services.staff import StaffService

router = APIRouter(prefix="/api/v1/staff", tags=["staff"])


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
    req: StaffCreateRequest, db: AsyncSession = Depends(get_db)
) -> StaffResponse:
    """Create a new staff member."""
    service = StaffService(db)
    try:
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
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.get("", response_model=list[StaffResponse])
async def list_staff(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
) -> list[StaffResponse]:
    """List all staff with pagination."""
    service = StaffService(db)
    staff = await service.list_staff(limit=limit, offset=skip)
    return [StaffResponse.model_validate(s) for s in staff]


@router.get("/{staff_id}", response_model=StaffResponse)
async def get_staff(staff_id: UUID, db: AsyncSession = Depends(get_db)) -> StaffResponse:
    """Fetch a staff member by ID."""
    service = StaffService(db)
    try:
        staff = await service.get_staff(staff_id)
        return StaffResponse.model_validate(staff)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.put("/{staff_id}", response_model=StaffResponse)
async def update_staff(
    staff_id: UUID, req: StaffUpdateRequest, db: AsyncSession = Depends(get_db)
) -> StaffResponse:
    """Update a staff member (password changes use the dedicated endpoint)."""
    service = StaffService(db)
    try:
        staff = await service.update_staff(staff_id, **req.model_dump(exclude_unset=True))
        return StaffResponse.model_validate(staff)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.post("/{staff_id}/change-password", response_model=StaffResponse)
async def change_password(
    staff_id: UUID, req: ChangePasswordRequest, db: AsyncSession = Depends(get_db)
) -> StaffResponse:
    """Change a staff member's password."""
    service = StaffService(db)
    try:
        staff = await service.change_password(staff_id, req.new_password)
        return StaffResponse.model_validate(staff)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.delete("/{staff_id}", status_code=204)
async def delete_staff(staff_id: UUID, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a staff member."""
    service = StaffService(db)
    try:
        await service.delete_staff(staff_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
