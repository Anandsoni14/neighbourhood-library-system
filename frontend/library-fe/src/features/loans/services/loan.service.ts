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
  list(params: ListLoansParams): Promise<Page<Loan>> {
    return httpClient.get<Page<Loan>>(ENDPOINTS.loans.list, {
      params: {
        skip: params.skip,
        limit: params.limit,
        member_id: nonEmpty(params.memberId),
        copy_id: nonEmpty(params.copyId),
        status: params.status,
        member_name: nonEmpty(params.memberName),
        book_title: nonEmpty(params.bookTitle),
        copy_barcode: nonEmpty(params.copyBarcode),
        sort_by: params.sortBy,
        sort_dir: params.sortDir,
      },
    });
  },

  overdue(params: ListOverdueLoansParams): Promise<Page<OverdueLoan>> {
    return httpClient.get<Page<OverdueLoan>>(ENDPOINTS.loans.overdue, {
      params: {
        skip: params.skip,
        limit: params.limit,
        member_name: nonEmpty(params.memberName),
        book_title: nonEmpty(params.bookTitle),
        sort_by: params.sortBy,
        sort_dir: params.sortDir,
      },
    });
  },

  get(loanId: string): Promise<Loan> {
    return httpClient.get<Loan>(ENDPOINTS.loans.byId(loanId));
  },

  issue(payload: LoanIssueRequest): Promise<Loan> {
    return httpClient.post<Loan>(ENDPOINTS.loans.list, payload);
  },

  returnLoan(loanId: string, payload: LoanReturnRequest): Promise<Loan> {
    return httpClient.post<Loan>(ENDPOINTS.loans.return(loanId), payload);
  },
};
