import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { loanService } from '@/features/loans/services/loan.service';
import type {
  ListLoansParams,
  ListOverdueLoansParams,
  Loan,
  LoanIssueRequest,
  LoanReturnRequest,
  OverdueLoan,
} from '@/features/loans/types/loan.types';
import type { RootState } from '@/redux/store';
import { RequestStatus } from '@/types/common';
import { getApiErrorMessage } from '@/utils/apiError';

interface LoansState {
  items: Loan[];
  total: number;
  status: RequestStatus;
  error: string | null;
  mutationStatus: RequestStatus;
  mutationError: string | null;
  /** See booksSlice's identical field for the stale-response rationale. */
  latestRequestId: string | null;
  overdueItems: OverdueLoan[];
  overdueTotal: number;
  overdueStatus: RequestStatus;
  overdueError: string | null;
  latestOverdueRequestId: string | null;
}

const initialState: LoansState = {
  items: [],
  total: 0,
  status: RequestStatus.IDLE,
  error: null,
  mutationStatus: RequestStatus.IDLE,
  mutationError: null,
  latestRequestId: null,
  overdueItems: [],
  overdueTotal: 0,
  overdueStatus: RequestStatus.IDLE,
  overdueError: null,
  latestOverdueRequestId: null,
};

export const fetchLoans = createAsyncThunk<
  { items: Loan[]; total: number },
  ListLoansParams,
  { rejectValue: string }
>('loans/fetchLoans', async (params, { rejectWithValue }) => {
  try {
    return await loanService.list(params);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load loans.'));
  }
});

/** Independent of fetchLoans so a paginated/filtered overdue-list view (e.g. the
 * dashboard widget) never touches the main Loans page's own list state. */
export const fetchOverdueLoans = createAsyncThunk<
  { items: OverdueLoan[]; total: number },
  ListOverdueLoansParams,
  { rejectValue: string }
>('loans/fetchOverdueLoans', async (params, { rejectWithValue }) => {
  try {
    return await loanService.overdue(params);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load overdue loans.'));
  }
});

export const issueLoan = createAsyncThunk<Loan, LoanIssueRequest, { rejectValue: string }>(
  'loans/issueLoan',
  async (payload, { rejectWithValue }) => {
    try {
      return await loanService.issue(payload);
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to issue the loan.'));
    }
  },
);

export const returnLoan = createAsyncThunk<
  Loan,
  { loanId: string; payload: LoanReturnRequest },
  { rejectValue: string }
>('loans/returnLoan', async ({ loanId, payload }, { rejectWithValue }) => {
  try {
    return await loanService.returnLoan(loanId, payload);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to return the loan.'));
  }
});

const loansSlice = createSlice({
  name: 'loans',
  initialState,
  reducers: {
    resetMutationStatus(state) {
      state.mutationStatus = RequestStatus.IDLE;
      state.mutationError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLoans.pending, (state, action) => {
        state.status = RequestStatus.LOADING;
        state.error = null;
        state.latestRequestId = action.meta.requestId;
      })
      .addCase(fetchLoans.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.latestRequestId) {
          return;
        }
        state.status = RequestStatus.SUCCEEDED;
        state.items = action.payload.items;
        state.total = action.payload.total;
      })
      .addCase(fetchLoans.rejected, (state, action) => {
        if (action.meta.requestId !== state.latestRequestId) {
          return;
        }
        state.status = RequestStatus.FAILED;
        state.error = action.payload ?? 'Unable to load loans.';
      })
      .addCase(fetchOverdueLoans.pending, (state, action) => {
        state.overdueStatus = RequestStatus.LOADING;
        state.overdueError = null;
        state.latestOverdueRequestId = action.meta.requestId;
      })
      .addCase(fetchOverdueLoans.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.latestOverdueRequestId) {
          return;
        }
        state.overdueStatus = RequestStatus.SUCCEEDED;
        state.overdueItems = action.payload.items;
        state.overdueTotal = action.payload.total;
      })
      .addCase(fetchOverdueLoans.rejected, (state, action) => {
        if (action.meta.requestId !== state.latestOverdueRequestId) {
          return;
        }
        state.overdueStatus = RequestStatus.FAILED;
        state.overdueError = action.payload ?? 'Unable to load overdue loans.';
      })
      .addCase(issueLoan.pending, (state) => {
        state.mutationStatus = RequestStatus.LOADING;
        state.mutationError = null;
      })
      .addCase(issueLoan.fulfilled, (state) => {
        state.mutationStatus = RequestStatus.SUCCEEDED;
      })
      .addCase(issueLoan.rejected, (state, action) => {
        state.mutationStatus = RequestStatus.FAILED;
        state.mutationError = action.payload ?? 'Unable to issue the loan.';
      })
      .addCase(returnLoan.pending, (state) => {
        state.mutationStatus = RequestStatus.LOADING;
        state.mutationError = null;
      })
      .addCase(returnLoan.fulfilled, (state) => {
        state.mutationStatus = RequestStatus.SUCCEEDED;
      })
      .addCase(returnLoan.rejected, (state, action) => {
        state.mutationStatus = RequestStatus.FAILED;
        state.mutationError = action.payload ?? 'Unable to return the loan.';
      });
  },
});

export const { resetMutationStatus } = loansSlice.actions;
export default loansSlice.reducer;

export const selectLoans = (state: RootState): Loan[] => state.loans.items;
export const selectLoansTotal = (state: RootState): number => state.loans.total;
export const selectLoansStatus = (state: RootState): RequestStatus => state.loans.status;
export const selectLoansError = (state: RootState): string | null => state.loans.error;
export const selectLoansMutationStatus = (state: RootState): RequestStatus =>
  state.loans.mutationStatus;
export const selectLoansMutationError = (state: RootState): string | null =>
  state.loans.mutationError;
export const selectOverdueLoans = (state: RootState): OverdueLoan[] => state.loans.overdueItems;
export const selectOverdueLoansTotal = (state: RootState): number => state.loans.overdueTotal;
export const selectOverdueLoansStatus = (state: RootState): RequestStatus =>
  state.loans.overdueStatus;
export const selectOverdueLoansError = (state: RootState): string | null =>
  state.loans.overdueError;
