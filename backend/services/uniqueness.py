from collections.abc import Awaitable, Callable
from typing import Any

from core.exceptions import ConflictError


async def ensure_unique[ModelT](
    getter: Callable[[], Awaitable[ModelT | None]],
    *,
    id_attr: str,
    current_id: Any,
    message: str,
) -> None:
    """Raise ConflictError if `getter` finds a row belonging to a different
    entity than `current_id`. Pass `current_id=None` at create time — nothing
    can equal None, so any match at all raises, which is exactly "this
    natural key is already taken" with no entity to exclude yet."""
    existing = await getter()
    if existing is not None and getattr(existing, id_attr) != current_id:
        raise ConflictError(message)
