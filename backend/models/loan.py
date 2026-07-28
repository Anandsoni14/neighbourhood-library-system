from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, CheckConstraint, ForeignKey, Index, Numeric, Text, text
from sqlalchemy.dialects.postgresql import ENUM as PGENUM
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base
from models.enums import CopyCondition, LoanStatus

if TYPE_CHECKING:
    from models.book import BookCopy
    from models.member import Member
    from models.staff import Staff
    from models.transaction import Transaction

_copy_condition = PGENUM(CopyCondition, name="copy_condition", create_type=False)
_loan_status = PGENUM(LoanStatus, name="loan_status", create_type=False)


class Loan(Base):
    __tablename__ = "loan"
    __table_args__ = (
        CheckConstraint("due_at > borrowed_at", name="chk_loan_due_after_borrow"),
        CheckConstraint(
            "(status = 'ACTIVE' AND returned_at IS NULL) OR "
            "(status = 'RETURNED' AND returned_at IS NOT NULL)",
            name="chk_loan_returned_state",
        ),
        CheckConstraint("calculated_fine >= 0", name="loan_calculated_fine_check"),
        Index("idx_loan_member_id", "member_id"),
        Index("idx_loan_copy_id", "copy_id"),
        Index("idx_loan_status", "status"),
        Index("idx_loan_due_at", "due_at"),
        Index("idx_loan_status_due_at", "status", "due_at"),
        Index(
            "one_active_loan_per_copy",
            "copy_id",
            unique=True,
            postgresql_where=text("status = 'ACTIVE'"),
        ),
    )

    loan_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    copy_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("book_copy.copy_id", ondelete="RESTRICT"),
        nullable=False,
    )
    member_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("member.member_id", ondelete="RESTRICT"), nullable=False
    )
    issued_by_staff_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("staff.staff_id", ondelete="RESTRICT"), nullable=False
    )
    received_by_staff_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("staff.staff_id", ondelete="RESTRICT")
    )
    borrowed_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )
    due_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    returned_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    borrow_condition: Mapped[CopyCondition] = mapped_column(_copy_condition, nullable=False)
    return_condition: Mapped[CopyCondition | None] = mapped_column(_copy_condition)
    status: Mapped[LoanStatus] = mapped_column(
        _loan_status, nullable=False, server_default=text("'ACTIVE'")
    )
    calculated_fine: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, server_default=text("0.00")
    )
    remarks: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )
    closed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))

    copy: Mapped["BookCopy"] = relationship(back_populates="loans", lazy="raise")
    member: Mapped["Member"] = relationship(back_populates="loans", lazy="raise")
    issued_by: Mapped["Staff"] = relationship(
        foreign_keys=[issued_by_staff_id], back_populates="issued_loans", lazy="raise"
    )
    received_by: Mapped["Staff | None"] = relationship(
        foreign_keys=[received_by_staff_id], back_populates="received_loans", lazy="raise"
    )
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="loan", lazy="raise")
