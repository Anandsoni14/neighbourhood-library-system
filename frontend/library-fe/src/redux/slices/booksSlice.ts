import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { bookService } from '@/features/books/services/book.service';
import type { Book, BookRequest, ListBooksParams } from '@/features/books/types/book.types';
import type { RootState } from '@/redux/store';
import { RequestStatus } from '@/types/common';
import { getApiErrorMessage } from '@/utils/apiError';

interface BooksState {
  items: Book[];
  total: number;
  status: RequestStatus;
  error: string | null;
  mutationStatus: RequestStatus;
  mutationError: string | null;
}

const initialState: BooksState = {
  items: [],
  total: 0,
  status: RequestStatus.IDLE,
  error: null,
  mutationStatus: RequestStatus.IDLE,
  mutationError: null,
};

export const fetchBooks = createAsyncThunk<
  { items: Book[]; total: number },
  ListBooksParams,
  { rejectValue: string }
>('books/fetchBooks', async (params, { rejectWithValue }) => {
  try {
    return await bookService.list(params);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load books.'));
  }
});

export const createBook = createAsyncThunk<Book, BookRequest, { rejectValue: string }>(
  'books/createBook',
  async (payload, { rejectWithValue }) => {
    try {
      return await bookService.create(payload);
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to create the book.'));
    }
  },
);

export const updateBook = createAsyncThunk<
  Book,
  { bookId: string; payload: BookRequest },
  { rejectValue: string }
>('books/updateBook', async ({ bookId, payload }, { rejectWithValue }) => {
  try {
    return await bookService.update(bookId, payload);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to update the book.'));
  }
});

export const deleteBook = createAsyncThunk<string, string, { rejectValue: string }>(
  'books/deleteBook',
  async (bookId, { rejectWithValue }) => {
    try {
      await bookService.remove(bookId);
      return bookId;
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to delete the book.'));
    }
  },
);

const booksSlice = createSlice({
  name: 'books',
  initialState,
  reducers: {
    resetMutationStatus(state) {
      state.mutationStatus = RequestStatus.IDLE;
      state.mutationError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBooks.pending, (state) => {
        state.status = RequestStatus.LOADING;
        state.error = null;
      })
      .addCase(fetchBooks.fulfilled, (state, action) => {
        state.status = RequestStatus.SUCCEEDED;
        state.items = action.payload.items;
        state.total = action.payload.total;
      })
      .addCase(fetchBooks.rejected, (state, action) => {
        state.status = RequestStatus.FAILED;
        state.error = action.payload ?? 'Unable to load books.';
      })
      .addCase(createBook.pending, (state) => {
        state.mutationStatus = RequestStatus.LOADING;
        state.mutationError = null;
      })
      .addCase(createBook.fulfilled, (state) => {
        state.mutationStatus = RequestStatus.SUCCEEDED;
      })
      .addCase(createBook.rejected, (state, action) => {
        state.mutationStatus = RequestStatus.FAILED;
        state.mutationError = action.payload ?? 'Unable to create the book.';
      })
      .addCase(updateBook.pending, (state) => {
        state.mutationStatus = RequestStatus.LOADING;
        state.mutationError = null;
      })
      .addCase(updateBook.fulfilled, (state) => {
        state.mutationStatus = RequestStatus.SUCCEEDED;
      })
      .addCase(updateBook.rejected, (state, action) => {
        state.mutationStatus = RequestStatus.FAILED;
        state.mutationError = action.payload ?? 'Unable to update the book.';
      })
      .addCase(deleteBook.pending, (state) => {
        state.mutationStatus = RequestStatus.LOADING;
        state.mutationError = null;
      })
      .addCase(deleteBook.fulfilled, (state) => {
        state.mutationStatus = RequestStatus.SUCCEEDED;
      })
      .addCase(deleteBook.rejected, (state, action) => {
        state.mutationStatus = RequestStatus.FAILED;
        state.mutationError = action.payload ?? 'Unable to delete the book.';
      });
  },
});

export const { resetMutationStatus } = booksSlice.actions;
export default booksSlice.reducer;

export const selectBooks = (state: RootState): Book[] => state.books.items;
export const selectBooksTotal = (state: RootState): number => state.books.total;
export const selectBooksStatus = (state: RootState): RequestStatus => state.books.status;
export const selectBooksError = (state: RootState): string | null => state.books.error;
export const selectBooksMutationStatus = (state: RootState): RequestStatus =>
  state.books.mutationStatus;
export const selectBooksMutationError = (state: RootState): string | null =>
  state.books.mutationError;
