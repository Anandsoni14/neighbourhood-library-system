import { httpClient } from '@/services/httpClient';
import { ENDPOINTS } from '@/services/endpoints';
import type { Page } from '@/types/api';

import type {
  BookCopy,
  BookCopyRequest,
  BookCopyUpdateRequest,
  ListCopiesParams,
} from '../types/copy.types';

/** An empty filter string means "no filter" to the API, so send `undefined` instead. */
function nonEmpty(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value;
}

export const copyService = {
  list(params: ListCopiesParams): Promise<Page<BookCopy>> {
    return httpClient.get<Page<BookCopy>>(ENDPOINTS.bookCopies.list, {
      params: {
        skip: params.skip,
        limit: params.limit,
        book_id: nonEmpty(params.bookId),
        status: params.status,
        condition: params.condition,
        barcode: nonEmpty(params.barcode),
        sort_by: params.sortBy,
        sort_dir: params.sortDir,
      },
    });
  },

  get(copyId: string): Promise<BookCopy> {
    return httpClient.get<BookCopy>(ENDPOINTS.bookCopies.byId(copyId));
  },

  create(payload: BookCopyRequest): Promise<BookCopy> {
    return httpClient.post<BookCopy>(ENDPOINTS.bookCopies.list, payload);
  },

  update(copyId: string, payload: BookCopyUpdateRequest): Promise<BookCopy> {
    return httpClient.put<BookCopy>(ENDPOINTS.bookCopies.byId(copyId), payload);
  },

  remove(copyId: string): Promise<void> {
    return httpClient.delete<void>(ENDPOINTS.bookCopies.byId(copyId));
  },
};
