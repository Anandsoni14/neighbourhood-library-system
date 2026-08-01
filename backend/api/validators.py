from typing import Annotated

from pydantic import StringConstraints

# StringConstraints rather than a field_validator so the pattern shows up in
# the generated OpenAPI schema. Use as `PhoneNumber | None` so it only fires
# on the `str` branch — omitted/None stays valid.

PhoneNumber = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\d{10}$")]
"""Exactly 10 digits; empty string is rejected (422), not coerced to None."""

PostalCode = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\d{1,20}$")]
"""Digits only. Rejects alphanumeric postal codes (e.g. UK) — known limitation."""
