import { renderHook, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setupStore } from '@/redux/store';
import { httpClient } from '@/services/httpClient';

import { useBooks } from './useBooks';
import { BookSortField } from '../types/book.types';

vi.mock('@/services/httpClient', () => ({
  httpClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  attachAuthInterceptors: vi.fn(),
}));

const book = {
  book_id: '1',
  title: 'Clean Code',
  author: 'Robert C. Martin',
  publisher: null,
  isbn: null,
  category: null,
  description: null,
  published_year: 2008,
};

function wrapperFor(store: ReturnType<typeof setupStore>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe('useBooks', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches books and exposes the resulting list and total', async () => {
    vi.mocked(httpClient.get).mockResolvedValue({ data: { items: [book], total: 1 } });

    const store = setupStore();
    const { result } = renderHook(() => useBooks(), { wrapper: wrapperFor(store) });

    await result.current.fetchBooks({
      skip: 0,
      limit: 25,
      sortBy: BookSortField.TITLE,
      sortDir: 'asc',
    });

    await waitFor(() => {
      expect(result.current.books).toEqual([book]);
    });
    expect(result.current.total).toBe(1);
  });

  it('creates a book and reports the mutation as no longer in flight', async () => {
    vi.mocked(httpClient.post).mockResolvedValue({ data: book });

    const store = setupStore();
    const { result } = renderHook(() => useBooks(), { wrapper: wrapperFor(store) });

    await result.current.createBook({ title: book.title, author: book.author });

    await waitFor(() => {
      expect(result.current.isMutating).toBe(false);
    });
    expect(result.current.mutationError).toBeNull();
  });

  it('surfaces a mutation error and clears it on demand', async () => {
    const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST');
    error.response = {
      status: 409,
      statusText: 'Conflict',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { detail: 'Cannot delete: book has active loans' },
    };
    vi.mocked(httpClient.delete).mockRejectedValue(error);

    const store = setupStore();
    const { result } = renderHook(() => useBooks(), { wrapper: wrapperFor(store) });

    await result.current.deleteBook('1');

    await waitFor(() => {
      expect(result.current.mutationError).toBe('Cannot delete: book has active loans');
    });

    result.current.clearMutationError();

    await waitFor(() => {
      expect(result.current.mutationError).toBeNull();
    });
  });
});
