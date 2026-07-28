from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Index, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import ENUM as PGENUM
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base
from models.enums import MembershipStatus
from models.mixins import TimestampMixin

if TYPE_CHECKING:
    from models.loan import Loan
    from models.transaction import Transaction

_membership_status = PGENUM(MembershipStatus, name="membership_status", create_type=False)


class Member(Base, TimestampMixin):
    __tablename__ = "member"
    __table_args__ = (
        UniqueConstraint("government_id_type", "government_id_number", name="uq_member_gov_id"),
        Index("idx_member_email", "email"),
        Index("idx_member_status", "membership_status"),
    )

    member_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    first_name: Mapped[str] = mapped_column(String(80), nullable=False)
    last_name: Mapped[str] = mapped_column(String(80), nullable=False)
    email: Mapped[str] = mapped_column(String(160), nullable=False, unique=True)
    phone_number: Mapped[str | None] = mapped_column(String(20))
    government_id_type: Mapped[str | None] = mapped_column(String(40))
    government_id_number: Mapped[str | None] = mapped_column(String(64))
    street: Mapped[str | None] = mapped_column(String(160))
    city: Mapped[str | None] = mapped_column(String(80))
    state: Mapped[str | None] = mapped_column(String(80))
    postal_code: Mapped[str | None] = mapped_column(String(20))
    country: Mapped[str | None] = mapped_column(String(80))
    membership_status: Mapped[MembershipStatus] = mapped_column(
        _membership_status, nullable=False, server_default=text("'ACTIVE'")
    )
    remarks: Mapped[str | None] = mapped_column(Text)

    loans: Mapped[list["Loan"]] = relationship(back_populates="member", lazy="raise")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="member", lazy="raise")
