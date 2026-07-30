import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { loanService } from '@/features/loans/services/loan.service';
import type {
  ListLoansParams,
  Loan,
  LoanIssueRequest,
  LoanReturnRequest,
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
}

const initialState: LoansState = {
  items: [],
  total: 0,
  status: RequestStatus.IDLE,
  error: null,
  mutationStatus: RequestStatus.IDLE,
  mutationError: null,
  latestRequestId: null,
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
