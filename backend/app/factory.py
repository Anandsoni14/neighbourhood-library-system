from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from api.book_copies import router as book_copies_router
from api.books import router as books_router
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

    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    register_exception_handlers(app)
    app.include_router(health_router)
    app.include_router(books_router)
    app.include_router(book_copies_router)
    app.include_router(members_router)
    app.include_router(staff_router)
    app.include_router(loans_router)
    app.include_router(transactions_router)

    return app
