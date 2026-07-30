import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setupStore } from '@/redux/store';
import { httpClient } from '@/services/httpClient';
import { CopyCondition, LoanStatus } from '@/types/api';

import { useDashboard } from './useDashboard';

vi.mock('@/services/httpClient', () => ({
  httpClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  attachAuthInterceptors: vi.fn(),
}));

const overdueLoan = {
  loan_id: '1',
  copy_id: 'c1',
  member_id: 'm1',
  issued_by_staff_id: 's1',
  received_by_staff_id: null,
  borrowed_at: '2026-07-01T00:00:00Z',
  due_at: '2026-07-10T00:00:00Z',
  returned_at: null,
  borrow_condition: CopyCondition.GOOD,
  return_condition: null,
  status: LoanStatus.ACTIVE,
  calculated_fine: 0,
  remarks: null,
  created_at: '2026-07-01T00:00:00Z',
  closed_at: null,
  days_overdue: 5,
  estimated_fine: 25,
};

function wrapperFor(store: ReturnType<typeof setupStore>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe('useDashboard', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches counts and overdue loans', async () => {
    vi.mocked(httpClient.get).mockImplementation((url: string) => {
      if (url === '/loans/overdue') {
        return Promise.resolve({ data: { items: [overdueLoan], total: 1, skip: 0, limit: 25 } });
      }
      return Promise.resolve({ data: { items: [], total: 3, skip: 0, limit: 1 } });
    });

    const store = setupStore();
    const { result } = renderHook(() => useDashboard(), { wrapper: wrapperFor(store) });

    await result.current.fetchDashboard({
      skip: 0,
      limit: 25,
      sortBy: 'due_at',
      sortDir: 'asc',
    });

    await waitFor(() => {
      expect(result.current.counts).toEqual({
        books: 3,
        members: 3,
        activeLoans: 3,
        overdueLoans: 1,
      });
    });
    expect(result.current.overdueItems).toEqual([overdueLoan]);
    expect(result.current.overdueTotal).toBe(1);
    expect(result.current.isLoading).toBe(false);
  });
});
