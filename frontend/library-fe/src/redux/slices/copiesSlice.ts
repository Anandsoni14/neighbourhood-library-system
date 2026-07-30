import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { copyService } from '@/features/copies/services/copy.service';
import type {
  BookCopy,
  BookCopyRequest,
  BookCopyUpdateRequest,
  ListCopiesParams,
} from '@/features/copies/types/copy.types';
import type { RootState } from '@/redux/store';
import { RequestStatus } from '@/types/common';
import { getApiErrorMessage } from '@/utils/apiError';

interface CopiesState {
  items: BookCopy[];
  total: number;
  status: RequestStatus;
  error: string | null;
  mutationStatus: RequestStatus;
  mutationError: string | null;
  /** See booksSlice's identical field for the stale-response rationale. */
  latestRequestId: string | null;
}

const initialState: CopiesState = {
  items: [],
  total: 0,
  status: RequestStatus.IDLE,
  error: null,
  mutationStatus: RequestStatus.IDLE,
  mutationError: null,
  latestRequestId: null,
};

export const fetchCopies = createAsyncThunk<
  { items: BookCopy[]; total: number },
  ListCopiesParams,
  { rejectValue: string }
>('copies/fetchCopies', async (params, { rejectWithValue }) => {
  try {
    return await copyService.list(params);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load copies.'));
  }
});

export const createCopy = createAsyncThunk<BookCopy, BookCopyRequest, { rejectValue: string }>(
  'copies/createCopy',
  async (payload, { rejectWithValue }) => {
    try {
      return await copyService.create(payload);
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to create the copy.'));
    }
  },
);

export const updateCopy = createAsyncThunk<
  BookCopy,
  { copyId: string; payload: BookCopyUpdateRequest },
  { rejectValue: string }
>('copies/updateCopy', async ({ copyId, payload }, { rejectWithValue }) => {
  try {
    return await copyService.update(copyId, payload);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to update the copy.'));
  }
});

export const deleteCopy = createAsyncThunk<string, string, { rejectValue: string }>(
  'copies/deleteCopy',
  async (copyId, { rejectWithValue }) => {
    try {
      await copyService.remove(copyId);
      return copyId;
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to delete the copy.'));
    }
  },
);

const copiesSlice = createSlice({
  name: 'copies',
  initialState,
  reducers: {
    resetMutationStatus(state) {
      state.mutationStatus = RequestStatus.IDLE;
      state.mutationError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCopies.pending, (state, action) => {
        state.status = RequestStatus.LOADING;
        state.error = null;
        state.latestRequestId = action.meta.requestId;
      })
      .addCase(fetchCopies.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.latestRequestId) {
          return;
        }
        state.status = RequestStatus.SUCCEEDED;
        state.items = action.payload.items;
        state.total = action.payload.total;
      })
      .addCase(fetchCopies.rejected, (state, action) => {
        if (action.meta.requestId !== state.latestRequestId) {
          return;
        }
        state.status = RequestStatus.FAILED;
        state.error = action.payload ?? 'Unable to load copies.';
      })
      .addCase(createCopy.pending, (state) => {
        state.mutationStatus = RequestStatus.LOADING;
        state.mutationError = null;
      })
      .addCase(createCopy.fulfilled, (state) => {
        state.mutationStatus = RequestStatus.SUCCEEDED;
      })
      .addCase(createCopy.rejected, (state, action) => {
        state.mutationStatus = RequestStatus.FAILED;
        state.mutationError = action.payload ?? 'Unable to create the copy.';
      })
      .addCase(updateCopy.pending, (state) => {
        state.mutationStatus = RequestStatus.LOADING;
        state.mutationError = null;
      })
      .addCase(updateCopy.fulfilled, (state) => {
        state.mutationStatus = RequestStatus.SUCCEEDED;
      })
      .addCase(updateCopy.rejected, (state, action) => {
        state.mutationStatus = RequestStatus.FAILED;
        state.mutationError = action.payload ?? 'Unable to update the copy.';
      })
      .addCase(deleteCopy.pending, (state) => {
        state.mutationStatus = RequestStatus.LOADING;
        state.mutationError = null;
      })
      .addCase(deleteCopy.fulfilled, (state) => {
        state.mutationStatus = RequestStatus.SUCCEEDED;
      })
      .addCase(deleteCopy.rejected, (state, action) => {
        state.mutationStatus = RequestStatus.FAILED;
        state.mutationError = action.payload ?? 'Unable to delete the copy.';
      });
  },
});

export const { resetMutationStatus } = copiesSlice.actions;
export default copiesSlice.reducer;

export const selectCopies = (state: RootState): BookCopy[] => state.copies.items;
export const selectCopiesTotal = (state: RootState): number => state.copies.total;
export const selectCopiesStatus = (state: RootState): RequestStatus => state.copies.status;
export const selectCopiesError = (state: RootState): string | null => state.copies.error;
export const selectCopiesMutationStatus = (state: RootState): RequestStatus =>
  state.copies.mutationStatus;
export const selectCopiesMutationError = (state: RootState): string | null =>
  state.copies.mutationError;
