import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DataError, IntegrityError

from core.exceptions import (
    AuthenticationException,
    AuthorizationException,
    ConflictError,
    DomainException,
    NotFoundError,
    ValidationError,
)

logger = logging.getLogger(__name__)

_STATUS_BY_EXCEPTION: tuple[tuple[type[DomainException], int], ...] = (
    (AuthenticationException, 401),
    (AuthorizationException, 403),
    (NotFoundError, 404),
    (ConflictError, 409),
    (ValidationError, 422),
)


def _status_code_for(exc: DomainException) -> int:
    for exception_type, status_code in _STATUS_BY_EXCEPTION:
        if isinstance(exc, exception_type):
            return status_code
    return 400


def register_exception_handlers(app: FastAPI) -> None:
    """Centrally maps domain exceptions to HTTP responses.

    Services raise DomainException subclasses and never HTTPException;
    this is the one place that translates a business failure into a
    status code and response body.
    """

    @app.exception_handler(DomainException)
    async def handle_domain_exception(request: Request, exc: DomainException) -> JSONResponse:
        status_code = _status_code_for(exc)
        logger.warning(
            "domain_exception",
            extra={"path": request.url.path, "exception_type": type(exc).__name__},
        )
        return JSONResponse(status_code=status_code, content={"detail": exc.message})

    # Registered on the concrete SQLAlchemy types so they take priority over
    # the catch-all below. A rule the request layer didn't check still reaches
    # the database; these keep that a 4xx instead of a 500.
    @app.exception_handler(IntegrityError)
    async def handle_integrity_error(request: Request, exc: IntegrityError) -> JSONResponse:
        logger.warning(
            "integrity_error",
            extra={"path": request.url.path, "db_error": str(exc.orig)},
        )
        return JSONResponse(status_code=409, content={"detail": ConflictError.message})

    @app.exception_handler(DataError)
    async def handle_data_error(request: Request, exc: DataError) -> JSONResponse:
        logger.warning(
            "data_error",
            extra={"path": request.url.path, "db_error": str(exc.orig)},
        )
        return JSONResponse(
            status_code=422, content={"detail": "One or more values are invalid."}
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_exception(request: Request, exc: Exception) -> JSONResponse:
        logger.error(
            "unhandled_exception",
            extra={"path": request.url.path},
            exc_info=exc,
        )
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})
