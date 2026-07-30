import { describe, expect, it, vi } from 'vitest';

import { httpClient } from '@/services/httpClient';

import { authService } from './auth.service';

vi.mock('@/services/httpClient', () => ({
  httpClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe('authService', () => {
  it('posts credentials to /auth/login', async () => {
    const responseData = {
      access_token: 'token123',
      token_type: 'bearer',
      staff: {
        staff_id: '1',
        employee_code: 'EMP-1',
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
        phone_number: null,
        role: 'LIBRARIAN',
        status: 'ACTIVE',
      },
    };
    vi.mocked(httpClient.post).mockResolvedValue({ data: responseData });

    const result = await authService.login({ email: 'ada@example.com', password: 'secret123' });

    expect(httpClient.post).toHaveBeenCalledWith('/auth/login', {
      email: 'ada@example.com',
      password: 'secret123',
    });
    expect(result).toEqual(responseData);
  });

  it('fetches the current staff from /auth/me', async () => {
    const staff = {
      staff_id: '1',
      employee_code: 'EMP-1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      phone_number: null,
      role: 'LIBRARIAN',
      status: 'ACTIVE',
    };
    vi.mocked(httpClient.get).mockResolvedValue({ data: staff });

    const result = await authService.getCurrentStaff();

    expect(httpClient.get).toHaveBeenCalledWith('/auth/me');
    expect(result).toEqual(staff);
  });
});
