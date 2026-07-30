import type { CopyCondition, CopyStatus } from '@/types/api';
import type { SortDir } from '@/types/common';

export interface BookCopy {
  copy_id: string;
  book_id: string;
  barcode: string;
  shelf_code: string | null;
  condition: CopyCondition;
  status: CopyStatus;
  max_borrow_days: number;
  late_fee_per_day: number;
}

export interface BookCopyRequest {
  book_id: string;
  barcode: string;
  shelf_code?: string | null;
  condition?: CopyCondition;
  max_borrow_days?: number;
  late_fee_per_day?: number;
}

export interface BookCopyUpdateRequest {
  barcode?: string;
  shelf_code?: string | null;
  condition?: CopyCondition;
  status?: CopyStatus;
  max_borrow_days?: number;
  late_fee_per_day?: number;
}

/** Mirrors the backend's `BookCopySortField` allowlist in `api/book_copies.py`. */
export const BookCopySortField = {
  BARCODE: 'barcode',
  SHELF_CODE: 'shelf_code',
  CONDITION: 'condition',
  STATUS: 'status',
  CREATED_AT: 'created_at',
} as const;
export type BookCopySortField = (typeof BookCopySortField)[keyof typeof BookCopySortField];

export interface ListCopiesParams {
  skip: number;
  limit: number;
  bookId?: string;
  status?: CopyStatus;
  condition?: CopyCondition;
  barcode?: string;
  sortBy: BookCopySortField;
  sortDir: SortDir;
}
