import { httpClient } from '@/services/httpClient';
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
    const { data } = await httpClient.get<Page<Book>>('/books', {
      params: {
        skip: params.skip,
        limit: params.limit,
        title: nonEmpty(params.title),
        author: nonEmpty(params.author),
        category: nonEmpty(params.category),
        isbn: nonEmpty(params.isbn),
        sort_by: params.sortBy,
        sort_dir: params.sortDir,
      },
    });
    return data;
  },

  async get(bookId: string): Promise<Book> {
    const { data } = await httpClient.get<Book>(`/books/${bookId}`);
    return data;
  },

  async create(payload: BookRequest): Promise<Book> {
    const { data } = await httpClient.post<Book>('/books', payload);
    return data;
  },

  async update(bookId: string, payload: BookRequest): Promise<Book> {
    const { data } = await httpClient.put<Book>(`/books/${bookId}`, payload);
    return data;
  },

  async remove(bookId: string): Promise<void> {
    await httpClient.delete(`/books/${bookId}`);
  },
};
