from enum import StrEnum

from sqlalchemy import ColumnElement
from sqlalchemy.orm import InstrumentedAttribute


class SortDir(StrEnum):
    """Sort direction for list queries.

    Lives in `core` rather than `api` so the repository layer can accept it
    without importing from the web layer.
    """

    ASC = "asc"
    DESC = "desc"


class ArchiveFilter(StrEnum):
    """Tri-state so "archived only" is expressible, not just "active plus
    archived". Shared by every router with an is_archived column."""

    ACTIVE = "active"
    ARCHIVED = "archived"
    ALL = "all"


ARCHIVE_FILTER_VALUES: dict[ArchiveFilter, bool | None] = {
    ArchiveFilter.ACTIVE: False,
    ArchiveFilter.ARCHIVED: True,
    ArchiveFilter.ALL: None,
}


def name_ilike_filter(
    pattern: str, first_name: InstrumentedAttribute[str], last_name: InstrumentedAttribute[str]
) -> ColumnElement[bool]:
    """Case-insensitive substring match against either column — the "search
    by first or last name" filter shared by member/staff/loan listings."""
    like_pattern = f"%{pattern}%"
    return first_name.ilike(like_pattern) | last_name.ilike(like_pattern)
