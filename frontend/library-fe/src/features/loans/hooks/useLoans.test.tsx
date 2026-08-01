import { renderHook, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setupStore } from '@/redux/store';
import { httpClient } from '@/services/httpClient';
import type * as httpClientModule from '@/services/httpClient';
import { CopyCondition, LoanStatus } from '@/types/api';

import { useLoans } from './useLoans';
import { LoanSortField } from '../types/loan.types';

vi.mock('@/services/httpClient', async (importOriginal) => {
  const actual = await importOriginal<typeof httpClientModule>();
  return {
    ...actual,
    httpClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
    attachAuthInterceptors: vi.fn(),
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

function wrapperFor(store: ReturnType<typeof setupStore>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe('useLoans', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches loans and exposes the resulting list and total', async () => {
    vi.mocked(httpClient.get).mockResolvedValue({ items: [loan], total: 1 });

    const store = setupStore();
    const { result } = renderHook(() => useLoans(), { wrapper: wrapperFor(store) });

    await result.current.fetchLoans({
      skip: 0,
      limit: 25,
      sortBy: LoanSortField.BORROWED_AT,
      sortDir: 'desc',
    });

    await waitFor(() => {
      expect(result.current.loans).toEqual([loan]);
    });
    expect(result.current.total).toBe(1);
  });

  it('issues a loan and reports the mutation as no longer in flight', async () => {
    vi.mocked(httpClient.post).mockResolvedValue(loan);

    const store = setupStore();
    const { result } = renderHook(() => useLoans(), { wrapper: wrapperFor(store) });

    await result.current.issueLoan({ copy_id: 'c1', member_id: 'm1' });

    await waitFor(() => {
      expect(result.current.isMutating).toBe(false);
    });
    expect(result.current.mutationError).toBeNull();
  });

  it('surfaces a mutation error and clears it on demand', async () => {
    const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST');
    error.response = {
      status: 409,
      statusText: 'Conflict',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { detail: 'Copy is not available' },
    };
    vi.mocked(httpClient.post).mockRejectedValue(error);

    const store = setupStore();
    const { result } = renderHook(() => useLoans(), { wrapper: wrapperFor(store) });

    await result.current.issueLoan({ copy_id: 'c1', member_id: 'm1' });

    await waitFor(() => {
      expect(result.current.mutationError).toBe('Copy is not available');
    });

    result.current.clearMutationError();

    await waitFor(() => {
      expect(result.current.mutationError).toBeNull();
    });
  });
});
