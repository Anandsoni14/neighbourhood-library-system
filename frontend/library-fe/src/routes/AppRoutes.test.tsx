import { describe, expect, it } from 'vitest';

import type { RootState } from '@/redux/store';
import { render, screen } from '@/tests/test-utils';

import { AppRoutes } from './AppRoutes';

const authenticatedState: Partial<RootState> = {
  auth: {
    token: 'tok',
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
    status: 'succeeded',
    error: null,
  },
};

describe('AppRoutes', () => {
  it('sends an unauthenticated visitor at / to the login page', () => {
    render(<AppRoutes />, { initialEntries: ['/'] });

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  it('redirects an authenticated visitor at / to the dashboard, inside the app shell', async () => {
    render(<AppRoutes />, { initialEntries: ['/'], preloadedState: authenticatedState });

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Neighbour Library' })).toBeVisible();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeVisible();
  });

  it('renders the Books page inside the app shell for an authenticated visitor', async () => {
    render(<AppRoutes />, { initialEntries: ['/books'], preloadedState: authenticatedState });

    expect(await screen.findByRole('heading', { name: 'Books' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Neighbour Library' })).toBeVisible();
  });

  it('renders the 404 page for an unknown path', async () => {
    render(<AppRoutes />, {
      initialEntries: ['/this-page-does-not-exist'],
      preloadedState: authenticatedState,
    });

    expect(await screen.findByText('404')).toBeVisible();
  });

  it('renders the 404 page for an unknown path even when unauthenticated', async () => {
    render(<AppRoutes />, { initialEntries: ['/this-page-does-not-exist'] });

    expect(await screen.findByText('404')).toBeVisible();
  });
});
