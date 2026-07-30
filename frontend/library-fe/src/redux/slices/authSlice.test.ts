import { describe, expect, it, vi } from 'vitest';

import { RequestStatus } from '@/types/common';

import authReducer, { AUTH_TOKEN_STORAGE_KEY, fetchCurrentStaff, login, logout } from './authSlice';

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

describe('authSlice', () => {
  describe('initial state', () => {
    it('starts idle with no token when localStorage is empty', async () => {
      vi.resetModules();
      const { default: freshReducer } = await import('./authSlice');

      const state = freshReducer(undefined, { type: '@@INIT' });

      expect(state.token).toBeNull();
      expect(state.status).toBe(RequestStatus.IDLE);
    });

    it('starts loading (pending validation) when a token was persisted', async () => {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'persisted-token');
      vi.resetModules();
      const { default: freshReducer } = await import('./authSlice');

      const state = freshReducer(undefined, { type: '@@INIT' });

      expect(state.token).toBe('persisted-token');
      expect(state.status).toBe(RequestStatus.LOADING);
    });
  });

  it('login.fulfilled stores the token and staff, and persists the token', () => {
    const state = authReducer(
      { token: null, staff: null, status: RequestStatus.LOADING, error: null },
      login.fulfilled({ access_token: 'new-token', token_type: 'bearer', staff }, 'requestId', {
        email: 'ada@example.com',
        password: 'secret123',
      }),
    );

    expect(state.token).toBe('new-token');
    expect(state.staff).toEqual(staff);
    expect(state.status).toBe(RequestStatus.SUCCEEDED);
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe('new-token');
  });

  it('login.rejected records the error message without touching the token', () => {
    const state = authReducer(
      { token: null, staff: null, status: RequestStatus.LOADING, error: null },
      login.rejected(
        new Error('rejected'),
        'requestId',
        { email: 'ada@example.com', password: 'wrong' },
        'Invalid email or password',
      ),
    );

    expect(state.status).toBe(RequestStatus.FAILED);
    expect(state.error).toBe('Invalid email or password');
    expect(state.token).toBeNull();
  });

  it('fetchCurrentStaff.fulfilled refreshes the staff record', () => {
    const state = authReducer(
      { token: 'existing-token', staff: null, status: RequestStatus.LOADING, error: null },
      fetchCurrentStaff.fulfilled(staff, 'requestId'),
    );

    expect(state.staff).toEqual(staff);
    expect(state.status).toBe(RequestStatus.SUCCEEDED);
  });

  it('fetchCurrentStaff.rejected clears an invalid persisted token', () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'stale-token');

    const state = authReducer(
      { token: 'stale-token', staff: null, status: RequestStatus.LOADING, error: null },
      fetchCurrentStaff.rejected(new Error('rejected'), 'requestId', undefined, 'expired'),
    );

    expect(state.token).toBeNull();
    expect(state.staff).toBeNull();
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('logout clears the session and the persisted token', () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'some-token');

    const state = authReducer(
      { token: 'some-token', staff, status: RequestStatus.SUCCEEDED, error: null },
      logout(),
    );

    expect(state.token).toBeNull();
    expect(state.staff).toBeNull();
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
  });
});
