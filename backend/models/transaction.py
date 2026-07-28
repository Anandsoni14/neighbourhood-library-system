from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, CheckConstraint, ForeignKey, Index, Numeric, String, text
from sqlalchemy.dialects.postgresql import ENUM as PGENUM
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base
from models.enums import PaymentMode, TransactionStatus, TransactionType

if TYPE_CHECKING:
    from models.loan import Loan
    from models.member import Member

_transaction_type = PGENUM(TransactionType, name="transaction_type", create_type=False)
_payment_mode = PGENUM(PaymentMode, name="payment_mode", create_type=False)
_transaction_status = PGENUM(TransactionStatus, name="transaction_status", create_type=False)


class Transaction(Base):
    __tablename__ = "transaction"
    __table_args__ = (
        CheckConstraint("amount >= 0", name="transaction_amount_check"),
        CheckConstraint(
            "(transaction_type = 'WAIVER' AND payment_mode IS NULL) OR "
            "(transaction_type <> 'WAIVER')",
            name="chk_txn_waiver_mode",
        ),
        Index("idx_txn_member_id", "member_id"),
        Index("idx_txn_loan_id", "loan_id"),
        Index("idx_txn_status", "status"),
        Index("idx_txn_created_at", "created_at"),
    )

    transaction_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    loan_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("loan.loan_id", ondelete="RESTRICT")
    )
    member_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("member.member_id", ondelete="RESTRICT"), nullable=False
    )
    transaction_type: Mapped[TransactionType] = mapped_column(_transaction_type, nullable=False)
    payment_mode: Mapped[PaymentMode | None] = mapped_column(_payment_mode)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    payment_reference: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[TransactionStatus] = mapped_column(
        _transaction_status, nullable=False, server_default=text("'PENDING'")
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )

    loan: Mapped["Loan | None"] = relationship(back_populates="transactions", lazy="raise")
    member: Mapped["Member"] = relationship(back_populates="transactions", lazy="raise")
