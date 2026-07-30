import { httpClient } from '@/services/httpClient';
import type { Page } from '@/types/api';

import type {
  ListLoansParams,
  ListOverdueLoansParams,
  Loan,
  LoanIssueRequest,
  LoanReturnRequest,
  OverdueLoan,
} from '../types/loan.types';

/** An empty filter string means "no filter" to the API, so send `undefined` instead. */
function nonEmpty(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value;
}

export const loanService = {
  async list(params: ListLoansParams): Promise<Page<Loan>> {
    const { data } = await httpClient.get<Page<Loan>>('/loans', {
      params: {
        skip: params.skip,
        limit: params.limit,
        member_id: nonEmpty(params.memberId),
        copy_id: nonEmpty(params.copyId),
        status: params.status,
        sort_by: params.sortBy,
        sort_dir: params.sortDir,
      },
    });
    return data;
  },

  async overdue(params: ListOverdueLoansParams): Promise<Page<OverdueLoan>> {
    const { data } = await httpClient.get<Page<OverdueLoan>>('/loans/overdue', {
      params: {
        skip: params.skip,
        limit: params.limit,
        sort_by: params.sortBy,
        sort_dir: params.sortDir,
      },
    });
    return data;
  },

  async get(loanId: string): Promise<Loan> {
    const { data } = await httpClient.get<Loan>(`/loans/${loanId}`);
    return data;
  },

  async issue(payload: LoanIssueRequest): Promise<Loan> {
    const { data } = await httpClient.post<Loan>('/loans', payload);
    return data;
  },

  async returnLoan(loanId: string, payload: LoanReturnRequest): Promise<Loan> {
    const { data } = await httpClient.post<Loan>(`/loans/${loanId}/return`, payload);
    return data;
  },
};
