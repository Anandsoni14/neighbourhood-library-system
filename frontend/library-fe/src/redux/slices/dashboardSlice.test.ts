import { describe, expect, it } from 'vitest';

import { RequestStatus } from '@/types/common';

import dashboardReducer, { fetchDashboard } from './dashboardSlice';

const counts = { books: 10, members: 5, activeLoans: 2, overdueLoans: 1 };

const initialState = {
  counts: null,
  status: RequestStatus.IDLE,
  error: null,
  latestRequestId: 'requestId',
};

describe('dashboardSlice', () => {
  it('fetchDashboard.fulfilled stores counts', () => {
    const state = dashboardReducer(initialState, fetchDashboard.fulfilled(counts, 'requestId'));

    expect(state.counts).toEqual(counts);
    expect(state.status).toBe(RequestStatus.SUCCEEDED);
  });

  it('fetchDashboard.rejected records the error message', () => {
    const state = dashboardReducer(
      { ...initialState, status: RequestStatus.LOADING },
      fetchDashboard.rejected(
        new Error('rejected'),
        'requestId',
        undefined,
        'Unable to load the dashboard.',
      ),
    );

    expect(state.status).toBe(RequestStatus.FAILED);
    expect(state.error).toBe('Unable to load the dashboard.');
  });

  it('ignores a stale fetchDashboard.fulfilled response from a superseded request', () => {
    let state = dashboardReducer(initialState, fetchDashboard.pending('old-request', undefined));
    state = dashboardReducer(state, fetchDashboard.pending('new-request', undefined));

    state = dashboardReducer(state, fetchDashboard.fulfilled(counts, 'old-request'));

    expect(state.counts).toBeNull();
    expect(state.status).toBe(RequestStatus.LOADING);
  });
});
