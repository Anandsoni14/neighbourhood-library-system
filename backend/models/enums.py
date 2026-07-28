from enum import StrEnum


class StaffRole(StrEnum):
    ADMIN = "ADMIN"
    LIBRARIAN = "LIBRARIAN"


class StaffStatus(StrEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class MembershipStatus(StrEnum):
    ACTIVE = "ACTIVE"
    BLOCKED = "BLOCKED"
    INACTIVE = "INACTIVE"


class CopyCondition(StrEnum):
    NEW = "NEW"
    GOOD = "GOOD"
    FAIR = "FAIR"
    DAMAGED = "DAMAGED"


class CopyStatus(StrEnum):
    AVAILABLE = "AVAILABLE"
    BORROWED = "BORROWED"
    LOST = "LOST"
    MAINTENANCE = "MAINTENANCE"


class LoanStatus(StrEnum):
    ACTIVE = "ACTIVE"
    RETURNED = "RETURNED"


class TransactionType(StrEnum):
    LATE_FEE = "LATE_FEE"
    DAMAGE_FEE = "DAMAGE_FEE"
    WAIVER = "WAIVER"


class PaymentMode(StrEnum):
    CASH = "CASH"
    CARD = "CARD"
    UPI = "UPI"
    ONLINE = "ONLINE"


class TransactionStatus(StrEnum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    WAIVED = "WAIVED"
