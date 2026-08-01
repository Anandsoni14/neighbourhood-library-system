// Transcribed from backend/alembic/versions/996e4dceab29_initial_schema.py.
// Plain `as const` objects rather than TS `enum` so values match the API's
// strings exactly, with no isolatedModules const-enum restriction.

export const StaffRole = {
  ADMIN: 'ADMIN',
  LIBRARIAN: 'LIBRARIAN',
} as const;
export type StaffRole = (typeof StaffRole)[keyof typeof StaffRole];

export const StaffStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;
export type StaffStatus = (typeof StaffStatus)[keyof typeof StaffStatus];

export const MembershipStatus = {
  ACTIVE: 'ACTIVE',
  BLOCKED: 'BLOCKED',
  INACTIVE: 'INACTIVE',
} as const;
export type MembershipStatus = (typeof MembershipStatus)[keyof typeof MembershipStatus];

export const CopyCondition = {
  NEW: 'NEW',
  GOOD: 'GOOD',
  FAIR: 'FAIR',
  DAMAGED: 'DAMAGED',
} as const;
export type CopyCondition = (typeof CopyCondition)[keyof typeof CopyCondition];

export const CopyStatus = {
  AVAILABLE: 'AVAILABLE',
  BORROWED: 'BORROWED',
  LOST: 'LOST',
  MAINTENANCE: 'MAINTENANCE',
} as const;
export type CopyStatus = (typeof CopyStatus)[keyof typeof CopyStatus];

export const LoanStatus = {
  ACTIVE: 'ACTIVE',
  RETURNED: 'RETURNED',
} as const;
export type LoanStatus = (typeof LoanStatus)[keyof typeof LoanStatus];

export const TransactionType = {
  LATE_FEE: 'LATE_FEE',
  DAMAGE_FEE: 'DAMAGE_FEE',
  WAIVER: 'WAIVER',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const PaymentMode = {
  CASH: 'CASH',
  CARD: 'CARD',
  UPI: 'UPI',
  ONLINE: 'ONLINE',
} as const;
export type PaymentMode = (typeof PaymentMode)[keyof typeof PaymentMode];

export const TransactionStatus = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  WAIVED: 'WAIVED',
} as const;
export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

/** FastAPI's own 422 validation errors: `detail` is a list of these. */
export interface ValidationIssue {
  loc: (string | number)[];
  msg: string;
  type: string;
}

/** Domain errors return `{detail: string}`; 422 validation errors return
 * `{detail: ValidationIssue[]}` — handlers must accept both shapes. */
export interface ApiErrorBody {
  detail: string | ValidationIssue[];
}

/** The `{items, total, skip, limit}` envelope every list endpoint returns. */
export interface Page<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}
