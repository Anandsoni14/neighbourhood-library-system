import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { categoryService } from '@/features/categories/services/category.service';
import type {
  Category,
  CategoryRequest,
  ListCategoriesParams,
} from '@/features/categories/types/category.types';
import type { RootState } from '@/redux/store';
import { RequestStatus } from '@/types/common';
import { getApiErrorMessage } from '@/utils/apiError';

interface CategoriesState {
  items: Category[];
  total: number;
  status: RequestStatus;
  error: string | null;
  mutationStatus: RequestStatus;
  mutationError: string | null;
  /** See booksSlice's identical field for the stale-response rationale. */
  latestRequestId: string | null;
}

const initialState: CategoriesState = {
  items: [],
  total: 0,
  status: RequestStatus.IDLE,
  error: null,
  mutationStatus: RequestStatus.IDLE,
  mutationError: null,
  latestRequestId: null,
};

export const fetchCategories = createAsyncThunk<
  { items: Category[]; total: number },
  ListCategoriesParams,
  { rejectValue: string }
>('categories/fetchCategories', async (params, { rejectWithValue }) => {
  try {
    return await categoryService.list(params);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load categories.'));
  }
});

export const createCategory = createAsyncThunk<Category, CategoryRequest, { rejectValue: string }>(
  'categories/createCategory',
  async (payload, { rejectWithValue }) => {
    try {
      return await categoryService.create(payload);
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to create the category.'));
    }
  },
);

export const updateCategory = createAsyncThunk<
  Category,
  { categoryId: string; payload: CategoryRequest },
  { rejectValue: string }
>('categories/updateCategory', async ({ categoryId, payload }, { rejectWithValue }) => {
  try {
    return await categoryService.update(categoryId, payload);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to update the category.'));
  }
});

export const archiveCategory = createAsyncThunk<Category, string, { rejectValue: string }>(
  'categories/archiveCategory',
  async (categoryId, { rejectWithValue }) => {
    try {
      return await categoryService.archive(categoryId);
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to archive the category.'));
    }
  },
);

export const unarchiveCategory = createAsyncThunk<Category, string, { rejectValue: string }>(
  'categories/unarchiveCategory',
  async (categoryId, { rejectWithValue }) => {
    try {
      return await categoryService.unarchive(categoryId);
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to unarchive the category.'));
    }
  },
);

const categoriesSlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {
    resetMutationStatus(state) {
      state.mutationStatus = RequestStatus.IDLE;
      state.mutationError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategories.pending, (state, action) => {
        state.status = RequestStatus.LOADING;
        state.error = null;
        state.latestRequestId = action.meta.requestId;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.latestRequestId) {
          return;
        }
        state.status = RequestStatus.SUCCEEDED;
        state.items = action.payload.items;
        state.total = action.payload.total;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        if (action.meta.requestId !== state.latestRequestId) {
          return;
        }
        state.status = RequestStatus.FAILED;
        state.error = action.payload ?? 'Unable to load categories.';
      })
      .addCase(createCategory.pending, (state) => {
        state.mutationStatus = RequestStatus.LOADING;
        state.mutationError = null;
      })
      .addCase(createCategory.fulfilled, (state) => {
        state.mutationStatus = RequestStatus.SUCCEEDED;
      })
      .addCase(createCategory.rejected, (state, action) => {
        state.mutationStatus = RequestStatus.FAILED;
        state.mutationError = action.payload ?? 'Unable to create the category.';
      })
      .addCase(updateCategory.pending, (state) => {
        state.mutationStatus = RequestStatus.LOADING;
        state.mutationError = null;
      })
      .addCase(updateCategory.fulfilled, (state) => {
        state.mutationStatus = RequestStatus.SUCCEEDED;
      })
      .addCase(updateCategory.rejected, (state, action) => {
        state.mutationStatus = RequestStatus.FAILED;
        state.mutationError = action.payload ?? 'Unable to update the category.';
      })
      .addCase(archiveCategory.pending, (state) => {
        state.mutationStatus = RequestStatus.LOADING;
        state.mutationError = null;
      })
      .addCase(archiveCategory.fulfilled, (state) => {
        state.mutationStatus = RequestStatus.SUCCEEDED;
      })
      .addCase(archiveCategory.rejected, (state, action) => {
        state.mutationStatus = RequestStatus.FAILED;
        state.mutationError = action.payload ?? 'Unable to archive the category.';
      })
      .addCase(unarchiveCategory.pending, (state) => {
        state.mutationStatus = RequestStatus.LOADING;
        state.mutationError = null;
      })
      .addCase(unarchiveCategory.fulfilled, (state) => {
        state.mutationStatus = RequestStatus.SUCCEEDED;
      })
      .addCase(unarchiveCategory.rejected, (state, action) => {
        state.mutationStatus = RequestStatus.FAILED;
        state.mutationError = action.payload ?? 'Unable to unarchive the category.';
      });
  },
});

export const { resetMutationStatus } = categoriesSlice.actions;
export default categoriesSlice.reducer;

export const selectCategories = (state: RootState): Category[] => state.categories.items;
export const selectCategoriesTotal = (state: RootState): number => state.categories.total;
export const selectCategoriesStatus = (state: RootState): RequestStatus => state.categories.status;
export const selectCategoriesError = (state: RootState): string | null => state.categories.error;
export const selectCategoriesMutationStatus = (state: RootState): RequestStatus =>
  state.categories.mutationStatus;
export const selectCategoriesMutationError = (state: RootState): string | null =>
  state.categories.mutationError;
