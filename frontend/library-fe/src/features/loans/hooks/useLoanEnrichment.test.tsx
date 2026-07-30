import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { bookService } from '@/features/books/services/book.service';
import { copyService } from '@/features/copies/services/copy.service';
import { memberService } from '@/features/members/services/member.service';
import { CopyCondition, CopyStatus, LoanStatus, MembershipStatus } from '@/types/api';

import { useLoanEnrichment } from './useLoanEnrichment';
import type { Loan } from '../types/loan.types';

vi.mock('@/features/books/services/book.service', () => ({
  bookService: { get: vi.fn() },
}));
vi.mock('@/features/copies/services/copy.service', () => ({
  copyService: { get: vi.fn() },
}));
vi.mock('@/features/members/services/member.service', () => ({
  memberService: { get: vi.fn() },
}));

const member = {
  member_id: 'm1',
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone_number: null,
  government_id_type: null,
  government_id_number: null,
  street: null,
  city: null,
  state: null,
  postal_code: null,
  country: null,
  membership_status: MembershipStatus.ACTIVE,
  remarks: null,
};

const copy = {
  copy_id: 'c1',
  book_id: 'b1',
  barcode: 'BC-001',
  shelf_code: null,
  condition: CopyCondition.GOOD,
  status: CopyStatus.BORROWED,
  max_borrow_days: 14,
  late_fee_per_day: 5,
};

const book = {
  book_id: 'b1',
  title: 'Clean Code',
  author: 'Robert C. Martin',
  publisher: null,
  isbn: null,
  category_id: null,
  category: null,
  description: null,
  published_year: 2008,
  is_archived: false,
};

function loanFor(id: string, memberId: string, copyId: string): Loan {
  return {
    loan_id: id,
    copy_id: copyId,
    member_id: memberId,
    issued_by_staff_id: 's1',
    received_by_staff_id: null,
    borrowed_at: '2026-07-01T00:00:00Z',
    due_at: '2026-07-15T00:00:00Z',
    returned_at: null,
    borrow_condition: CopyCondition.GOOD,
    return_condition: null,
    status: LoanStatus.ACTIVE,
    calculated_fine: 0,
    remarks: null,
    created_at: '2026-07-01T00:00:00Z',
    closed_at: null,
  };
}

describe('useLoanEnrichment', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('resolves members, copies, and books for the given loans', async () => {
    vi.mocked(memberService.get).mockResolvedValue(member);
    vi.mocked(copyService.get).mockResolvedValue(copy);
    vi.mocked(bookService.get).mockResolvedValue(book);

    const loans = [loanFor('l1', 'm1', 'c1')];
    const { result } = renderHook(() => useLoanEnrichment(loans));

    await waitFor(() => {
      expect(result.current.members.m1).toEqual(member);
    });
    expect(result.current.copies.c1).toEqual(copy);
    expect(result.current.books.b1).toEqual(book);
  });

  it('dedupes repeated ids across loans into a single lookup', async () => {
    vi.mocked(memberService.get).mockResolvedValue(member);
    vi.mocked(copyService.get).mockResolvedValue(copy);
    vi.mocked(bookService.get).mockResolvedValue(book);

    const loans = [loanFor('l1', 'm1', 'c1'), loanFor('l2', 'm1', 'c1')];
    const { result } = renderHook(() => useLoanEnrichment(loans));

    await waitFor(() => {
      expect(result.current.members.m1).toEqual(member);
    });
    expect(memberService.get).toHaveBeenCalledTimes(1);
    expect(copyService.get).toHaveBeenCalledTimes(1);
  });

  it('swallows a failed lookup without blanking the others', async () => {
    vi.mocked(memberService.get).mockRejectedValue(new Error('not found'));
    vi.mocked(copyService.get).mockResolvedValue(copy);
    vi.mocked(bookService.get).mockResolvedValue(book);

    const loans = [loanFor('l1', 'm1', 'c1')];
    const { result } = renderHook(() => useLoanEnrichment(loans));

    await waitFor(() => {
      expect(result.current.copies.c1).toEqual(copy);
    });
    expect(result.current.members.m1).toBeUndefined();
  });
});
