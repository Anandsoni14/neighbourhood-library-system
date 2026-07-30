from dataclasses import dataclass

from fastapi import Query
from pydantic import BaseModel


@dataclass(frozen=True, slots=True)
class PaginationParams:
    """Shared `skip`/`limit` query parameters for every list endpoint.

    Used as a FastAPI dependency so the bounds are declared once instead of
    being copy-pasted into each route.
    """

    skip: int = Query(0, ge=0, description="Number of records to skip.")
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return.")


class Page[ItemT](BaseModel):
    """A page of results plus the total number of records matching the filters.

    `total` counts every matching row, not just the ones on this page, so a
    client can render an accurate page count. It reflects the same filters as
    `items` — a filtered request reports the filtered total.
    """

    items: list[ItemT]
    total: int
    skip: int
    limit: int

    @classmethod
    def create(cls, items: list[ItemT], total: int, pagination: PaginationParams) -> "Page[ItemT]":
        return cls(items=items, total=total, skip=pagination.skip, limit=pagination.limit)
