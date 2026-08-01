import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { SortDir } from '@/types/common';

import { useDebouncedValue } from './useDebouncedValue';

const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_PAGE_SIZE = 25;

interface UseTableQueryParamsOptions<Filters extends Record<string, string>> {
  defaultFilters: Filters;
  defaultSortField: string;
  defaultSortDir?: SortDir;
  defaultPageSize?: number;
  debounceMs?: number;
}

export interface UseTableQueryParamsResult<Filters extends Record<string, string>> {
  /** Immediate values, for controlling filter inputs without input lag. */
  filters: Filters;
  /** Debounced values — what should actually drive a fetch. */
  debouncedFilters: Filters;
  setFilter: (key: keyof Filters, value: string) => void;
  /** Bulk-replace every filter value at once, e.g. from a DataGrid filter model. */
  setFilters: (next: Filters) => void;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (pageSize: number) => void;
  /** Set page and pageSize together, e.g. from DataGrid's paginationModel. Only
   * resets to page 0 when pageSize actually changed. */
  setPagination: (page: number, pageSize: number) => void;
  sortField: string;
  sortDir: SortDir;
  setSort: (field: string, dir: SortDir) => void;
}

/**
 * Keeps a table's page/pageSize/sort/filters in local state for responsive
 * inputs, debounces filter changes before they're considered "committed",
 * and mirrors the committed state into the URL (`replace`, so typing doesn't
 * spam browser history) so a filtered/sorted/paged view is shareable and
 * survives a refresh.
 */
export function useTableQueryParams<Filters extends Record<string, string>>({
  defaultFilters,
  defaultSortField,
  defaultSortDir = SortDir.ASC,
  defaultPageSize = DEFAULT_PAGE_SIZE,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseTableQueryParamsOptions<Filters>): UseTableQueryParamsResult<Filters> {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterKeys = useMemo(
    () => Object.keys(defaultFilters) as (keyof Filters)[],
    [],
  );

  const [filters, setFiltersState] = useState<Filters>(() => {
    const initial = { ...defaultFilters };
    for (const key of filterKeys) {
      const value = searchParams.get(String(key));
      if (value !== null) {
        initial[key] = value as Filters[typeof key];
      }
    }
    return initial;
  });
  const [page, setPage] = useState(() => Number(searchParams.get('page') ?? 0));
  const [pageSize, setPageSizeState] = useState(() =>
    Number(searchParams.get('pageSize') ?? defaultPageSize),
  );
  const [sortField, setSortField] = useState(() => searchParams.get('sortBy') ?? defaultSortField);
  const [sortDir, setSortDirState] = useState<SortDir>(
    () => (searchParams.get('sortDir') as SortDir | null) ?? defaultSortDir,
  );

  const debouncedFilters = useDebouncedValue(filters, debounceMs);

  useEffect(() => {
    const next = new URLSearchParams();
    for (const key of filterKeys) {
      const value = debouncedFilters[key];
      if (value) {
        next.set(String(key), value);
      }
    }
    if (page > 0) {
      next.set('page', String(page));
    }
    if (pageSize !== defaultPageSize) {
      next.set('pageSize', String(pageSize));
    }
    if (sortField !== defaultSortField) {
      next.set('sortBy', sortField);
    }
    if (sortDir !== defaultSortDir) {
      next.set('sortDir', sortDir);
    }
    setSearchParams(next, { replace: true });
  }, [debouncedFilters, page, pageSize, sortField, sortDir, filterKeys]);

  const setFilter = useCallback((key: keyof Filters, value: string) => {
    setFiltersState((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  }, []);

  const setFilters = useCallback((next: Filters) => {
    setFiltersState(next);
    setPage(0);
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(0);
  }, []);

  const setPagination = useCallback((nextPage: number, nextPageSize: number) => {
    setPageSizeState((prevPageSize) => {
      if (nextPageSize !== prevPageSize) {
        setPage(0);
        return nextPageSize;
      }
      setPage(nextPage);
      return prevPageSize;
    });
  }, []);

  const setSort = useCallback((field: string, dir: SortDir) => {
    setSortField(field);
    setSortDirState(dir);
    setPage(0);
  }, []);

  return {
    filters,
    debouncedFilters,
    setFilter,
    setFilters,
    page,
    setPage,
    pageSize,
    setPageSize,
    setPagination,
    sortField,
    sortDir,
    setSort,
  };
}
