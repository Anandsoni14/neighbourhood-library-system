import logging
from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from core.exceptions import ConflictError, NotFoundError
from core.pagination import SortDir, name_ilike_filter
from models import Member
from models.enums import MembershipStatus
from repositories.member import MemberRepository
from services.uniqueness import ensure_unique

logger = logging.getLogger(__name__)


class MemberSortField(StrEnum):
    """Columns a member listing may be sorted by."""

    FIRST_NAME = "first_name"
    LAST_NAME = "last_name"
    EMAIL = "email"
    MEMBERSHIP_STATUS = "membership_status"
    CREATED_AT = "created_at"


_SORT_COLUMNS: dict[MemberSortField, InstrumentedAttribute[Any]] = {
    MemberSortField.FIRST_NAME: Member.first_name,
    MemberSortField.LAST_NAME: Member.last_name,
    MemberSortField.EMAIL: Member.email,
    MemberSortField.MEMBERSHIP_STATUS: Member.membership_status,
    MemberSortField.CREATED_AT: Member.created_at,
}


class MemberService:
    """Member service with business logic."""

    def __init__(self, session: AsyncSession) -> None:
        self.repository = MemberRepository(session)

    async def create_member(
        self,
        first_name: str,
        last_name: str,
        email: str,
        phone_number: str | None = None,
        government_id_type: str | None = None,
        government_id_number: str | None = None,
        street: str | None = None,
        city: str | None = None,
        state: str | None = None,
        postal_code: str | None = None,
        country: str | None = None,
        remarks: str | None = None,
    ) -> Member:
        """Create a new member. Email and government ID combo must be unique."""
        await ensure_unique(
            lambda: self.repository.get_by_email(email),
            id_attr="member_id",
            current_id=None,
            message=f"Member with email {email} already exists",
        )

        if government_id_type and government_id_number:
            await ensure_unique(
                lambda: self.repository.get_by_government_id(
                    government_id_type, government_id_number
                ),
                id_attr="member_id",
                current_id=None,
                message=(
                    f"Member with government ID {government_id_type}:"
                    f"{government_id_number} already exists"
                ),
            )

        member = Member(
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone_number=phone_number,
            government_id_type=government_id_type,
            government_id_number=government_id_number,
            street=street,
            city=city,
            state=state,
            postal_code=postal_code,
            country=country,
            remarks=remarks,
        )
        created = await self.repository.add(member)
        logger.info(
            "member_created",
            extra={"member_id": str(created.member_id), "email": email},
        )
        return created

    async def get_member(self, member_id: UUID) -> Member:
        """Fetch member by ID."""
        member = await self.repository.get_by_id(member_id)
        if not member:
            raise NotFoundError(f"Member {member_id} not found")
        return member

    async def list_members(
        self,
        *,
        status: MembershipStatus | None = None,
        name: str | None = None,
        email: str | None = None,
        phone_number: str | None = None,
        sort_by: MemberSortField = MemberSortField.LAST_NAME,
        sort_dir: SortDir = SortDir.ASC,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Member], int]:
        """List members matching every supplied filter. `name` matches first or last."""
        filters: list[ColumnElement[bool]] = []
        if status is not None:
            filters.append(Member.membership_status == status)
        if name:
            filters.append(name_ilike_filter(name, Member.first_name, Member.last_name))
        if email:
            filters.append(Member.email.ilike(f"%{email}%"))
        if phone_number:
            filters.append(Member.phone_number.ilike(f"%{phone_number}%"))

        members, total = await self.repository.list_paginated(
            filters=filters,
            sort_by=_SORT_COLUMNS[sort_by],
            sort_dir=sort_dir,
            limit=limit,
            offset=offset,
        )
        return list(members), total

    async def update_member(
        self,
        member_id: UUID,
        *,
        first_name: str | None = None,
        last_name: str | None = None,
        email: str | None = None,
        phone_number: str | None = None,
        government_id_type: str | None = None,
        government_id_number: str | None = None,
        street: str | None = None,
        city: str | None = None,
        state: str | None = None,
        postal_code: str | None = None,
        country: str | None = None,
        membership_status: MembershipStatus | None = None,
        remarks: str | None = None,
    ) -> Member:
        """Update member fields. Email and government ID combo must remain unique.

        A None argument means "leave unchanged" — the same thing an omitted
        key meant when this took **fields.
        """
        member = await self.get_member(member_id)

        if email and email != member.email:
            await ensure_unique(
                lambda: self.repository.get_by_email(email),
                id_attr="member_id",
                current_id=member_id,
                message=f"Email {email} is already in use",
            )

        new_gov_type = government_id_type or member.government_id_type
        new_gov_number = government_id_number or member.government_id_number
        gov_id_changed = (
            new_gov_type != member.government_id_type
            or new_gov_number != member.government_id_number
        )
        if gov_id_changed and new_gov_type and new_gov_number:
            await ensure_unique(
                lambda: self.repository.get_by_government_id(new_gov_type, new_gov_number),
                id_attr="member_id",
                current_id=member_id,
                message=f"Government ID {new_gov_type}:{new_gov_number} is already in use",
            )

        fields: dict[str, Any] = {
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "phone_number": phone_number,
            "government_id_type": government_id_type,
            "government_id_number": government_id_number,
            "street": street,
            "city": city,
            "state": state,
            "postal_code": postal_code,
            "country": country,
            "membership_status": membership_status,
            "remarks": remarks,
        }
        self.repository.assign(member, fields, skip_none=True)
        await self.repository.save(member)
        logger.info("member_updated", extra={"member_id": str(member_id)})
        return member

    async def suspend_member(self, member_id: UUID) -> Member:
        """Suspend a member (-> BLOCKED), blocking new loans. Idempotent."""
        member = await self.get_member(member_id)
        member.membership_status = MembershipStatus.BLOCKED
        await self.repository.save(member)
        logger.info("member_suspended", extra={"member_id": str(member_id)})
        return member

    async def reactivate_member(self, member_id: UUID) -> Member:
        """Reactivate a member (-> ACTIVE) from BLOCKED or INACTIVE. Idempotent."""
        member = await self.get_member(member_id)
        member.membership_status = MembershipStatus.ACTIVE
        await self.repository.save(member)
        logger.info("member_reactivated", extra={"member_id": str(member_id)})
        return member

    async def delete_member(self, member_id: UUID) -> None:
        """Delete a member. Fails if the member has loan or transaction history."""
        member = await self.get_member(member_id)
        try:
            await self.repository.delete(member)
        except IntegrityError as e:
            raise ConflictError(
                f"Cannot delete member {member_id}: it has associated loan or transaction records"
            ) from e
        logger.info("member_deleted", extra={"member_id": str(member_id)})
