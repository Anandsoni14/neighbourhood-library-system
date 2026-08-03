from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.auth import router as auth_router
from api.book_copies import router as book_copies_router
from api.books import router as books_router
from api.categories import router as categories_router
from api.health import router as health_router
from api.loans import router as loans_router
from api.members import router as members_router
from api.staff import router as staff_router
from api.transactions import router as transactions_router
from app.exception_handlers import register_exception_handlers
from core.config import get_settings
from core.logging import configure_logging
from db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    await engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings)

    app = FastAPI(
        title=settings.app_name,
        description=(
            "Library Management System API.\n\n"
            "**Using /docs:** the \"Authorize\" button submits OAuth2 form fields "
            "(username/password) to the login URL, but `POST /api/v1/auth/login` "
            "expects a JSON body instead, so Authorize will not work here. Call "
            "`/api/v1/auth/login` directly via its own \"Try it out\", copy the "
            "returned `access_token`, and send it as an `Authorization: Bearer "
            "<token>` header from a REST client (curl, httpie, Postman) — Swagger "
            "UI has no field for attaching a manually-supplied header to later "
            "requests."
        ),
        lifespan=lifespan,
    )
    # The browser SPA is served from a different origin than the API, so the
    # allowed origins are configuration rather than a hardcoded localhost list.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(books_router)
    app.include_router(categories_router)
    app.include_router(book_copies_router)
    app.include_router(members_router)
    app.include_router(staff_router)
    app.include_router(loans_router)
    app.include_router(transactions_router)

    return app
