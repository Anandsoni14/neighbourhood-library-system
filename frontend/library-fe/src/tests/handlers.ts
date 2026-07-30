import { http, HttpResponse } from 'msw';

// Matches the jsdom `url` pinned in vite.config.ts's test.environmentOptions.
// Requests axios sends with a relative baseURL (e.g. `/api/v1/...`) resolve
// against this, so handlers match it explicitly rather than relying on a
// wildcard host pattern.
const API_ORIGIN = 'http://localhost:3000/api/v1';

export const staffFixture = {
  staff_id: '11111111-1111-1111-1111-111111111111',
  employee_code: 'EMP-001',
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone_number: null,
  role: 'LIBRARIAN' as const,
  status: 'ACTIVE' as const,
};

/** Default happy-path handlers; individual tests override with `server.use(...)`. */
export const handlers = [
  http.post(`${API_ORIGIN}/auth/login`, () =>
    HttpResponse.json({
      access_token: 'test-access-token',
      token_type: 'bearer',
      staff: staffFixture,
    }),
  ),
  http.get(`${API_ORIGIN}/auth/me`, () => HttpResponse.json(staffFixture)),
];
