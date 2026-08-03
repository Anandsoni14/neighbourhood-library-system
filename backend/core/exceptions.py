class DomainException(Exception):
    """Base for all business/domain errors. Services raise these, never HTTPException."""

    message: str = "A domain error occurred."

    def __init__(self, message: str | None = None) -> None:
        self.message = message or self.message
        super().__init__(self.message)


class ValidationError(DomainException):
    """The request is well-formed but invalid — for example, a required
    combination of query parameters is missing. Use this instead of raising
    HTTPException from a route, so the response is built in one place."""

    message: str = "The request is invalid."


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


class TransactionNotFoundException(NotFoundError):
    """A requested transaction does not exist."""

    message: str = "The requested transaction was not found."


class TransactionNotPendingException(ConflictError):
    """An attempt was made to settle (pay/fail/waive) a non-PENDING transaction."""

    message: str = "This transaction has already been settled."


class LoanMemberMismatchException(ConflictError):
    """The given loan does not belong to the given member."""

    message: str = "This loan does not belong to the specified member."


class AuthenticationException(DomainException):
    """Credentials or bearer token are missing, invalid, or expired."""

    message: str = "Authentication failed."


class AuthorizationException(DomainException):
    """The authenticated staff member's role does not permit this action."""

    message: str = "You do not have permission to perform this action."
