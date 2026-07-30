import { describe, expect, it } from 'vitest';

import { MembershipStatus } from '@/types/api';
import { RequestStatus } from '@/types/common';

import membersReducer, {
  createMember,
  deleteMember,
  fetchMembers,
  resetMutationStatus,
  updateMember,
} from './membersSlice';

const member = {
  member_id: '1',
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

const initialState = {
  items: [],
  total: 0,
  status: RequestStatus.IDLE,
  error: null,
  mutationStatus: RequestStatus.IDLE,
  mutationError: null,
};

describe('membersSlice', () => {
  it('fetchMembers.fulfilled stores items and total', () => {
    const state = membersReducer(
      initialState,
      fetchMembers.fulfilled({ items: [member], total: 1 }, 'requestId', {
        skip: 0,
        limit: 25,
        sortBy: 'last_name',
        sortDir: 'asc',
      }),
    );

    expect(state.items).toEqual([member]);
    expect(state.total).toBe(1);
    expect(state.status).toBe(RequestStatus.SUCCEEDED);
  });

  it('fetchMembers.rejected records the error message', () => {
    const state = membersReducer(
      { ...initialState, status: RequestStatus.LOADING },
      fetchMembers.rejected(
        new Error('rejected'),
        'requestId',
        {
          skip: 0,
          limit: 25,
          sortBy: 'last_name',
          sortDir: 'asc',
        },
        'Unable to load members.',
      ),
    );

    expect(state.status).toBe(RequestStatus.FAILED);
    expect(state.error).toBe('Unable to load members.');
  });

  it('createMember.fulfilled marks the mutation as succeeded', () => {
    const state = membersReducer(
      { ...initialState, mutationStatus: RequestStatus.LOADING },
      createMember.fulfilled(member, 'requestId', {
        first_name: member.first_name,
        last_name: member.last_name,
        email: member.email,
      }),
    );

    expect(state.mutationStatus).toBe(RequestStatus.SUCCEEDED);
  });

  it('updateMember.rejected records the mutation error', () => {
    const state = membersReducer(
      { ...initialState, mutationStatus: RequestStatus.LOADING },
      updateMember.rejected(
        new Error('rejected'),
        'requestId',
        {
          memberId: '1',
          payload: { first_name: member.first_name, last_name: member.last_name, email: member.email },
        },
        'Unable to update the member.',
      ),
    );

    expect(state.mutationStatus).toBe(RequestStatus.FAILED);
    expect(state.mutationError).toBe('Unable to update the member.');
  });

  it('deleteMember.fulfilled marks the mutation as succeeded', () => {
    const state = membersReducer(
      { ...initialState, mutationStatus: RequestStatus.LOADING },
      deleteMember.fulfilled('1', 'requestId', '1'),
    );

    expect(state.mutationStatus).toBe(RequestStatus.SUCCEEDED);
  });

  it('resetMutationStatus clears mutation status and error', () => {
    const state = membersReducer(
      { ...initialState, mutationStatus: RequestStatus.FAILED, mutationError: 'oops' },
      resetMutationStatus(),
    );

    expect(state.mutationStatus).toBe(RequestStatus.IDLE);
    expect(state.mutationError).toBeNull();
  });
});
