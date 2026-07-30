import type { MembershipStatus } from '@/types/api';
import type { SortDir } from '@/types/common';

export interface Member {
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  government_id_type: string | null;
  government_id_number: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  membership_status: MembershipStatus;
  remarks: string | null;
}

/**
 * Shared by create and update. `membership_status` is only meaningful (and
 * only sent) on update — the backend's create endpoint doesn't accept it and
 * always defaults new members to ACTIVE.
 */
export interface MemberRequest {
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string | null;
  government_id_type?: string | null;
  government_id_number?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  membership_status?: MembershipStatus;
  remarks?: string | null;
}

/** Mirrors the backend's `MemberSortField` allowlist in `api/members.py`. */
export const MemberSortField = {
  FIRST_NAME: 'first_name',
  LAST_NAME: 'last_name',
  EMAIL: 'email',
  MEMBERSHIP_STATUS: 'membership_status',
  CREATED_AT: 'created_at',
} as const;
export type MemberSortField = (typeof MemberSortField)[keyof typeof MemberSortField];

export interface ListMembersParams {
  skip: number;
  limit: number;
  name?: string;
  email?: string;
  status?: MembershipStatus;
  sortBy: MemberSortField;
  sortDir: SortDir;
}
