import { httpClient } from '@/services/httpClient';
import { ENDPOINTS } from '@/services/endpoints';
import type { Page } from '@/types/api';

import type { Book, BookRequest, ListBooksParams } from '../types/book.types';

/** An empty filter string means "no filter" to the API, so send `undefined` instead. */
function nonEmpty(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value;
}

export const bookService = {
  list(params: ListBooksParams): Promise<Page<Book>> {
    return httpClient.get<Page<Book>>(ENDPOINTS.books.list, {
      params: {
        skip: params.skip,
        limit: params.limit,
        title: nonEmpty(params.title),
        author: nonEmpty(params.author),
        category_id: nonEmpty(params.categoryId),
        isbn: nonEmpty(params.isbn),
        archived: params.archived,
        in_stock: params.inStock,
        sort_by: params.sortBy,
        sort_dir: params.sortDir,
      },
    });
  },

  get(bookId: string): Promise<Book> {
    return httpClient.get<Book>(ENDPOINTS.books.byId(bookId));
  },

  create(payload: BookRequest): Promise<Book> {
    return httpClient.post<Book>(ENDPOINTS.books.list, payload);
  },

  update(bookId: string, payload: BookRequest): Promise<Book> {
    return httpClient.put<Book>(ENDPOINTS.books.byId(bookId), payload);
  },

  archive(bookId: string): Promise<Book> {
    return httpClient.post<Book>(ENDPOINTS.books.archive(bookId));
  },

  unarchive(bookId: string): Promise<Book> {
    return httpClient.post<Book>(ENDPOINTS.books.unarchive(bookId));
  },
};
