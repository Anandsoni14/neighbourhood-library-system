from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db

router = APIRouter()


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    # Intentional, narrow exception to "the API layer never touches the DB":
    # this is an infrastructure liveness probe, not business logic, so it
    # doesn't go through a service/repository.
    await db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}
