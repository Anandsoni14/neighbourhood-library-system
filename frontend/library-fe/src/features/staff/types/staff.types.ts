import type { StaffRole, StaffStatus } from '@/types/api';
import type { SortDir } from '@/types/common';

export interface Staff {
  staff_id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  role: StaffRole;
  status: StaffStatus;
}

export interface StaffCreateRequest {
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  phone_number?: string | null;
  role?: StaffRole;
}

export interface StaffUpdateRequest {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string | null;
  role?: StaffRole;
  status?: StaffStatus;
}

/** Mirrors the backend's `StaffSortField` allowlist in `api/staff.py`. */
export const StaffSortField = {
  EMPLOYEE_CODE: 'employee_code',
  FIRST_NAME: 'first_name',
  LAST_NAME: 'last_name',
  EMAIL: 'email',
  ROLE: 'role',
  STATUS: 'status',
} as const;
export type StaffSortField = (typeof StaffSortField)[keyof typeof StaffSortField];

export interface ListStaffParams {
  skip: number;
  limit: number;
  name?: string;
  role?: StaffRole;
  status?: StaffStatus;
  sortBy: StaffSortField;
  sortDir: SortDir;
}
