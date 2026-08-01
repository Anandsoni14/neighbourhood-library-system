import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setupStore } from '@/redux/store';
import { httpClient } from '@/services/httpClient';
import type * as httpClientModule from '@/services/httpClient';

import { useDashboard } from './useDashboard';

vi.mock('@/services/httpClient', async (importOriginal) => {
  const actual = await importOriginal<typeof httpClientModule>();
  return {
    ...actual,
    httpClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
    attachAuthInterceptors: vi.fn(),
  };
});

function wrapperFor(store: ReturnType<typeof setupStore>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe('useDashboard', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches summary counts', async () => {
    vi.mocked(httpClient.get).mockImplementation((url: string) => {
      if (url === '/loans/overdue') {
        return Promise.resolve({ items: [], total: 1, skip: 0, limit: 1 });
      }
      return Promise.resolve({ items: [], total: 3, skip: 0, limit: 1 });
    });

    const store = setupStore();
    const { result } = renderHook(() => useDashboard(), { wrapper: wrapperFor(store) });

    await result.current.fetchDashboard();

    await waitFor(() => {
      expect(result.current.counts).toEqual({
        books: 3,
        members: 3,
        activeLoans: 3,
        overdueLoans: 1,
      });
    });
    expect(result.current.isLoading).toBe(false);
  });
});
