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
  async list(params: ListCopiesParams): Promise<Page<BookCopy>> {
    const { data } = await httpClient.get<Page<BookCopy>>(ENDPOINTS.bookCopies.list, {
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
    return data;
  },

  async get(copyId: string): Promise<BookCopy> {
    const { data } = await httpClient.get<BookCopy>(ENDPOINTS.bookCopies.byId(copyId));
    return data;
  },

  async create(payload: BookCopyRequest): Promise<BookCopy> {
    const { data } = await httpClient.post<BookCopy>(ENDPOINTS.bookCopies.list, payload);
    return data;
  },

  async update(copyId: string, payload: BookCopyUpdateRequest): Promise<BookCopy> {
    const { data } = await httpClient.put<BookCopy>(ENDPOINTS.bookCopies.byId(copyId), payload);
    return data;
  },

  async remove(copyId: string): Promise<void> {
    await httpClient.delete(ENDPOINTS.bookCopies.byId(copyId));
  },
};
