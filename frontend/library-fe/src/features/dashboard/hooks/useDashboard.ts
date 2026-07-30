import { useCallback } from 'react';

import type { ListOverdueLoansParams } from '@/features/loans/types/loan.types';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchDashboard as fetchDashboardThunk,
  selectDashboardCounts,
  selectDashboardError,
  selectDashboardOverdueItems,
  selectDashboardOverdueTotal,
  selectDashboardStatus,
} from '@/redux/slices/dashboardSlice';
import { RequestStatus } from '@/types/common';

/** The seam between DashboardPage and Redux — mirrors the other list hooks' shape. */
export function useDashboard() {
  const dispatch = useAppDispatch();
  const counts = useAppSelector(selectDashboardCounts);
  const overdueItems = useAppSelector(selectDashboardOverdueItems);
  const overdueTotal = useAppSelector(selectDashboardOverdueTotal);
  const status = useAppSelector(selectDashboardStatus);
  const error = useAppSelector(selectDashboardError);

  const fetchDashboard = useCallback(
    (params: ListOverdueLoansParams) => dispatch(fetchDashboardThunk(params)),
    [dispatch],
  );

  return {
    counts,
    overdueItems,
    overdueTotal,
    error,
    isLoading: status === RequestStatus.LOADING,
    fetchDashboard,
  };
}
