import { useCallback } from 'react';

import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  createMember as createMemberThunk,
  deleteMember as deleteMemberThunk,
  fetchMembers as fetchMembersThunk,
  resetMutationStatus,
  selectMembers,
  selectMembersError,
  selectMembersMutationError,
  selectMembersMutationStatus,
  selectMembersStatus,
  selectMembersTotal,
  updateMember as updateMemberThunk,
} from '@/redux/slices/membersSlice';
import { RequestStatus } from '@/types/common';

import type { ListMembersParams, MemberRequest } from '../types/member.types';

/**
 * The seam between the member directory UI (MembersPage, MemberFormDialog)
 * and Redux — mirrors useBooks' shape so every list feature reads the same way.
 */
export function useMembers() {
  const dispatch = useAppDispatch();
  const members = useAppSelector(selectMembers);
  const total = useAppSelector(selectMembersTotal);
  const status = useAppSelector(selectMembersStatus);
  const error = useAppSelector(selectMembersError);
  const mutationStatus = useAppSelector(selectMembersMutationStatus);
  const mutationError = useAppSelector(selectMembersMutationError);

  const fetchMembers = useCallback(
    (params: ListMembersParams) => dispatch(fetchMembersThunk(params)),
    [dispatch],
  );

  const createMember = useCallback(
    (payload: MemberRequest) => dispatch(createMemberThunk(payload)),
    [dispatch],
  );

  const updateMember = useCallback(
    (memberId: string, payload: MemberRequest) =>
      dispatch(updateMemberThunk({ memberId, payload })),
    [dispatch],
  );

  const deleteMember = useCallback(
    (memberId: string) => dispatch(deleteMemberThunk(memberId)),
    [dispatch],
  );

  const clearMutationError = useCallback(() => dispatch(resetMutationStatus()), [dispatch]);

  return {
    members,
    total,
    error,
    mutationError,
    isLoading: status === RequestStatus.LOADING,
    isMutating: mutationStatus === RequestStatus.LOADING,
    fetchMembers,
    createMember,
    updateMember,
    deleteMember,
    clearMutationError,
  };
}
