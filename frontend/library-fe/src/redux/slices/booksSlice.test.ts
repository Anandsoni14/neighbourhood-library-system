import { describe, expect, it } from 'vitest';

import { RequestStatus } from '@/types/common';

import booksReducer, {
  createBook,
  deleteBook,
  fetchBooks,
  resetMutationStatus,
  updateBook,
} from './booksSlice';

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

const initialState = {
  items: [],
  total: 0,
  status: RequestStatus.IDLE,
  error: null,
  mutationStatus: RequestStatus.IDLE,
  mutationError: null,
  latestRequestId: 'requestId',
};

describe('booksSlice', () => {
  it('fetchBooks.fulfilled stores items and total', () => {
    const state = booksReducer(
      initialState,
      fetchBooks.fulfilled({ items: [book], total: 1 }, 'requestId', {
        skip: 0,
        limit: 25,
        sortBy: 'title',
        sortDir: 'asc',
      }),
    );

    expect(state.items).toEqual([book]);
    expect(state.total).toBe(1);
    expect(state.status).toBe(RequestStatus.SUCCEEDED);
  });

  it('fetchBooks.rejected records the error message', () => {
    const state = booksReducer(
      { ...initialState, status: RequestStatus.LOADING },
      fetchBooks.rejected(
        new Error('rejected'),
        'requestId',
        {
          skip: 0,
          limit: 25,
          sortBy: 'title',
          sortDir: 'asc',
        },
        'Unable to load books.',
      ),
    );

    expect(state.status).toBe(RequestStatus.FAILED);
    expect(state.error).toBe('Unable to load books.');
  });

  it('ignores a stale fetchBooks.fulfilled response from a superseded request', () => {
    const arg = { skip: 0, limit: 25, sortBy: 'title' as const, sortDir: 'asc' as const };
    let state = booksReducer(initialState, fetchBooks.pending('old-request', arg));
    state = booksReducer(state, fetchBooks.pending('new-request', arg));

    state = booksReducer(
      state,
      fetchBooks.fulfilled({ items: [book], total: 1 }, 'old-request', arg),
    );

    expect(state.items).toEqual([]);
    expect(state.status).toBe(RequestStatus.LOADING);
  });

  it('ignores a stale fetchBooks.rejected response from a superseded request', () => {
    const arg = { skip: 0, limit: 25, sortBy: 'title' as const, sortDir: 'asc' as const };
    let state = booksReducer(initialState, fetchBooks.pending('old-request', arg));
    state = booksReducer(state, fetchBooks.pending('new-request', arg));

    state = booksReducer(
      state,
      fetchBooks.rejected(new Error('rejected'), 'old-request', arg, 'Unable to load books.'),
    );

    expect(state.error).toBeNull();
    expect(state.status).toBe(RequestStatus.LOADING);
  });

  it('createBook.fulfilled marks the mutation as succeeded', () => {
    const state = booksReducer(
      { ...initialState, mutationStatus: RequestStatus.LOADING },
      createBook.fulfilled(book, 'requestId', { title: book.title, author: book.author }),
    );

    expect(state.mutationStatus).toBe(RequestStatus.SUCCEEDED);
  });

  it('updateBook.rejected records the mutation error', () => {
    const state = booksReducer(
      { ...initialState, mutationStatus: RequestStatus.LOADING },
      updateBook.rejected(
        new Error('rejected'),
        'requestId',
        { bookId: '1', payload: { title: book.title, author: book.author } },
        'Unable to update the book.',
      ),
    );

    expect(state.mutationStatus).toBe(RequestStatus.FAILED);
    expect(state.mutationError).toBe('Unable to update the book.');
  });

  it('deleteBook.fulfilled marks the mutation as succeeded', () => {
    const state = booksReducer(
      { ...initialState, mutationStatus: RequestStatus.LOADING },
      deleteBook.fulfilled('1', 'requestId', '1'),
    );

    expect(state.mutationStatus).toBe(RequestStatus.SUCCEEDED);
  });

  it('resetMutationStatus clears mutation status and error', () => {
    const state = booksReducer(
      { ...initialState, mutationStatus: RequestStatus.FAILED, mutationError: 'oops' },
      resetMutationStatus(),
    );

    expect(state.mutationStatus).toBe(RequestStatus.IDLE);
    expect(state.mutationError).toBeNull();
  });
});
