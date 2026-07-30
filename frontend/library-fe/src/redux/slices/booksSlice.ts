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
  /**
   * The most recently *dispatched* fetchBooks requestId. Filter/sort/page
   * changes can fire fetches faster than they resolve, so a slow response
   * for a stale filter could otherwise land after a newer one and clobber
   * it — fulfilled/rejected handlers ignore any requestId that doesn't
   * match this, keeping "last dispatched wins" instead of "last resolved wins".
   */
  latestRequestId: string | null;
}

const initialState: BooksState = {
  items: [],
  total: 0,
  status: RequestStatus.IDLE,
  error: null,
  mutationStatus: RequestStatus.IDLE,
  mutationError: null,
  latestRequestId: null,
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

export const archiveBook = createAsyncThunk<Book, string, { rejectValue: string }>(
  'books/archiveBook',
  async (bookId, { rejectWithValue }) => {
    try {
      return await bookService.archive(bookId);
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to archive the book.'));
    }
  },
);

export const unarchiveBook = createAsyncThunk<Book, string, { rejectValue: string }>(
  'books/unarchiveBook',
  async (bookId, { rejectWithValue }) => {
    try {
      return await bookService.unarchive(bookId);
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to unarchive the book.'));
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
      .addCase(fetchBooks.pending, (state, action) => {
        state.status = RequestStatus.LOADING;
        state.error = null;
        state.latestRequestId = action.meta.requestId;
      })
      .addCase(fetchBooks.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.latestRequestId) {
          return;
        }
        state.status = RequestStatus.SUCCEEDED;
        state.items = action.payload.items;
        state.total = action.payload.total;
      })
      .addCase(fetchBooks.rejected, (state, action) => {
        if (action.meta.requestId !== state.latestRequestId) {
          return;
        }
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
      .addCase(archiveBook.pending, (state) => {
        state.mutationStatus = RequestStatus.LOADING;
        state.mutationError = null;
      })
      .addCase(archiveBook.fulfilled, (state) => {
        state.mutationStatus = RequestStatus.SUCCEEDED;
      })
      .addCase(archiveBook.rejected, (state, action) => {
        state.mutationStatus = RequestStatus.FAILED;
        state.mutationError = action.payload ?? 'Unable to archive the book.';
      })
      .addCase(unarchiveBook.pending, (state) => {
        state.mutationStatus = RequestStatus.LOADING;
        state.mutationError = null;
      })
      .addCase(unarchiveBook.fulfilled, (state) => {
        state.mutationStatus = RequestStatus.SUCCEEDED;
      })
      .addCase(unarchiveBook.rejected, (state, action) => {
        state.mutationStatus = RequestStatus.FAILED;
        state.mutationError = action.payload ?? 'Unable to unarchive the book.';
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
