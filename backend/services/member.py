import logging
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from core.exceptions import ConflictError, NotFoundError
from core.pagination import SortDir
from models import Member
from models.enums import MembershipStatus
from repositories.member import MemberRepository

logger = logging.getLogger(__name__)


class MemberService:
    """Member service with business logic."""

    def __init__(self, session: AsyncSession) -> None:
        self.repository = MemberRepository(session)
        self._session = session

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
        existing = await self.repository.get_by_email(email)
        if existing:
            raise ConflictError(f"Member with email {email} already exists")

        if government_id_type and government_id_number:
            existing_gov_id = await self.repository.get_by_government_id(
                government_id_type, government_id_number
            )
            if existing_gov_id:
                raise ConflictError(
                    f"Member with government ID {government_id_type}:"
                    f"{government_id_number} already exists"
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
        sort_by: InstrumentedAttribute[Any] | None = None,
        sort_dir: SortDir = SortDir.ASC,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Member], int]:
        """List members matching every supplied filter, returning the page and total.

        `name` matches either the first or last name, so a single search box can
        find "Ada" and "Lovelace" alike.
        """
        filters: list[ColumnElement[bool]] = []
        if status is not None:
            filters.append(Member.membership_status == status)
        if name:
            pattern = f"%{name}%"
            filters.append(Member.first_name.ilike(pattern) | Member.last_name.ilike(pattern))
        if email:
            filters.append(Member.email.ilike(f"%{email}%"))
        if phone_number:
            filters.append(Member.phone_number.ilike(f"%{phone_number}%"))

        members, total = await self.repository.list_paginated(
            filters=filters,
            sort_by=sort_by,
            sort_dir=sort_dir,
            limit=limit,
            offset=offset,
        )
        return list(members), total

    async def update_member(self, member_id: UUID, **fields: Any) -> Member:
        """Update member fields. Email and government ID combo must remain unique."""
        member = await self.get_member(member_id)

        if "email" in fields and fields["email"] and fields["email"] != member.email:
            existing = await self.repository.get_by_email(fields["email"])
            if existing and existing.member_id != member_id:
                raise ConflictError(f"Email {fields['email']} is already in use")

        new_gov_type = fields.get("government_id_type", member.government_id_type)
        new_gov_number = fields.get("government_id_number", member.government_id_number)
        gov_id_changed = (
            new_gov_type != member.government_id_type
            or new_gov_number != member.government_id_number
        )
        if gov_id_changed and new_gov_type and new_gov_number:
            existing_gov_id = await self.repository.get_by_government_id(
                new_gov_type, new_gov_number
            )
            if existing_gov_id and existing_gov_id.member_id != member_id:
                raise ConflictError(
                    f"Government ID {new_gov_type}:{new_gov_number} is already in use"
                )

        for key, value in fields.items():
            if value is not None and hasattr(member, key):
                setattr(member, key, value)

        self._session.add(member)
        await self._session.flush()
        logger.info("member_updated", extra={"member_id": str(member_id)})
        return member

    async def suspend_member(self, member_id: UUID) -> Member:
        """Suspend a member (-> BLOCKED), blocking new loans immediately.

        Idempotent, so a retried request behaves the same as the first one.
        Enforcement is `LoanService.issue_loan`'s existing ACTIVE-only check —
        this only flips the status that check reads.
        """
        member = await self.get_member(member_id)
        member.membership_status = MembershipStatus.BLOCKED
        self._session.add(member)
        await self._session.flush()
        logger.info("member_suspended", extra={"member_id": str(member_id)})
        return member

    async def reactivate_member(self, member_id: UUID) -> Member:
        """Reactivate a member (-> ACTIVE) from BLOCKED or INACTIVE. Idempotent."""
        member = await self.get_member(member_id)
        member.membership_status = MembershipStatus.ACTIVE
        self._session.add(member)
        await self._session.flush()
        logger.info("member_reactivated", extra={"member_id": str(member_id)})
        return member

    async def delete_member(self, member_id: UUID) -> None:
        """Delete a member. Fails if the member has loan or transaction history."""
        member = await self.get_member(member_id)
        await self.repository.delete(member)
        try:
            await self._session.flush()
        except IntegrityError as e:
            raise ConflictError(
                f"Cannot delete member {member_id}: it has associated loan or transaction records"
            ) from e
        logger.info("member_deleted", extra={"member_id": str(member_id)})
