import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { bookService } from '@/features/books/services/book.service';
import { loanService } from '@/features/loans/services/loan.service';
import type { ListOverdueLoansParams, OverdueLoan } from '@/features/loans/types/loan.types';
import { memberService } from '@/features/members/services/member.service';
import type { RootState } from '@/redux/store';
import { LoanStatus } from '@/types/api';
import { RequestStatus } from '@/types/common';
import { getApiErrorMessage } from '@/utils/apiError';

interface DashboardCounts {
  books: number;
  members: number;
  activeLoans: number;
  overdueLoans: number;
}

interface DashboardState {
  counts: DashboardCounts | null;
  overdueItems: OverdueLoan[];
  overdueTotal: number;
  status: RequestStatus;
  error: string | null;
  /** See booksSlice's identical field for the stale-response rationale. */
  latestRequestId: string | null;
}

const initialState: DashboardState = {
  counts: null,
  overdueItems: [],
  overdueTotal: 0,
  status: RequestStatus.IDLE,
  error: null,
  latestRequestId: null,
};

/**
 * A single count-fetching round trip per entity, piggybacking on each list
 * endpoint's `total` field (a `limit: 1` page) rather than adding dedicated
 * count endpoints the backend doesn't have.
 */
export const fetchDashboard = createAsyncThunk<
  { counts: DashboardCounts; overdueItems: OverdueLoan[]; overdueTotal: number },
  ListOverdueLoansParams,
  { rejectValue: string }
>('dashboard/fetchDashboard', async (overdueParams, { rejectWithValue }) => {
  try {
    const [booksPage, membersPage, activeLoansPage, overduePage] = await Promise.all([
      bookService.list({ skip: 0, limit: 1, sortBy: 'title', sortDir: 'asc' }),
      memberService.list({ skip: 0, limit: 1, sortBy: 'last_name', sortDir: 'asc' }),
      loanService.list({
        skip: 0,
        limit: 1,
        status: LoanStatus.ACTIVE,
        sortBy: 'borrowed_at',
        sortDir: 'desc',
      }),
      loanService.overdue(overdueParams),
    ]);

    return {
      counts: {
        books: booksPage.total,
        members: membersPage.total,
        activeLoans: activeLoansPage.total,
        overdueLoans: overduePage.total,
      },
      overdueItems: overduePage.items,
      overdueTotal: overduePage.total,
    };
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load the dashboard.'));
  }
});

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboard.pending, (state, action) => {
        state.status = RequestStatus.LOADING;
        state.error = null;
        state.latestRequestId = action.meta.requestId;
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.latestRequestId) {
          return;
        }
        state.status = RequestStatus.SUCCEEDED;
        state.counts = action.payload.counts;
        state.overdueItems = action.payload.overdueItems;
        state.overdueTotal = action.payload.overdueTotal;
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        if (action.meta.requestId !== state.latestRequestId) {
          return;
        }
        state.status = RequestStatus.FAILED;
        state.error = action.payload ?? 'Unable to load the dashboard.';
      });
  },
});

export default dashboardSlice.reducer;

export const selectDashboardCounts = (state: RootState): DashboardCounts | null =>
  state.dashboard.counts;
export const selectDashboardOverdueItems = (state: RootState): OverdueLoan[] =>
  state.dashboard.overdueItems;
export const selectDashboardOverdueTotal = (state: RootState): number =>
  state.dashboard.overdueTotal;
export const selectDashboardStatus = (state: RootState): RequestStatus => state.dashboard.status;
export const selectDashboardError = (state: RootState): string | null => state.dashboard.error;
