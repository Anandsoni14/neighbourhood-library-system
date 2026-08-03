"""Reusable OpenAPI response-documentation fragments.

Domain exceptions are mapped to HTTP status in exactly one place
(app/exception_handlers.py), so FastAPI has no way to infer these from a
route's return type — these fragments fill that gap in the generated docs.
Merge only the codes a given endpoint's service can actually raise, e.g.
`responses={**NOT_FOUND, **CONFLICT}`.
"""

from typing import Any


def _detail(example: str) -> dict[str, Any]:
    return {"content": {"application/json": {"example": {"detail": example}}}}


UNAUTHORIZED: dict[int | str, dict[str, Any]] = {
    401: {
        "description": "Missing, invalid, or expired bearer token.",
        **_detail("Invalid or expired token"),
    }
}
FORBIDDEN: dict[int | str, dict[str, Any]] = {
    403: {
        "description": "The authenticated staff member's role does not permit this action.",
        **_detail("This action requires one of the following roles: ADMIN"),
    }
}
NOT_FOUND: dict[int | str, dict[str, Any]] = {
    404: {
        "description": "The requested resource does not exist.",
        **_detail("The requested resource was not found."),
    }
}
CONFLICT: dict[int | str, dict[str, Any]] = {
    409: {
        "description": "The request conflicts with the current state of the resource.",
        **_detail("The request conflicts with the current state of the resource."),
    }
}
VALIDATION_ERROR: dict[int | str, dict[str, Any]] = {
    422: {
        "description": "The request is well-formed but invalid.",
        **_detail("Provide at least one search parameter (title or isbn)"),
    }
}
