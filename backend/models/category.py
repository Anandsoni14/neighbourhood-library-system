from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, Index, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base
from models.mixins import TimestampMixin

if TYPE_CHECKING:
    from models.book import Book


class Category(Base, TimestampMixin):
    """A book category.

    Replaces the free-text `book.category` string that preceded it, so the
    catalogue has one authoritative vocabulary: renaming a category updates
    every book at once, and the UI can offer a real dropdown instead of
    inviting a new spelling on every entry.
    """

    __tablename__ = "category"
    __table_args__ = (
        # No index on `name`: unique=True already creates a btree index.
        Index("idx_category_is_archived", "is_archived"),
    )

    category_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    # String(80) deliberately matches the width of the old book.category column
    # so the migration's backfill cannot truncate an existing value.
    name: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    # Categories are archived rather than deleted: the FK is ondelete=RESTRICT,
    # so any category that has ever been used could never be deleted anyway.
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))

    # lazy="raise" here (unlike Book.category) because this side is unbounded —
    # a category can have thousands of books and nothing needs them eagerly.
    books: Mapped[list["Book"]] = relationship(back_populates="category", lazy="raise")
