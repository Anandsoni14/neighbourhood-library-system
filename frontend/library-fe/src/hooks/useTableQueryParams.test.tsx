import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { SortDir } from '@/types/common';

import { useTableQueryParams } from './useTableQueryParams';

// A mapped type (not a plain interface) so it structurally satisfies the
// hook's `Record<string, string>` constraint — see useTableQueryParams.ts.
type Filters = Record<'title' | 'author', string>;

function useHarness(initial?: Partial<Parameters<typeof useTableQueryParams<Filters>>[0]>) {
  const table = useTableQueryParams<Filters>({
    defaultFilters: { title: '', author: '' },
    defaultSortField: 'title',
    ...initial,
  });
  const [searchParams] = useSearchParams();
  return { table, searchParams };
}

function wrapperWithEntries(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  };
}

describe('useTableQueryParams', () => {
  it('starts with the default filters, page, and sort when the URL is empty', () => {
    const { result } = renderHook(() => useHarness(), { wrapper: wrapperWithEntries(['/books']) });

    expect(result.current.table.filters).toEqual({ title: '', author: '' });
    expect(result.current.table.page).toBe(0);
    expect(result.current.table.pageSize).toBe(25);
    expect(result.current.table.sortField).toBe('title');
    expect(result.current.table.sortDir).toBe(SortDir.ASC);
  });

  it('seeds state from existing URL search params', () => {
    const { result } = renderHook(() => useHarness(), {
      wrapper: wrapperWithEntries(['/books?title=Clean&page=2&sortBy=author&sortDir=desc']),
    });

    expect(result.current.table.filters.title).toBe('Clean');
    expect(result.current.table.page).toBe(2);
    expect(result.current.table.sortField).toBe('author');
    expect(result.current.table.sortDir).toBe(SortDir.DESC);
  });

  it('reflects a filter change in the URL only after the debounce settles', async () => {
    const { result } = renderHook(() => useHarness(), { wrapper: wrapperWithEntries(['/books']) });

    act(() => {
      result.current.table.setFilter('title', 'Clean Code');
    });

    // Immediate (controlled-input) value updates right away...
    expect(result.current.table.filters.title).toBe('Clean Code');
    // ...but the URL (driven by the debounced value) does not, yet.
    expect(result.current.searchParams.get('title')).toBeNull();

    await waitFor(() => {
      expect(result.current.searchParams.get('title')).toBe('Clean Code');
    });
  });

  it('resets page to 0 when a filter changes', async () => {
    const { result } = renderHook(() => useHarness(), {
      wrapper: wrapperWithEntries(['/books?page=3']),
    });

    expect(result.current.table.page).toBe(3);

    act(() => {
      result.current.table.setFilter('title', 'x');
    });

    expect(result.current.table.page).toBe(0);
    await waitFor(() => {
      expect(result.current.searchParams.get('page')).toBeNull();
    });
  });

  it('bulk-replaces every filter at once via setFilters', async () => {
    const { result } = renderHook(() => useHarness(), {
      wrapper: wrapperWithEntries(['/books?page=3']),
    });

    act(() => {
      result.current.table.setFilters({ title: 'Clean', author: 'Martin' });
    });

    expect(result.current.table.filters).toEqual({ title: 'Clean', author: 'Martin' });
    expect(result.current.table.page).toBe(0);
    await waitFor(() => {
      expect(result.current.searchParams.get('title')).toBe('Clean');
      expect(result.current.searchParams.get('author')).toBe('Martin');
    });
  });

  it('omits page/pageSize/sort params from the URL when they equal the defaults', async () => {
    const { result } = renderHook(() => useHarness(), {
      wrapper: wrapperWithEntries(['/books?page=2']),
    });

    act(() => {
      result.current.table.setPage(0);
    });

    await waitFor(() => {
      expect(result.current.searchParams.toString()).toBe('');
    });
  });

  it('setPagination navigates to the requested page when pageSize is unchanged', async () => {
    const { result } = renderHook(() => useHarness(), { wrapper: wrapperWithEntries(['/books']) });

    act(() => {
      result.current.table.setPagination(1, 25);
    });

    expect(result.current.table.page).toBe(1);
    expect(result.current.table.pageSize).toBe(25);
    await waitFor(() => {
      expect(result.current.searchParams.get('page')).toBe('1');
    });
  });

  it('setPagination resets to page 0 when pageSize actually changed', async () => {
    const { result } = renderHook(() => useHarness(), {
      wrapper: wrapperWithEntries(['/books?page=3']),
    });

    act(() => {
      result.current.table.setPagination(3, 50);
    });

    expect(result.current.table.page).toBe(0);
    expect(result.current.table.pageSize).toBe(50);
    await waitFor(() => {
      expect(result.current.searchParams.get('pageSize')).toBe('50');
      expect(result.current.searchParams.get('page')).toBeNull();
    });
  });

  it('updates sort field/direction and resets to page 0', async () => {
    const { result } = renderHook(() => useHarness(), {
      wrapper: wrapperWithEntries(['/books?page=1']),
    });

    act(() => {
      result.current.table.setSort('author', SortDir.DESC);
    });

    expect(result.current.table.sortField).toBe('author');
    expect(result.current.table.sortDir).toBe(SortDir.DESC);
    expect(result.current.table.page).toBe(0);
    await waitFor(() => {
      expect(result.current.searchParams.get('sortBy')).toBe('author');
      expect(result.current.searchParams.get('sortDir')).toBe('desc');
    });
  });
});
