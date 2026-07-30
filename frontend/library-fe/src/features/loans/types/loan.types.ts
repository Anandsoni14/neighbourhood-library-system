import type { CopyCondition, LoanStatus } from '@/types/api';
import type { SortDir } from '@/types/common';

export interface Loan {
  loan_id: string;
  copy_id: string;
  member_id: string;
  issued_by_staff_id: string;
  received_by_staff_id: string | null;
  borrowed_at: string;
  due_at: string;
  returned_at: string | null;
  borrow_condition: CopyCondition;
  return_condition: CopyCondition | null;
  status: LoanStatus;
  calculated_fine: number;
  remarks: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface LoanIssueRequest {
  copy_id: string;
  member_id: string;
  remarks?: string | null;
}

export interface LoanReturnRequest {
  return_condition: CopyCondition;
  remarks?: string | null;
}

/** Mirrors the backend's `LoanSortField` allowlist in `api/loans.py`. */
export const LoanSortField = {
  BORROWED_AT: 'borrowed_at',
  DUE_AT: 'due_at',
  RETURNED_AT: 'returned_at',
  STATUS: 'status',
  CALCULATED_FINE: 'calculated_fine',
} as const;
export type LoanSortField = (typeof LoanSortField)[keyof typeof LoanSortField];

export interface ListLoansParams {
  skip: number;
  limit: number;
  memberId?: string;
  copyId?: string;
  status?: LoanStatus;
  sortBy: LoanSortField;
  sortDir: SortDir;
}

/** `GET /loans/overdue` returns every ACTIVE loan past due, plus these two computed fields. */
export interface OverdueLoan extends Loan {
  days_overdue: number;
  estimated_fine: number;
}

export interface ListOverdueLoansParams {
  skip: number;
  limit: number;
  sortBy: LoanSortField;
  sortDir: SortDir;
}
