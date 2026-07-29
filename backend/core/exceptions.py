class DomainException(Exception):
    """Base for all business/domain errors. Services raise these, never HTTPException."""

    message: str = "A domain error occurred."

    def __init__(self, message: str | None = None) -> None:
        self.message = message or self.message
        super().__init__(self.message)


class NotFoundError(DomainException):
    """A requested entity does not exist."""

    message: str = "The requested resource was not found."


class ConflictError(DomainException):
    """The requested operation conflicts with the current state of the resource."""

    message: str = "The request conflicts with the current state of the resource."


class MemberNotEligibleException(ConflictError):
    """A member's status prevents them from borrowing (not ACTIVE)."""

    message: str = "Member is not eligible to borrow at this time."


class BookUnavailableException(ConflictError):
    """The requested copy is not available to be borrowed."""

    message: str = "This book copy is not available for borrowing."


class LoanNotFoundException(NotFoundError):
    """A requested loan does not exist."""

    message: str = "The requested loan was not found."


class LoanAlreadyReturnedException(ConflictError):
    """An attempt was made to return a loan that isn't currently active."""

    message: str = "This loan has already been returned."
