import { describe, expect, it } from 'vitest';

import {
  CopyCondition,
  CopyStatus,
  LoanStatus,
  MembershipStatus,
  PaymentMode,
  StaffRole,
  StaffStatus,
  TransactionStatus,
  TransactionType,
} from './api';

// Pinned against backend/alembic/versions/996e4dceab29_initial_schema.py so a
// typo in a status string surfaces here instead of as a silent filter bug.
describe('backend enum values', () => {
  it('StaffRole matches staff_role', () => {
    expect(Object.values(StaffRole).sort()).toEqual(['ADMIN', 'LIBRARIAN']);
  });

  it('StaffStatus matches staff_status', () => {
    expect(Object.values(StaffStatus).sort()).toEqual(['ACTIVE', 'INACTIVE']);
  });

  it('MembershipStatus matches membership_status', () => {
    expect(Object.values(MembershipStatus).sort()).toEqual(['ACTIVE', 'BLOCKED', 'INACTIVE']);
  });

  it('CopyCondition matches copy_condition', () => {
    expect(Object.values(CopyCondition).sort()).toEqual(['DAMAGED', 'FAIR', 'GOOD', 'NEW']);
  });

  it('CopyStatus matches copy_status', () => {
    expect(Object.values(CopyStatus).sort()).toEqual([
      'AVAILABLE',
      'BORROWED',
      'LOST',
      'MAINTENANCE',
    ]);
  });

  it('LoanStatus matches loan_status', () => {
    expect(Object.values(LoanStatus).sort()).toEqual(['ACTIVE', 'RETURNED']);
  });

  it('TransactionType matches transaction_type', () => {
    expect(Object.values(TransactionType).sort()).toEqual(['DAMAGE_FEE', 'LATE_FEE', 'WAIVER']);
  });

  it('PaymentMode matches payment_mode', () => {
    expect(Object.values(PaymentMode).sort()).toEqual(['CARD', 'CASH', 'ONLINE', 'UPI']);
  });

  it('TransactionStatus matches transaction_status', () => {
    expect(Object.values(TransactionStatus).sort()).toEqual([
      'FAILED',
      'PENDING',
      'SUCCESS',
      'WAIVED',
    ]);
  });
});
