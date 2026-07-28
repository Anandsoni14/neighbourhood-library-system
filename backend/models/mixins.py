from datetime import datetime

from sqlalchemy import TIMESTAMP, func, text
from sqlalchemy.orm import Mapped, mapped_column


class TimestampMixin:
    """created_at/updated_at pair shared verbatim by staff, member, book, and book_copy."""

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
        onupdate=func.now(),
    )
