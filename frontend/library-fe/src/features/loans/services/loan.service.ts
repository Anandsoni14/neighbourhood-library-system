import { httpClient } from '@/services/httpClient';
import { ENDPOINTS } from '@/services/endpoints';
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
    const { data } = await httpClient.get<Page<Loan>>(ENDPOINTS.loans.list, {
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
    const { data } = await httpClient.get<Page<OverdueLoan>>(ENDPOINTS.loans.overdue, {
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
    const { data } = await httpClient.get<Loan>(ENDPOINTS.loans.byId(loanId));
    return data;
  },

  async issue(payload: LoanIssueRequest): Promise<Loan> {
    const { data } = await httpClient.post<Loan>(ENDPOINTS.loans.list, payload);
    return data;
  },

  async returnLoan(loanId: string, payload: LoanReturnRequest): Promise<Loan> {
    const { data } = await httpClient.post<Loan>(ENDPOINTS.loans.return(loanId), payload);
    return data;
  },
};
