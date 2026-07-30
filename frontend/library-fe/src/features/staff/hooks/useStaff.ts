import { useCallback } from 'react';

import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  activateStaff as activateStaffThunk,
  createStaff as createStaffThunk,
  deactivateStaff as deactivateStaffThunk,
  fetchStaff as fetchStaffThunk,
  resetMutationStatus,
  selectStaff,
  selectStaffError,
  selectStaffMutationError,
  selectStaffMutationStatus,
  selectStaffStatus,
  selectStaffTotal,
  updateStaff as updateStaffThunk,
} from '@/redux/slices/staffSlice';
import { RequestStatus } from '@/types/common';

import type { ListStaffParams, StaffCreateRequest, StaffUpdateRequest } from '../types/staff.types';

/**
 * The seam between the staff-management UI (StaffPage, StaffFormDialog) and
 * Redux — mirrors useBooks' shape.
 */
export function useStaff() {
  const dispatch = useAppDispatch();
  const staff = useAppSelector(selectStaff);
  const total = useAppSelector(selectStaffTotal);
  const status = useAppSelector(selectStaffStatus);
  const error = useAppSelector(selectStaffError);
  const mutationStatus = useAppSelector(selectStaffMutationStatus);
  const mutationError = useAppSelector(selectStaffMutationError);

  const fetchStaff = useCallback(
    (params: ListStaffParams) => dispatch(fetchStaffThunk(params)),
    [dispatch],
  );

  const createStaff = useCallback(
    (payload: StaffCreateRequest) => dispatch(createStaffThunk(payload)),
    [dispatch],
  );

  const updateStaff = useCallback(
    (staffId: string, payload: StaffUpdateRequest) =>
      dispatch(updateStaffThunk({ staffId, payload })),
    [dispatch],
  );

  const activateStaff = useCallback(
    (staffId: string) => dispatch(activateStaffThunk(staffId)),
    [dispatch],
  );

  const deactivateStaff = useCallback(
    (staffId: string) => dispatch(deactivateStaffThunk(staffId)),
    [dispatch],
  );

  const clearMutationError = useCallback(() => dispatch(resetMutationStatus()), [dispatch]);

  return {
    staff,
    total,
    error,
    mutationError,
    isLoading: status === RequestStatus.LOADING,
    isMutating: mutationStatus === RequestStatus.LOADING,
    fetchStaff,
    createStaff,
    updateStaff,
    activateStaff,
    deactivateStaff,
    clearMutationError,
  };
}
