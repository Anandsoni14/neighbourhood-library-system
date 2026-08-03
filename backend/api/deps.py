from collections.abc import Callable, Coroutine
from typing import Any
from uuid import UUID

import jwt
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import AuthenticationException, AuthorizationException
from core.security import decode_access_token
from db.session import get_db
from models import Staff
from models.enums import StaffRole, StaffStatus
from repositories.staff import StaffRepository
from services.auth import AuthService
from services.book import BookService
from services.book_copy import BookCopyService
from services.category import CategoryService
from services.loan import LoanService
from services.member import MemberService
from services.staff import StaffService
from services.transaction import TransactionService

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_staff(
    token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)
) -> Staff:
    """Resolve the bearer token to the requesting staff member.

    Re-checks status == ACTIVE on every request so a deactivation takes
    effect immediately, even for tokens issued before it.
    """
    try:
        payload = decode_access_token(token)
        staff_id = UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as e:
        raise AuthenticationException("Invalid or expired token") from e

    staff = await StaffRepository(db).get_by_id(staff_id)
    if not staff or staff.status != StaffStatus.ACTIVE:
        raise AuthenticationException("Invalid or expired token")
    return staff


def require_role(
    *roles: StaffRole,
) -> Callable[[Staff], Coroutine[Any, Any, Staff]]:
    """Dependency factory: only staff whose role is in `roles` may proceed."""

    async def _dependency(staff: Staff = Depends(get_current_staff)) -> Staff:
        if staff.role not in roles:
            raise AuthorizationException(
                f"This action requires one of the following roles: {', '.join(roles)}"
            )
        return staff

    return _dependency


# Service providers. Each wraps the service's own `XService(session)` constructor
# so routes declare what they need instead of building it, and so the session
# stays a single request-scoped dependency (test overrides of get_db flow
# through these unchanged).


def get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    return AuthService(db)


def get_book_service(db: AsyncSession = Depends(get_db)) -> BookService:
    return BookService(db)


def get_book_copy_service(db: AsyncSession = Depends(get_db)) -> BookCopyService:
    return BookCopyService(db)


def get_category_service(db: AsyncSession = Depends(get_db)) -> CategoryService:
    return CategoryService(db)


def get_loan_service(db: AsyncSession = Depends(get_db)) -> LoanService:
    return LoanService(db)


def get_member_service(db: AsyncSession = Depends(get_db)) -> MemberService:
    return MemberService(db)


def get_staff_service(db: AsyncSession = Depends(get_db)) -> StaffService:
    return StaffService(db)


def get_transaction_service(db: AsyncSession = Depends(get_db)) -> TransactionService:
    return TransactionService(db)
