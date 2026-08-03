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
from core.security import hash_password
from models import Staff
from models.enums import StaffRole, StaffStatus
from repositories.staff import StaffRepository
from services.uniqueness import ensure_unique

logger = logging.getLogger(__name__)


class StaffSortField(StrEnum):
    """Columns a staff listing may be sorted by."""

    EMPLOYEE_CODE = "employee_code"
    FIRST_NAME = "first_name"
    LAST_NAME = "last_name"
    EMAIL = "email"
    ROLE = "role"
    STATUS = "status"


_SORT_COLUMNS: dict[StaffSortField, InstrumentedAttribute[Any]] = {
    StaffSortField.EMPLOYEE_CODE: Staff.employee_code,
    StaffSortField.FIRST_NAME: Staff.first_name,
    StaffSortField.LAST_NAME: Staff.last_name,
    StaffSortField.EMAIL: Staff.email,
    StaffSortField.ROLE: Staff.role,
    StaffSortField.STATUS: Staff.status,
}


class StaffService:
    """Staff service with business logic."""

    def __init__(self, session: AsyncSession) -> None:
        self.repository = StaffRepository(session)

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
        await ensure_unique(
            lambda: self.repository.get_by_employee_code(employee_code),
            id_attr="staff_id",
            current_id=None,
            message=f"Staff with employee code {employee_code} already exists",
        )
        await ensure_unique(
            lambda: self.repository.get_by_email(email),
            id_attr="staff_id",
            current_id=None,
            message=f"Staff with email {email} already exists",
        )

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

    async def list_staff(
        self,
        *,
        role: StaffRole | None = None,
        status: StaffStatus | None = None,
        name: str | None = None,
        employee_code: str | None = None,
        email: str | None = None,
        phone_number: str | None = None,
        sort_by: StaffSortField = StaffSortField.EMPLOYEE_CODE,
        sort_dir: SortDir = SortDir.ASC,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Staff], int]:
        """List staff matching every supplied filter, returning the page and total."""
        filters: list[ColumnElement[bool]] = []
        if role is not None:
            filters.append(Staff.role == role)
        if status is not None:
            filters.append(Staff.status == status)
        if name:
            filters.append(name_ilike_filter(name, Staff.first_name, Staff.last_name))
        if employee_code:
            filters.append(Staff.employee_code.ilike(f"%{employee_code}%"))
        if email:
            filters.append(Staff.email.ilike(f"%{email}%"))
        if phone_number:
            filters.append(Staff.phone_number.ilike(f"%{phone_number}%"))

        staff, total = await self.repository.list_paginated(
            filters=filters,
            sort_by=_SORT_COLUMNS[sort_by],
            sort_dir=sort_dir,
            limit=limit,
            offset=offset,
        )
        return list(staff), total

    async def update_staff(
        self,
        staff_id: UUID,
        *,
        first_name: str | None = None,
        last_name: str | None = None,
        email: str | None = None,
        phone_number: str | None = None,
        role: StaffRole | None = None,
        status: StaffStatus | None = None,
    ) -> Staff:
        """Update staff fields. Email must remain unique.

        The signature is the contract: `password`/`password_hash` are absent,
        so a password can only be changed through change_password(), which
        hashes it. A None argument means "leave unchanged" — the same thing
        an omitted key meant when this took **fields.
        """
        staff = await self.get_staff(staff_id)

        if email and email != staff.email:
            await ensure_unique(
                lambda: self.repository.get_by_email(email),
                id_attr="staff_id",
                current_id=staff_id,
                message=f"Email {email} is already in use",
            )

        fields: dict[str, Any] = {
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "phone_number": phone_number,
            "role": role,
            "status": status,
        }
        self.repository.assign(staff, fields, skip_none=True)
        await self.repository.save(staff)
        logger.info("staff_updated", extra={"staff_id": str(staff_id)})
        return staff

    async def change_password(self, staff_id: UUID, new_password: str) -> Staff:
        """Change a staff member's password, re-hashing it."""
        staff = await self.get_staff(staff_id)
        staff.password_hash = hash_password(new_password)
        await self.repository.save(staff)
        logger.info("staff_password_changed", extra={"staff_id": str(staff_id)})
        return staff

    async def deactivate_staff(self, staff_id: UUID, *, acting_staff_id: UUID) -> Staff:
        """Set a staff member's status to INACTIVE (soft-disable, not deletion).

        Guards a generic update_staff(status=...) can't express: an ADMIN can't
        deactivate themselves (would invalidate their own token mid-request),
        and the last active ADMIN can't be deactivated (would lock every
        ADMIN-only endpoint with no recovery).
        """
        if staff_id == acting_staff_id:
            raise ConflictError("You cannot deactivate your own account")

        staff = await self.get_staff(staff_id)
        if staff.role == StaffRole.ADMIN and staff.status == StaffStatus.ACTIVE:
            active_admins = await self.repository.count_active_admins()
            if active_admins <= 1:
                raise ConflictError("Cannot deactivate the last remaining active admin")

        if staff.status == StaffStatus.INACTIVE:
            return staff
        staff.status = StaffStatus.INACTIVE
        await self.repository.save(staff)
        logger.info("staff_deactivated", extra={"staff_id": str(staff_id)})
        return staff

    async def activate_staff(self, staff_id: UUID) -> Staff:
        """Set a staff member's status to ACTIVE. Idempotent."""
        staff = await self.get_staff(staff_id)
        if staff.status == StaffStatus.ACTIVE:
            return staff
        staff.status = StaffStatus.ACTIVE
        await self.repository.save(staff)
        logger.info("staff_activated", extra={"staff_id": str(staff_id)})
        return staff

    async def delete_staff(self, staff_id: UUID) -> None:
        """Delete a staff member. Fails if the staff has associated loan records."""
        staff = await self.get_staff(staff_id)
        try:
            await self.repository.delete(staff)
        except IntegrityError as e:
            raise ConflictError(
                f"Cannot delete staff {staff_id}: it has associated loan records"
            ) from e
        logger.info("staff_deleted", extra={"staff_id": str(staff_id)})
