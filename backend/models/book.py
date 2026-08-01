from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Numeric,
    SmallInteger,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import ENUM as PGENUM
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base
from models.enums import CopyCondition, CopyStatus
from models.mixins import TimestampMixin

if TYPE_CHECKING:
    from models.category import Category
    from models.loan import Loan

_copy_condition = PGENUM(CopyCondition, name="copy_condition", create_type=False)
_copy_status = PGENUM(CopyStatus, name="copy_status", create_type=False)


class Book(Base, TimestampMixin):
    __tablename__ = "book"
    __table_args__ = (
        CheckConstraint("published_year BETWEEN 1400 AND 2100", name="book_published_year_check"),
        Index("idx_book_isbn", "isbn"),
        Index("idx_book_title", "title"),
        Index("idx_book_category_id", "category_id"),
        Index("idx_book_is_archived", "is_archived"),
    )

    book_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    author: Mapped[str] = mapped_column(String(160), nullable=False)
    publisher: Mapped[str | None] = mapped_column(String(160))
    isbn: Mapped[str | None] = mapped_column(String(20), unique=True)
    category_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        # Named explicitly so migration downgrades don't have to guess the implicit FK name.
        ForeignKey("category.category_id", ondelete="RESTRICT", name="fk_book_category_id"),
    )
    description: Mapped[str | None] = mapped_column(Text)
    published_year: Mapped[int | None] = mapped_column(SmallInteger)
    # Archived, never deleted — books with loan history can't be removed without losing that record.
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))

    # lazy="selectin" (not this codebase's usual lazy="raise"): BookResponse reads
    # `category` on every response, and Category is a small dimension table.
    category: Mapped["Category | None"] = relationship(back_populates="books", lazy="selectin")
    copies: Mapped[list["BookCopy"]] = relationship(back_populates="book", lazy="raise")


class BookCopy(Base, TimestampMixin):
    __tablename__ = "book_copy"
    __table_args__ = (
        CheckConstraint("max_borrow_days > 0", name="book_copy_max_borrow_days_check"),
        CheckConstraint("late_fee_per_day >= 0", name="book_copy_late_fee_per_day_check"),
        Index("idx_copy_book_id", "book_id"),
        Index("idx_copy_barcode", "barcode"),
        Index("idx_copy_status", "status"),
    )

    copy_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    book_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("book.book_id", ondelete="RESTRICT"), nullable=False
    )
    barcode: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    shelf_code: Mapped[str | None] = mapped_column(String(32))
    condition: Mapped[CopyCondition] = mapped_column(
        _copy_condition, nullable=False, server_default=text("'NEW'")
    )
    status: Mapped[CopyStatus] = mapped_column(
        _copy_status, nullable=False, server_default=text("'AVAILABLE'")
    )
    max_borrow_days: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default=text("14")
    )
    late_fee_per_day: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, server_default=text("5.00")
    )

    book: Mapped["Book"] = relationship(back_populates="copies", lazy="raise")
    loans: Mapped[list["Loan"]] = relationship(back_populates="copy", lazy="raise")
