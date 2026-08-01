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
  async list(params: ListBooksParams): Promise<Page<Book>> {
    const { data } = await httpClient.get<Page<Book>>(ENDPOINTS.books.list, {
      params: {
        skip: params.skip,
        limit: params.limit,
        title: nonEmpty(params.title),
        author: nonEmpty(params.author),
        category_id: nonEmpty(params.categoryId),
        isbn: nonEmpty(params.isbn),
        archived: params.archived,
        sort_by: params.sortBy,
        sort_dir: params.sortDir,
      },
    });
    return data;
  },

  async get(bookId: string): Promise<Book> {
    const { data } = await httpClient.get<Book>(ENDPOINTS.books.byId(bookId));
    return data;
  },

  async create(payload: BookRequest): Promise<Book> {
    const { data } = await httpClient.post<Book>(ENDPOINTS.books.list, payload);
    return data;
  },

  async update(bookId: string, payload: BookRequest): Promise<Book> {
    const { data } = await httpClient.put<Book>(ENDPOINTS.books.byId(bookId), payload);
    return data;
  },

  async archive(bookId: string): Promise<Book> {
    const { data } = await httpClient.post<Book>(ENDPOINTS.books.archive(bookId));
    return data;
  },

  async unarchive(bookId: string): Promise<Book> {
    const { data } = await httpClient.post<Book>(ENDPOINTS.books.unarchive(bookId));
    return data;
  },
};
