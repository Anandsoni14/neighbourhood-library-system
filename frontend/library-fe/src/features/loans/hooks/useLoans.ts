import { useCallback } from 'react';

import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchLoans as fetchLoansThunk,
  fetchOverdueLoans as fetchOverdueLoansThunk,
  issueLoan as issueLoanThunk,
  resetMutationStatus,
  returnLoan as returnLoanThunk,
  selectLoans,
  selectLoansError,
  selectLoansMutationError,
  selectLoansMutationStatus,
  selectLoansStatus,
  selectLoansTotal,
  selectOverdueLoans,
  selectOverdueLoansError,
  selectOverdueLoansStatus,
  selectOverdueLoansTotal,
} from '@/redux/slices/loansSlice';
import { RequestStatus } from '@/types/common';

import type {
  ListLoansParams,
  ListOverdueLoansParams,
  LoanIssueRequest,
  LoanReturnRequest,
} from '../types/loan.types';

/**
 * The seam between the circulation-desk UI (LoansPage, IssueLoanDialog,
 * ReturnLoanDialog) and Redux — mirrors useBooks' shape.
 */
export function useLoans() {
  const dispatch = useAppDispatch();
  const loans = useAppSelector(selectLoans);
  const total = useAppSelector(selectLoansTotal);
  const status = useAppSelector(selectLoansStatus);
  const error = useAppSelector(selectLoansError);
  const mutationStatus = useAppSelector(selectLoansMutationStatus);
  const mutationError = useAppSelector(selectLoansMutationError);
  const overdueItems = useAppSelector(selectOverdueLoans);
  const overdueTotal = useAppSelector(selectOverdueLoansTotal);
  const overdueStatus = useAppSelector(selectOverdueLoansStatus);
  const overdueError = useAppSelector(selectOverdueLoansError);

  const fetchLoans = useCallback(
    (params: ListLoansParams) => dispatch(fetchLoansThunk(params)),
    [dispatch],
  );

  const fetchOverdueLoans = useCallback(
    (params: ListOverdueLoansParams) => dispatch(fetchOverdueLoansThunk(params)),
    [dispatch],
  );

  const issueLoan = useCallback(
    (payload: LoanIssueRequest) => dispatch(issueLoanThunk(payload)),
    [dispatch],
  );

  const returnLoan = useCallback(
    (loanId: string, payload: LoanReturnRequest) => dispatch(returnLoanThunk({ loanId, payload })),
    [dispatch],
  );

  const clearMutationError = useCallback(() => dispatch(resetMutationStatus()), [dispatch]);

  return {
    loans,
    total,
    error,
    mutationError,
    isLoading: status === RequestStatus.LOADING,
    isMutating: mutationStatus === RequestStatus.LOADING,
    fetchLoans,
    issueLoan,
    returnLoan,
    clearMutationError,
    overdueItems,
    overdueTotal,
    overdueError,
    isOverdueLoading: overdueStatus === RequestStatus.LOADING,
    fetchOverdueLoans,
  };
}
