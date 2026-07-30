from typing import Annotated

from pydantic import StringConstraints

# Expressed as StringConstraints rather than a field_validator: a `pattern` is
# emitted into the generated OpenAPI/JSON Schema, so both the frontend and
# /docs get the rule for free, whereas a validator function's body is opaque
# to schema generation. Applied as `PhoneNumber | None` at each call site so
# the constraint only fires on the `str` branch — an omitted/None value stays
# valid, matching "digits only when provided" rather than "always required".

PhoneNumber = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\d{10}$")]
"""Exactly 10 digits, no punctuation. An empty string is rejected (422), not
coerced to None — a form that wants to clear the field must send null."""

PostalCode = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\d{1,20}$")]
"""Digits only, up to the column width. Note: this rejects alphanumeric postal
codes (e.g. UK's "SW1A 1AA") — a known locale limitation of the stated
"numbers only" requirement, not an oversight."""
