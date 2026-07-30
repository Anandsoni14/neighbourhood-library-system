import { describe, expect, it } from 'vitest';

import { CopyCondition, LoanStatus } from '@/types/api';
import { RequestStatus } from '@/types/common';

import loansReducer, { fetchLoans, issueLoan, resetMutationStatus, returnLoan } from './loansSlice';

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

const initialState = {
  items: [],
  total: 0,
  status: RequestStatus.IDLE,
  error: null,
  mutationStatus: RequestStatus.IDLE,
  mutationError: null,
  latestRequestId: 'requestId',
};

describe('loansSlice', () => {
  it('fetchLoans.fulfilled stores items and total', () => {
    const state = loansReducer(
      initialState,
      fetchLoans.fulfilled({ items: [loan], total: 1 }, 'requestId', {
        skip: 0,
        limit: 25,
        sortBy: 'borrowed_at',
        sortDir: 'desc',
      }),
    );

    expect(state.items).toEqual([loan]);
    expect(state.total).toBe(1);
    expect(state.status).toBe(RequestStatus.SUCCEEDED);
  });

  it('fetchLoans.rejected records the error message', () => {
    const state = loansReducer(
      { ...initialState, status: RequestStatus.LOADING },
      fetchLoans.rejected(
        new Error('rejected'),
        'requestId',
        { skip: 0, limit: 25, sortBy: 'borrowed_at', sortDir: 'desc' },
        'Unable to load loans.',
      ),
    );

    expect(state.status).toBe(RequestStatus.FAILED);
    expect(state.error).toBe('Unable to load loans.');
  });

  it('ignores a stale fetchLoans.fulfilled response from a superseded request', () => {
    const arg = { skip: 0, limit: 25, sortBy: 'borrowed_at' as const, sortDir: 'desc' as const };
    let state = loansReducer(initialState, fetchLoans.pending('old-request', arg));
    state = loansReducer(state, fetchLoans.pending('new-request', arg));

    state = loansReducer(state, fetchLoans.fulfilled({ items: [loan], total: 1 }, 'old-request', arg));

    expect(state.items).toEqual([]);
    expect(state.status).toBe(RequestStatus.LOADING);
  });

  it('issueLoan.fulfilled marks the mutation as succeeded', () => {
    const state = loansReducer(
      { ...initialState, mutationStatus: RequestStatus.LOADING },
      issueLoan.fulfilled(loan, 'requestId', { copy_id: loan.copy_id, member_id: loan.member_id }),
    );

    expect(state.mutationStatus).toBe(RequestStatus.SUCCEEDED);
  });

  it('issueLoan.rejected records the mutation error', () => {
    const state = loansReducer(
      { ...initialState, mutationStatus: RequestStatus.LOADING },
      issueLoan.rejected(
        new Error('rejected'),
        'requestId',
        { copy_id: loan.copy_id, member_id: loan.member_id },
        'Unable to issue the loan.',
      ),
    );

    expect(state.mutationStatus).toBe(RequestStatus.FAILED);
    expect(state.mutationError).toBe('Unable to issue the loan.');
  });

  it('returnLoan.fulfilled marks the mutation as succeeded', () => {
    const returned = { ...loan, status: LoanStatus.RETURNED, calculated_fine: 12.5 };
    const state = loansReducer(
      { ...initialState, mutationStatus: RequestStatus.LOADING },
      returnLoan.fulfilled(returned, 'requestId', {
        loanId: '1',
        payload: { return_condition: CopyCondition.GOOD },
      }),
    );

    expect(state.mutationStatus).toBe(RequestStatus.SUCCEEDED);
  });

  it('resetMutationStatus clears mutation status and error', () => {
    const state = loansReducer(
      { ...initialState, mutationStatus: RequestStatus.FAILED, mutationError: 'oops' },
      resetMutationStatus(),
    );

    expect(state.mutationStatus).toBe(RequestStatus.IDLE);
    expect(state.mutationError).toBeNull();
  });
});
