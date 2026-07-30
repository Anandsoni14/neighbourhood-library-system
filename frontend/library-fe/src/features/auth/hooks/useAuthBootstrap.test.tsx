import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AUTH_TOKEN_STORAGE_KEY } from '@/redux/slices/authSlice';
import { setupStore } from '@/redux/store';
import { httpClient } from '@/services/httpClient';

import { useAuthBootstrap } from './useAuthBootstrap';

vi.mock('@/services/httpClient', () => ({
  httpClient: { post: vi.fn(), get: vi.fn() },
  attachAuthInterceptors: vi.fn(),
}));

function wrapperFor(store: ReturnType<typeof setupStore>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe('useAuthBootstrap', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('validates a persisted token via GET /auth/me on mount', async () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'persisted-token');
    const staff = {
      staff_id: '1',
      employee_code: 'EMP-1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      phone_number: null,
      role: 'LIBRARIAN' as const,
      status: 'ACTIVE' as const,
    };
    vi.mocked(httpClient.get).mockResolvedValue({ data: staff });
    const store = setupStore({
      auth: { token: 'persisted-token', staff: null, status: 'loading', error: null },
    });

    renderHook(() => useAuthBootstrap(), { wrapper: wrapperFor(store) });

    await waitFor(() => {
      expect(store.getState().auth.staff).toEqual(staff);
    });
    expect(httpClient.get).toHaveBeenCalledWith('/auth/me');
  });

  it('does nothing when there is no token to validate', () => {
    const store = setupStore();

    renderHook(() => useAuthBootstrap(), { wrapper: wrapperFor(store) });

    expect(httpClient.get).not.toHaveBeenCalled();
  });
});
