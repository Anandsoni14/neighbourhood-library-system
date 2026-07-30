import logging
from typing import Any
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ConflictError, NotFoundError
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

    async def list_members(self, limit: int = 100, offset: int = 0) -> list[Member]:
        """List all members with pagination."""
        all_members = await self.repository.list_all()
        return list(all_members)[offset : offset + limit]

    async def list_members_by_status(self, status: MembershipStatus) -> list[Member]:
        """List all members with a given membership status."""
        return await self.repository.list_by_status(status)

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

    async def search_members(self, name: str | None = None) -> list[Member]:
        """Search members by first or last name."""
        if name:
            return await self.repository.search_by_name(name)
        return list(await self.repository.list_all())
