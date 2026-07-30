import { useCallback } from 'react';

import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  createCopy as createCopyThunk,
  deleteCopy as deleteCopyThunk,
  fetchCopies as fetchCopiesThunk,
  resetMutationStatus,
  selectCopies,
  selectCopiesError,
  selectCopiesMutationError,
  selectCopiesMutationStatus,
  selectCopiesStatus,
  selectCopiesTotal,
  updateCopy as updateCopyThunk,
} from '@/redux/slices/copiesSlice';
import { RequestStatus } from '@/types/common';

import type { BookCopyRequest, BookCopyUpdateRequest, ListCopiesParams } from '../types/copy.types';

/**
 * The seam between the copies inventory UI (CopiesPage, CopyFormDialog) and
 * Redux — mirrors useBooks' shape so every list feature reads the same way.
 */
export function useCopies() {
  const dispatch = useAppDispatch();
  const copies = useAppSelector(selectCopies);
  const total = useAppSelector(selectCopiesTotal);
  const status = useAppSelector(selectCopiesStatus);
  const error = useAppSelector(selectCopiesError);
  const mutationStatus = useAppSelector(selectCopiesMutationStatus);
  const mutationError = useAppSelector(selectCopiesMutationError);

  const fetchCopies = useCallback(
    (params: ListCopiesParams) => dispatch(fetchCopiesThunk(params)),
    [dispatch],
  );

  const createCopy = useCallback(
    (payload: BookCopyRequest) => dispatch(createCopyThunk(payload)),
    [dispatch],
  );

  const updateCopy = useCallback(
    (copyId: string, payload: BookCopyUpdateRequest) =>
      dispatch(updateCopyThunk({ copyId, payload })),
    [dispatch],
  );

  const deleteCopy = useCallback((copyId: string) => dispatch(deleteCopyThunk(copyId)), [dispatch]);

  const clearMutationError = useCallback(() => dispatch(resetMutationStatus()), [dispatch]);

  return {
    copies,
    total,
    error,
    mutationError,
    isLoading: status === RequestStatus.LOADING,
    isMutating: mutationStatus === RequestStatus.LOADING,
    fetchCopies,
    createCopy,
    updateCopy,
    deleteCopy,
    clearMutationError,
  };
}
