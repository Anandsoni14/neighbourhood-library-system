import { describe, expect, it, vi } from 'vitest';

import { httpClient } from '@/services/httpClient';
import { SortDir } from '@/types/common';

import { bookService } from './book.service';
import { BookSortField } from '../types/book.types';

vi.mock('@/services/httpClient', () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const book = {
  book_id: '1',
  title: 'Clean Code',
  author: 'Robert C. Martin',
  publisher: 'Prentice Hall',
  isbn: '9780132350884',
  category: 'Software',
  description: null,
  published_year: 2008,
};

describe('bookService', () => {
  it('lists books, omitting blank filters and forwarding sort/pagination', async () => {
    vi.mocked(httpClient.get).mockResolvedValue({
      data: { items: [book], total: 1, skip: 0, limit: 25 },
    });

    const result = await bookService.list({
      skip: 0,
      limit: 25,
      title: 'clean',
      author: '',
      sortBy: BookSortField.TITLE,
      sortDir: SortDir.ASC,
    });

    expect(httpClient.get).toHaveBeenCalledWith('/books', {
      params: {
        skip: 0,
        limit: 25,
        title: 'clean',
        author: undefined,
        category: undefined,
        isbn: undefined,
        sort_by: 'title',
        sort_dir: 'asc',
      },
    });
    expect(result).toEqual({ items: [book], total: 1, skip: 0, limit: 25 });
  });

  it('fetches a single book by id', async () => {
    vi.mocked(httpClient.get).mockResolvedValue({ data: book });

    const result = await bookService.get('1');

    expect(httpClient.get).toHaveBeenCalledWith('/books/1');
    expect(result).toEqual(book);
  });

  it('creates a book', async () => {
    vi.mocked(httpClient.post).mockResolvedValue({ data: book });

    const payload = { title: 'Clean Code', author: 'Robert C. Martin' };
    const result = await bookService.create(payload);

    expect(httpClient.post).toHaveBeenCalledWith('/books', payload);
    expect(result).toEqual(book);
  });

  it('updates a book', async () => {
    vi.mocked(httpClient.put).mockResolvedValue({ data: book });

    const payload = { title: 'Clean Code', author: 'Robert C. Martin' };
    const result = await bookService.update('1', payload);

    expect(httpClient.put).toHaveBeenCalledWith('/books/1', payload);
    expect(result).toEqual(book);
  });

  it('deletes a book', async () => {
    vi.mocked(httpClient.delete).mockResolvedValue({ data: undefined });

    await bookService.remove('1');

    expect(httpClient.delete).toHaveBeenCalledWith('/books/1');
  });
});
