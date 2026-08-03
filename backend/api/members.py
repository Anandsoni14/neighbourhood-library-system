from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from api.deps import get_current_staff, get_member_service
from api.pagination import Page, PaginationParams, build_page
from api.validators import PhoneNumber, PostalCode, RequestModel
from core.pagination import SortDir
from models.enums import MembershipStatus
from services.member import MemberService, MemberSortField

router = APIRouter(
    prefix="/api/v1/members",
    tags=["members"],
    dependencies=[Depends(get_current_staff)],
)


class MemberCreateRequest(RequestModel):
    """Request schema for creating a member."""

    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    email: EmailStr = Field(max_length=160)
    phone_number: PhoneNumber | None = None
    government_id_type: str | None = Field(None, max_length=40)
    government_id_number: str | None = Field(None, max_length=64)
    street: str | None = Field(None, max_length=160)
    city: str | None = Field(None, max_length=80)
    state: str | None = Field(None, max_length=80)
    postal_code: PostalCode | None = None
    country: str | None = Field(None, max_length=80)
    remarks: str | None = None


class MemberUpdateRequest(RequestModel):
    """Request schema for updating a member."""

    first_name: str | None = Field(None, min_length=1, max_length=80)
    last_name: str | None = Field(None, min_length=1, max_length=80)
    email: EmailStr | None = Field(None, max_length=160)
    phone_number: PhoneNumber | None = None
    government_id_type: str | None = Field(None, max_length=40)
    government_id_number: str | None = Field(None, max_length=64)
    street: str | None = Field(None, max_length=160)
    city: str | None = Field(None, max_length=80)
    state: str | None = Field(None, max_length=80)
    postal_code: PostalCode | None = None
    country: str | None = Field(None, max_length=80)
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
    req: MemberCreateRequest, service: MemberService = Depends(get_member_service)
) -> MemberResponse:
    """Create a new member."""
    member = await service.create_member(**req.model_dump())
    return MemberResponse.model_validate(member)


@router.get("", response_model=Page[MemberResponse])
async def list_members(
    pagination: PaginationParams = Depends(),
    status: MembershipStatus | None = Query(None),
    name: str | None = Query(None, description="Matches first or last name."),
    email: str | None = Query(None, description="Case-insensitive substring match."),
    phone_number: str | None = Query(None, description="Case-insensitive substring match."),
    sort_by: MemberSortField = Query(MemberSortField.LAST_NAME),
    sort_dir: SortDir = Query(SortDir.ASC),
    service: MemberService = Depends(get_member_service),
) -> Page[MemberResponse]:
    """List members. Every supplied filter is applied together."""
    members, total = await service.list_members(
        status=status,
        name=name,
        email=email,
        phone_number=phone_number,
        sort_by=sort_by,
        sort_dir=sort_dir,
        limit=pagination.limit,
        offset=pagination.skip,
    )
    return build_page(members, total, pagination, MemberResponse)


@router.get("/search", response_model=Page[MemberResponse])
async def search_members(
    name: str = Query(..., min_length=1),
    pagination: PaginationParams = Depends(),
    status: MembershipStatus | None = Query(None),
    sort_by: MemberSortField = Query(MemberSortField.LAST_NAME),
    sort_dir: SortDir = Query(SortDir.ASC),
    service: MemberService = Depends(get_member_service),
) -> Page[MemberResponse]:
    """Search members by first or last name.

    Declared before /{member_id} so this static path isn't captured by the
    member_id UUID path parameter.
    """
    members, total = await service.list_members(
        name=name,
        status=status,
        sort_by=sort_by,
        sort_dir=sort_dir,
        limit=pagination.limit,
        offset=pagination.skip,
    )
    return build_page(members, total, pagination, MemberResponse)


@router.get("/{member_id}", response_model=MemberResponse)
async def get_member(
    member_id: UUID, service: MemberService = Depends(get_member_service)
) -> MemberResponse:
    """Fetch a member by ID."""
    member = await service.get_member(member_id)
    return MemberResponse.model_validate(member)


@router.put("/{member_id}", response_model=MemberResponse)
async def update_member(
    member_id: UUID,
    req: MemberUpdateRequest,
    service: MemberService = Depends(get_member_service),
) -> MemberResponse:
    """Update a member."""
    member = await service.update_member(
        member_id,
        first_name=req.first_name,
        last_name=req.last_name,
        email=req.email,
        phone_number=req.phone_number,
        government_id_type=req.government_id_type,
        government_id_number=req.government_id_number,
        street=req.street,
        city=req.city,
        state=req.state,
        postal_code=req.postal_code,
        country=req.country,
        membership_status=req.membership_status,
        remarks=req.remarks,
    )
    return MemberResponse.model_validate(member)


@router.post("/{member_id}/suspend", response_model=MemberResponse)
async def suspend_member(
    member_id: UUID, service: MemberService = Depends(get_member_service)
) -> MemberResponse:
    """Suspend a member, blocking them from borrowing until reactivated."""
    member = await service.suspend_member(member_id)
    return MemberResponse.model_validate(member)


@router.post("/{member_id}/reactivate", response_model=MemberResponse)
async def reactivate_member(
    member_id: UUID, service: MemberService = Depends(get_member_service)
) -> MemberResponse:
    """Reactivate a suspended or inactive member."""
    member = await service.reactivate_member(member_id)
    return MemberResponse.model_validate(member)


@router.delete("/{member_id}", status_code=204)
async def delete_member(
    member_id: UUID, service: MemberService = Depends(get_member_service)
) -> None:
    """Delete a member."""
    await service.delete_member(member_id)
