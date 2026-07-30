import { useCallback } from 'react';

import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  archiveBook as archiveBookThunk,
  createBook as createBookThunk,
  fetchBooks as fetchBooksThunk,
  resetMutationStatus,
  selectBooks,
  selectBooksError,
  selectBooksMutationError,
  selectBooksMutationStatus,
  selectBooksStatus,
  selectBooksTotal,
  unarchiveBook as unarchiveBookThunk,
  updateBook as updateBookThunk,
} from '@/redux/slices/booksSlice';
import { RequestStatus } from '@/types/common';

import type { BookRequest, ListBooksParams } from '../types/book.types';

/**
 * The seam between the book catalog UI (BooksPage, BookFormDialog) and
 * Redux — mirrors useAuth's shape so both features read the same way.
 */
export function useBooks() {
  const dispatch = useAppDispatch();
  const books = useAppSelector(selectBooks);
  const total = useAppSelector(selectBooksTotal);
  const status = useAppSelector(selectBooksStatus);
  const error = useAppSelector(selectBooksError);
  const mutationStatus = useAppSelector(selectBooksMutationStatus);
  const mutationError = useAppSelector(selectBooksMutationError);

  const fetchBooks = useCallback(
    (params: ListBooksParams) => dispatch(fetchBooksThunk(params)),
    [dispatch],
  );

  const createBook = useCallback(
    (payload: BookRequest) => dispatch(createBookThunk(payload)),
    [dispatch],
  );

  const updateBook = useCallback(
    (bookId: string, payload: BookRequest) => dispatch(updateBookThunk({ bookId, payload })),
    [dispatch],
  );

  const archiveBook = useCallback(
    (bookId: string) => dispatch(archiveBookThunk(bookId)),
    [dispatch],
  );

  const unarchiveBook = useCallback(
    (bookId: string) => dispatch(unarchiveBookThunk(bookId)),
    [dispatch],
  );

  const clearMutationError = useCallback(() => dispatch(resetMutationStatus()), [dispatch]);

  return {
    books,
    total,
    error,
    mutationError,
    isLoading: status === RequestStatus.LOADING,
    isMutating: mutationStatus === RequestStatus.LOADING,
    fetchBooks,
    createBook,
    updateBook,
    archiveBook,
    unarchiveBook,
    clearMutationError,
  };
}
