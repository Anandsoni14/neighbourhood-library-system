from dataclasses import dataclass

from fastapi import Query
from pydantic import BaseModel


@dataclass(frozen=True, slots=True)
class PaginationParams:
    """Shared `skip`/`limit` query params, declared once as a FastAPI dependency."""

    # Bounded because the database's row-offset field is a 64-bit integer;
    # anything larger fails there instead of being reported as bad input.
    skip: int = Query(0, ge=0, le=2**63 - 1, description="Number of records to skip.")
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return.")


class Page[ItemT](BaseModel):
    """A page of results plus the total matching row count (same filters as `items`)."""

    items: list[ItemT]
    total: int
    skip: int
    limit: int

    @classmethod
    def create(cls, items: list[ItemT], total: int, pagination: PaginationParams) -> "Page[ItemT]":
        return cls(items=items, total=total, skip=pagination.skip, limit=pagination.limit)
