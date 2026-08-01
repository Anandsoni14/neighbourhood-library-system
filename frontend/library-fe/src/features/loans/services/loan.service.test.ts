import { describe, expect, it, vi } from 'vitest';

import { httpClient } from '@/services/httpClient';
import type * as httpClientModule from '@/services/httpClient';
import { CopyCondition, LoanStatus } from '@/types/api';
import { SortDir } from '@/types/common';

import { loanService } from './loan.service';
import { LoanSortField } from '../types/loan.types';

vi.mock('@/services/httpClient', async (importOriginal) => {
  const actual = await importOriginal<typeof httpClientModule>();
  return {
    ...actual,
    httpClient: {
      get: vi.fn(),
      post: vi.fn(),
    },
  };
});

const loan = {
  loan_id: '1',
  copy_id: 'c1',
  member_id: 'm1',
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

describe('loanService', () => {
  it('lists loans, forwarding filters, sort, and pagination', async () => {
    vi.mocked(httpClient.get).mockResolvedValue({ items: [loan], total: 1, skip: 0, limit: 25 });

    const result = await loanService.list({
      skip: 0,
      limit: 25,
      memberId: 'm1',
      sortBy: LoanSortField.BORROWED_AT,
      sortDir: SortDir.DESC,
    });

    expect(httpClient.get).toHaveBeenCalledWith('/loans', {
      params: {
        skip: 0,
        limit: 25,
        member_id: 'm1',
        copy_id: undefined,
        status: undefined,
        sort_by: 'borrowed_at',
        sort_dir: 'desc',
      },
    });
    expect(result).toEqual({ items: [loan], total: 1, skip: 0, limit: 25 });
  });

  it('fetches a single loan by id', async () => {
    vi.mocked(httpClient.get).mockResolvedValue(loan);

    const result = await loanService.get('1');

    expect(httpClient.get).toHaveBeenCalledWith('/loans/1');
    expect(result).toEqual(loan);
  });

  it('lists overdue loans, forwarding sort and pagination', async () => {
    const overdueLoan = { ...loan, days_overdue: 3, estimated_fine: 15 };
    vi.mocked(httpClient.get).mockResolvedValue({
      items: [overdueLoan],
      total: 1,
      skip: 0,
      limit: 25,
    });

    const result = await loanService.overdue({
      skip: 0,
      limit: 25,
      sortBy: LoanSortField.DUE_AT,
      sortDir: SortDir.ASC,
    });

    expect(httpClient.get).toHaveBeenCalledWith('/loans/overdue', {
      params: { skip: 0, limit: 25, sort_by: 'due_at', sort_dir: 'asc' },
    });
    expect(result).toEqual({ items: [overdueLoan], total: 1, skip: 0, limit: 25 });
  });

  it('issues a loan', async () => {
    vi.mocked(httpClient.post).mockResolvedValue(loan);

    const payload = { copy_id: 'c1', member_id: 'm1' };
    const result = await loanService.issue(payload);

    expect(httpClient.post).toHaveBeenCalledWith('/loans', payload);
    expect(result).toEqual(loan);
  });

  it('returns a loan', async () => {
    const returned = { ...loan, status: LoanStatus.RETURNED };
    vi.mocked(httpClient.post).mockResolvedValue(returned);

    const payload = { return_condition: CopyCondition.GOOD };
    const result = await loanService.returnLoan('1', payload);

    expect(httpClient.post).toHaveBeenCalledWith('/loans/1/return', payload);
    expect(result).toEqual(returned);
  });
});
