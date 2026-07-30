import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { httpClient } from '@/services/httpClient';
import { setupStore } from '@/redux/store';

import { useAuth } from './useAuth';

vi.mock('@/services/httpClient', () => ({
  httpClient: { post: vi.fn(), get: vi.fn() },
  attachAuthInterceptors: vi.fn(),
}));

function wrapperFor(store: ReturnType<typeof setupStore>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe('useAuth', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reports unauthenticated with no token', () => {
    const store = setupStore();
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperFor(store) });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.staff).toBeNull();
  });

  it('logs in and exposes the returned staff record', async () => {
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
    vi.mocked(httpClient.post).mockResolvedValue({
      data: { access_token: 'tok', token_type: 'bearer', staff },
    });

    const store = setupStore();
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperFor(store) });

    await result.current.login({ email: 'ada@example.com', password: 'secret123' });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });
    expect(result.current.staff).toEqual(staff);
  });

  it('logout clears the authenticated state', () => {
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
    const store = setupStore({ auth: { token: 'tok', staff, status: 'succeeded', error: null } });
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperFor(store) });

    result.current.logout();

    expect(store.getState().auth.token).toBeNull();
  });
});
