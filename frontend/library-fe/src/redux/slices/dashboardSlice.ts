import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { bookService } from '@/features/books/services/book.service';
import { loanService } from '@/features/loans/services/loan.service';
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
  status: RequestStatus;
  error: string | null;
  /** See booksSlice's identical field for the stale-response rationale. */
  latestRequestId: string | null;
}

const initialState: DashboardState = {
  counts: null,
  status: RequestStatus.IDLE,
  error: null,
  latestRequestId: null,
};

/**
 * A single count-fetching round trip per entity, piggybacking on each list
 * endpoint's `total` field (a `limit: 1` page) rather than adding dedicated
 * count endpoints the backend doesn't have. Takes no filter/pagination
 * params — the overdue-loans list widget on the dashboard fetches its own
 * (filterable, paginated) data via loansSlice's fetchOverdueLoans, so this
 * count can't be corrupted by whatever the widget is currently filtered to.
 */
export const fetchDashboard = createAsyncThunk<DashboardCounts, void, { rejectValue: string }>(
  'dashboard/fetchDashboard',
  async (_arg, { rejectWithValue }) => {
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
        loanService.overdue({ skip: 0, limit: 1, sortBy: 'due_at', sortDir: 'asc' }),
      ]);

      return {
        books: booksPage.total,
        members: membersPage.total,
        activeLoans: activeLoansPage.total,
        overdueLoans: overduePage.total,
      };
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to load the dashboard.'));
    }
  },
);

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
        state.counts = action.payload;
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
export const selectDashboardStatus = (state: RootState): RequestStatus => state.dashboard.status;
export const selectDashboardError = (state: RootState): string | null => state.dashboard.error;
