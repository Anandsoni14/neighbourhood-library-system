import { renderHook, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setupStore } from '@/redux/store';
import { httpClient } from '@/services/httpClient';
import type * as httpClientModule from '@/services/httpClient';
import { CopyCondition, CopyStatus } from '@/types/api';

import { useCopies } from './useCopies';
import { BookCopySortField } from '../types/copy.types';

vi.mock('@/services/httpClient', async (importOriginal) => {
  const actual = await importOriginal<typeof httpClientModule>();
  return {
    ...actual,
    httpClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
    attachAuthInterceptors: vi.fn(),
  };
});

const copy = {
  copy_id: '1',
  book_id: 'b1',
  barcode: 'BC-001',
  shelf_code: null,
  condition: CopyCondition.NEW,
  status: CopyStatus.AVAILABLE,
  max_borrow_days: 14,
  late_fee_per_day: 5,
};

function wrapperFor(store: ReturnType<typeof setupStore>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe('useCopies', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches copies and exposes the resulting list and total', async () => {
    vi.mocked(httpClient.get).mockResolvedValue({ items: [copy], total: 1 });

    const store = setupStore();
    const { result } = renderHook(() => useCopies(), { wrapper: wrapperFor(store) });

    await result.current.fetchCopies({
      skip: 0,
      limit: 25,
      sortBy: BookCopySortField.BARCODE,
      sortDir: 'asc',
    });

    await waitFor(() => {
      expect(result.current.copies).toEqual([copy]);
    });
    expect(result.current.total).toBe(1);
  });

  it('creates a copy and reports the mutation as no longer in flight', async () => {
    vi.mocked(httpClient.post).mockResolvedValue(copy);

    const store = setupStore();
    const { result } = renderHook(() => useCopies(), { wrapper: wrapperFor(store) });

    await result.current.createCopy({ book_id: copy.book_id, barcode: copy.barcode });

    await waitFor(() => {
      expect(result.current.isMutating).toBe(false);
    });
    expect(result.current.mutationError).toBeNull();
  });

  it('surfaces a mutation error and clears it on demand', async () => {
    const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST');
    error.response = {
      status: 409,
      statusText: 'Conflict',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { detail: 'Cannot delete copy: it has active loans' },
    };
    vi.mocked(httpClient.delete).mockRejectedValue(error);

    const store = setupStore();
    const { result } = renderHook(() => useCopies(), { wrapper: wrapperFor(store) });

    await result.current.deleteCopy('1');

    await waitFor(() => {
      expect(result.current.mutationError).toBe('Cannot delete copy: it has active loans');
    });

    result.current.clearMutationError();

    await waitFor(() => {
      expect(result.current.mutationError).toBeNull();
    });
  });
});
