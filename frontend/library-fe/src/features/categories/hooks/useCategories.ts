import { useCallback } from 'react';

import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  archiveCategory as archiveCategoryThunk,
  createCategory as createCategoryThunk,
  fetchCategories as fetchCategoriesThunk,
  resetMutationStatus,
  selectCategories,
  selectCategoriesError,
  selectCategoriesMutationError,
  selectCategoriesMutationStatus,
  selectCategoriesStatus,
  selectCategoriesTotal,
  unarchiveCategory as unarchiveCategoryThunk,
  updateCategory as updateCategoryThunk,
} from '@/redux/slices/categoriesSlice';
import { RequestStatus } from '@/types/common';

import type { CategoryRequest, ListCategoriesParams } from '../types/category.types';

/**
 * The seam between the categories UI (CategoriesPage, CategoryFormDialog) and
 * Redux — mirrors useBooks' shape.
 */
export function useCategories() {
  const dispatch = useAppDispatch();
  const categories = useAppSelector(selectCategories);
  const total = useAppSelector(selectCategoriesTotal);
  const status = useAppSelector(selectCategoriesStatus);
  const error = useAppSelector(selectCategoriesError);
  const mutationStatus = useAppSelector(selectCategoriesMutationStatus);
  const mutationError = useAppSelector(selectCategoriesMutationError);

  const fetchCategories = useCallback(
    (params: ListCategoriesParams) => dispatch(fetchCategoriesThunk(params)),
    [dispatch],
  );

  const createCategory = useCallback(
    (payload: CategoryRequest) => dispatch(createCategoryThunk(payload)),
    [dispatch],
  );

  const updateCategory = useCallback(
    (categoryId: string, payload: CategoryRequest) =>
      dispatch(updateCategoryThunk({ categoryId, payload })),
    [dispatch],
  );

  const archiveCategory = useCallback(
    (categoryId: string) => dispatch(archiveCategoryThunk(categoryId)),
    [dispatch],
  );

  const unarchiveCategory = useCallback(
    (categoryId: string) => dispatch(unarchiveCategoryThunk(categoryId)),
    [dispatch],
  );

  const clearMutationError = useCallback(() => dispatch(resetMutationStatus()), [dispatch]);

  return {
    categories,
    total,
    error,
    mutationError,
    isLoading: status === RequestStatus.LOADING,
    isMutating: mutationStatus === RequestStatus.LOADING,
    fetchCategories,
    createCategory,
    updateCategory,
    archiveCategory,
    unarchiveCategory,
    clearMutationError,
  };
}
