import { describe, expect, it } from 'vitest';

import { CopyCondition, CopyStatus } from '@/types/api';
import { RequestStatus } from '@/types/common';

import copiesReducer, {
  createCopy,
  deleteCopy,
  fetchCopies,
  resetMutationStatus,
  updateCopy,
} from './copiesSlice';

const copy = {
  copy_id: '1',
  book_id: 'b1',
  barcode: 'BC-001',
  shelf_code: null,
  condition: CopyCondition.NEW,
  status: CopyStatus.AVAILABLE,
  max_borrow_days: 14,
  late_fee_per_day: 5,
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

describe('copiesSlice', () => {
  it('fetchCopies.fulfilled stores items and total', () => {
    const state = copiesReducer(
      initialState,
      fetchCopies.fulfilled({ items: [copy], total: 1 }, 'requestId', {
        skip: 0,
        limit: 25,
        sortBy: 'barcode',
        sortDir: 'asc',
      }),
    );

    expect(state.items).toEqual([copy]);
    expect(state.total).toBe(1);
    expect(state.status).toBe(RequestStatus.SUCCEEDED);
  });

  it('fetchCopies.rejected records the error message', () => {
    const state = copiesReducer(
      { ...initialState, status: RequestStatus.LOADING },
      fetchCopies.rejected(
        new Error('rejected'),
        'requestId',
        { skip: 0, limit: 25, sortBy: 'barcode', sortDir: 'asc' },
        'Unable to load copies.',
      ),
    );

    expect(state.status).toBe(RequestStatus.FAILED);
    expect(state.error).toBe('Unable to load copies.');
  });

  it('ignores a stale fetchCopies.fulfilled response from a superseded request', () => {
    const arg = { skip: 0, limit: 25, sortBy: 'barcode' as const, sortDir: 'asc' as const };
    let state = copiesReducer(initialState, fetchCopies.pending('old-request', arg));
    state = copiesReducer(state, fetchCopies.pending('new-request', arg));

    state = copiesReducer(
      state,
      fetchCopies.fulfilled({ items: [copy], total: 1 }, 'old-request', arg),
    );

    expect(state.items).toEqual([]);
    expect(state.status).toBe(RequestStatus.LOADING);
  });

  it('createCopy.fulfilled marks the mutation as succeeded', () => {
    const state = copiesReducer(
      { ...initialState, mutationStatus: RequestStatus.LOADING },
      createCopy.fulfilled(copy, 'requestId', { book_id: copy.book_id, barcode: copy.barcode }),
    );

    expect(state.mutationStatus).toBe(RequestStatus.SUCCEEDED);
  });

  it('updateCopy.rejected records the mutation error', () => {
    const state = copiesReducer(
      { ...initialState, mutationStatus: RequestStatus.LOADING },
      updateCopy.rejected(
        new Error('rejected'),
        'requestId',
        { copyId: '1', payload: { barcode: 'BC-002' } },
        'Unable to update the copy.',
      ),
    );

    expect(state.mutationStatus).toBe(RequestStatus.FAILED);
    expect(state.mutationError).toBe('Unable to update the copy.');
  });

  it('deleteCopy.fulfilled marks the mutation as succeeded', () => {
    const state = copiesReducer(
      { ...initialState, mutationStatus: RequestStatus.LOADING },
      deleteCopy.fulfilled('1', 'requestId', '1'),
    );

    expect(state.mutationStatus).toBe(RequestStatus.SUCCEEDED);
  });

  it('resetMutationStatus clears mutation status and error', () => {
    const state = copiesReducer(
      { ...initialState, mutationStatus: RequestStatus.FAILED, mutationError: 'oops' },
      resetMutationStatus(),
    );

    expect(state.mutationStatus).toBe(RequestStatus.IDLE);
    expect(state.mutationError).toBeNull();
  });
});
