import logging
from typing import Any
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ConflictError, NotFoundError
from core.security import hash_password
from models import Staff
from models.enums import StaffRole, StaffStatus
from repositories.staff import StaffRepository

logger = logging.getLogger(__name__)

# Fields that must never be set through the generic update path — password
# changes go through change_password() so they're always hashed.
_PROTECTED_UPDATE_FIELDS = frozenset({"password_hash", "password"})


class StaffService:
    """Staff service with business logic."""

    def __init__(self, session: AsyncSession) -> None:
        self.repository = StaffRepository(session)
        self._session = session

    async def create_staff(
        self,
        employee_code: str,
        first_name: str,
        last_name: str,
        email: str,
        password: str,
        phone_number: str | None = None,
        role: StaffRole | None = None,
    ) -> Staff:
        """Create a new staff member. Employee code and email must be unique."""
        if await self.repository.get_by_employee_code(employee_code):
            raise ConflictError(f"Staff with employee code {employee_code} already exists")

        if await self.repository.get_by_email(email):
            raise ConflictError(f"Staff with email {email} already exists")

        staff_kwargs: dict[str, Any] = {
            "employee_code": employee_code,
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "password_hash": hash_password(password),
            "phone_number": phone_number,
        }
        if role is not None:
            staff_kwargs["role"] = role

        staff = Staff(**staff_kwargs)
        created = await self.repository.add(staff)
        logger.info(
            "staff_created",
            extra={"staff_id": str(created.staff_id), "employee_code": employee_code},
        )
        return created

    async def get_staff(self, staff_id: UUID) -> Staff:
        """Fetch staff by ID."""
        staff = await self.repository.get_by_id(staff_id)
        if not staff:
            raise NotFoundError(f"Staff {staff_id} not found")
        return staff

    async def list_staff(self, limit: int = 100, offset: int = 0) -> list[Staff]:
        """List all staff with pagination."""
        all_staff = await self.repository.list_all()
        return list(all_staff)[offset : offset + limit]

    async def update_staff(self, staff_id: UUID, **fields: Any) -> Staff:
        """Update staff fields. Employee code and email must remain unique.

        Password changes are rejected here — use change_password() instead.
        """
        if _PROTECTED_UPDATE_FIELDS & fields.keys():
            raise ConflictError("Password cannot be changed via update_staff; use change_password")

        staff = await self.get_staff(staff_id)

        if (
            "employee_code" in fields
            and fields["employee_code"]
            and fields["employee_code"] != staff.employee_code
        ):
            existing = await self.repository.get_by_employee_code(fields["employee_code"])
            if existing and existing.staff_id != staff_id:
                raise ConflictError(f"Employee code {fields['employee_code']} is already in use")

        if "email" in fields and fields["email"] and fields["email"] != staff.email:
            existing = await self.repository.get_by_email(fields["email"])
            if existing and existing.staff_id != staff_id:
                raise ConflictError(f"Email {fields['email']} is already in use")

        for key, value in fields.items():
            if value is not None and hasattr(staff, key):
                setattr(staff, key, value)

        self._session.add(staff)
        await self._session.flush()
        logger.info("staff_updated", extra={"staff_id": str(staff_id)})
        return staff

    async def change_password(self, staff_id: UUID, new_password: str) -> Staff:
        """Change a staff member's password, re-hashing it."""
        staff = await self.get_staff(staff_id)
        staff.password_hash = hash_password(new_password)
        self._session.add(staff)
        await self._session.flush()
        logger.info("staff_password_changed", extra={"staff_id": str(staff_id)})
        return staff

    async def deactivate_staff(self, staff_id: UUID) -> Staff:
        """Set a staff member's status to INACTIVE (soft-disable, not deletion)."""
        return await self.update_staff(staff_id, status=StaffStatus.INACTIVE)

    async def delete_staff(self, staff_id: UUID) -> None:
        """Delete a staff member. Fails if the staff has associated loan records."""
        staff = await self.get_staff(staff_id)
        await self.repository.delete(staff)
        try:
            await self._session.flush()
        except IntegrityError as e:
            raise ConflictError(
                f"Cannot delete staff {staff_id}: it has associated loan records"
            ) from e
        logger.info("staff_deleted", extra={"staff_id": str(staff_id)})
