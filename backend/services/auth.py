import logging
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import AuthenticationException
from core.security import create_access_token, verify_password
from models import Staff
from models.enums import StaffStatus
from repositories.staff import StaffRepository

logger = logging.getLogger(__name__)


class AuthService:
    """Staff login and token issuance."""

    def __init__(self, session: AsyncSession) -> None:
        self.repository = StaffRepository(session)
        self._session = session

    async def login(self, email: str, password: str) -> tuple[Staff, str]:
        """Verify credentials and issue a bearer token.

        One generic error for unknown email, wrong password, and inactive
        account alike — anything more specific would leak which case it was.
        """
        staff = await self.repository.get_by_email(email)
        if (
            not staff
            or not verify_password(password, staff.password_hash)
            or staff.status != StaffStatus.ACTIVE
        ):
            raise AuthenticationException("Invalid email or password")

        staff.last_login_at = datetime.now(UTC)
        self._session.add(staff)
        await self._session.flush()

        token = create_access_token(staff.staff_id, staff.role)
        logger.info("staff_logged_in", extra={"staff_id": str(staff.staff_id)})
        return staff, token
