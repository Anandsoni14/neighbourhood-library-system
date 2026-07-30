from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ConflictError, NotFoundError
from db.session import get_db
from models.enums import MembershipStatus
from services.member import MemberService

router = APIRouter(prefix="/api/v1/members", tags=["members"])


class MemberCreateRequest(BaseModel):
    """Request schema for creating a member."""

    first_name: str
    last_name: str
    email: EmailStr
    phone_number: str | None = None
    government_id_type: str | None = None
    government_id_number: str | None = None
    street: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country: str | None = None
    remarks: str | None = None


class MemberUpdateRequest(BaseModel):
    """Request schema for updating a member."""

    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    phone_number: str | None = None
    government_id_type: str | None = None
    government_id_number: str | None = None
    street: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country: str | None = None
    membership_status: MembershipStatus | None = None
    remarks: str | None = None


class MemberResponse(BaseModel):
    """Response schema for a member."""

    model_config = ConfigDict(from_attributes=True)

    member_id: UUID
    first_name: str
    last_name: str
    email: str
    phone_number: str | None
    government_id_type: str | None
    government_id_number: str | None
    street: str | None
    city: str | None
    state: str | None
    postal_code: str | None
    country: str | None
    membership_status: MembershipStatus
    remarks: str | None


@router.post("", response_model=MemberResponse, status_code=201)
async def create_member(
    req: MemberCreateRequest, db: AsyncSession = Depends(get_db)
) -> MemberResponse:
    """Create a new member."""
    service = MemberService(db)
    try:
        member = await service.create_member(**req.model_dump())
        return MemberResponse.model_validate(member)
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.get("", response_model=list[MemberResponse])
async def list_members(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: MembershipStatus | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[MemberResponse]:
    """List members with optional filtering by membership status."""
    service = MemberService(db)
    if status is not None:
        members = await service.list_members_by_status(status)
    else:
        members = await service.list_members(limit=limit, offset=skip)
    return [MemberResponse.model_validate(m) for m in members]


@router.get("/search", response_model=list[MemberResponse])
async def search_members(
    name: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
) -> list[MemberResponse]:
    """Search members by first or last name."""
    service = MemberService(db)
    members = await service.search_members(name=name)
    return [MemberResponse.model_validate(m) for m in members]


@router.get("/{member_id}", response_model=MemberResponse)
async def get_member(member_id: UUID, db: AsyncSession = Depends(get_db)) -> MemberResponse:
    """Fetch a member by ID."""
    service = MemberService(db)
    try:
        member = await service.get_member(member_id)
        return MemberResponse.model_validate(member)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.put("/{member_id}", response_model=MemberResponse)
async def update_member(
    member_id: UUID, req: MemberUpdateRequest, db: AsyncSession = Depends(get_db)
) -> MemberResponse:
    """Update a member."""
    service = MemberService(db)
    try:
        member = await service.update_member(member_id, **req.model_dump(exclude_unset=True))
        return MemberResponse.model_validate(member)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.delete("/{member_id}", status_code=204)
async def delete_member(member_id: UUID, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a member."""
    service = MemberService(db)
    try:
        await service.delete_member(member_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
