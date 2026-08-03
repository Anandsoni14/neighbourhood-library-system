from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

# StringConstraints rather than a field_validator so the pattern shows up in
# the generated OpenAPI schema. Use as `PhoneNumber | None` so it only fires
# on the `str` branch — omitted/None stays valid.

PhoneNumber = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\d{10}$")]
"""Exactly 10 digits; empty string is rejected (422), not coerced to None."""

PostalCode = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\d{1,20}$")]
"""Digits only. Rejects alphanumeric postal codes (e.g. UK) — known limitation."""

_BCRYPT_MAX_BYTES = 72


def _within_bcrypt_limit(value: str) -> str:
    """bcrypt refuses secrets over 72 bytes when hashing *and* when checking,
    so validate here to get a 422 rather than a crash inside core.security.
    Counted in bytes, not characters: 72 accented characters are 144 bytes.
    """
    if len(value.encode("utf-8")) > _BCRYPT_MAX_BYTES:
        raise ValueError(f"Password must be at most {_BCRYPT_MAX_BYTES} bytes.")
    return value


LoginPassword = Annotated[str, AfterValidator(_within_bcrypt_limit)]
"""Login only needs the ceiling; applying the minimum here would lock out an
account whose password predates that rule."""

Password = Annotated[str, Field(min_length=8), AfterValidator(_within_bcrypt_limit)]
"""A password being set: at least 8 characters, and within bcrypt's limit."""


class RequestModel(BaseModel):
    """Base for request bodies. Trims text so a whitespace-only value fails the
    same `min_length` check an empty one does, instead of being stored blank."""

    model_config = ConfigDict(str_strip_whitespace=True)
