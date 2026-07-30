import type { StaffRole, StaffStatus } from '@/types/api';

/** Matches backend StaffResponse exactly — never includes password_hash. */
export interface StaffResponse {
  staff_id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  role: StaffRole;
  status: StaffStatus;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  staff: StaffResponse;
}
