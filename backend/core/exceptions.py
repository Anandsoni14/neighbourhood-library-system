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
