from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, Index, String, text
from sqlalchemy.dialects.postgresql import ENUM as PGENUM
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base
from models.enums import StaffRole, StaffStatus
from models.mixins import TimestampMixin

if TYPE_CHECKING:
    from models.loan import Loan

_staff_role = PGENUM(StaffRole, name="staff_role", create_type=False)
_staff_status = PGENUM(StaffStatus, name="staff_status", create_type=False)


class Staff(Base, TimestampMixin):
    __tablename__ = "staff"
    __table_args__ = (
        Index("idx_staff_email", "email"),
        Index("idx_staff_employee_code", "employee_code"),
    )

    staff_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    employee_code: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    first_name: Mapped[str] = mapped_column(String(80), nullable=False)
    last_name: Mapped[str] = mapped_column(String(80), nullable=False)
    email: Mapped[str] = mapped_column(String(160), nullable=False, unique=True)
    phone_number: Mapped[str | None] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[StaffRole] = mapped_column(
        _staff_role, nullable=False, server_default=text("'LIBRARIAN'")
    )
    status: Mapped[StaffStatus] = mapped_column(
        _staff_status, nullable=False, server_default=text("'ACTIVE'")
    )
    last_login_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))

    issued_loans: Mapped[list["Loan"]] = relationship(
        foreign_keys="[Loan.issued_by_staff_id]",
        back_populates="issued_by",
        lazy="raise",
    )
    received_loans: Mapped[list["Loan"]] = relationship(
        foreign_keys="[Loan.received_by_staff_id]",
        back_populates="received_by",
        lazy="raise",
    )
