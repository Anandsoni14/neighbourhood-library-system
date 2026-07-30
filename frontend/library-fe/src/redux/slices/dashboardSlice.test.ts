import { describe, expect, it } from 'vitest';

import { CopyCondition, LoanStatus } from '@/types/api';
import { RequestStatus } from '@/types/common';

import dashboardReducer, { fetchDashboard } from './dashboardSlice';

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

const initialState = {
  counts: null,
  overdueItems: [],
  overdueTotal: 0,
  status: RequestStatus.IDLE,
  error: null,
  latestRequestId: 'requestId',
};

describe('dashboardSlice', () => {
  it('fetchDashboard.fulfilled stores counts and overdue loans', () => {
    const state = dashboardReducer(
      initialState,
      fetchDashboard.fulfilled(
        {
          counts: { books: 10, members: 5, activeLoans: 2, overdueLoans: 1 },
          overdueItems: [overdueLoan],
          overdueTotal: 1,
        },
        'requestId',
        { skip: 0, limit: 25, sortBy: 'due_at', sortDir: 'asc' },
      ),
    );

    expect(state.counts).toEqual({ books: 10, members: 5, activeLoans: 2, overdueLoans: 1 });
    expect(state.overdueItems).toEqual([overdueLoan]);
    expect(state.overdueTotal).toBe(1);
    expect(state.status).toBe(RequestStatus.SUCCEEDED);
  });

  it('fetchDashboard.rejected records the error message', () => {
    const state = dashboardReducer(
      { ...initialState, status: RequestStatus.LOADING },
      fetchDashboard.rejected(
        new Error('rejected'),
        'requestId',
        { skip: 0, limit: 25, sortBy: 'due_at', sortDir: 'asc' },
        'Unable to load the dashboard.',
      ),
    );

    expect(state.status).toBe(RequestStatus.FAILED);
    expect(state.error).toBe('Unable to load the dashboard.');
  });

  it('ignores a stale fetchDashboard.fulfilled response from a superseded request', () => {
    let state = dashboardReducer(
      initialState,
      fetchDashboard.pending('old-request', { skip: 0, limit: 25, sortBy: 'due_at', sortDir: 'asc' }),
    );
    state = dashboardReducer(
      state,
      fetchDashboard.pending('new-request', { skip: 0, limit: 25, sortBy: 'due_at', sortDir: 'asc' }),
    );

    state = dashboardReducer(
      state,
      fetchDashboard.fulfilled(
        {
          counts: { books: 10, members: 5, activeLoans: 2, overdueLoans: 1 },
          overdueItems: [overdueLoan],
          overdueTotal: 1,
        },
        'old-request',
        { skip: 0, limit: 25, sortBy: 'due_at', sortDir: 'asc' },
      ),
    );

    expect(state.counts).toBeNull();
    expect(state.overdueItems).toEqual([]);
    expect(state.status).toBe(RequestStatus.LOADING);
  });
});
