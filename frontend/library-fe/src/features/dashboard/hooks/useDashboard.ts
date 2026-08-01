import { useCallback } from 'react';

import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchDashboard as fetchDashboardThunk,
  selectDashboardCounts,
  selectDashboardError,
  selectDashboardStatus,
} from '@/redux/slices/dashboardSlice';
import { RequestStatus } from '@/types/common';

/** The seam between DashboardPage and Redux — mirrors the other list hooks' shape. */
export function useDashboard() {
  const dispatch = useAppDispatch();
  const counts = useAppSelector(selectDashboardCounts);
  const status = useAppSelector(selectDashboardStatus);
  const error = useAppSelector(selectDashboardError);

  const fetchDashboard = useCallback(() => dispatch(fetchDashboardThunk()), [dispatch]);

  return {
    counts,
    error,
    isLoading: status === RequestStatus.LOADING,
    fetchDashboard,
  };
}
