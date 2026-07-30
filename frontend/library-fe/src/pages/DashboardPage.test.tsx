import { describe, expect, it } from 'vitest';

import { render, screen } from '@/tests/test-utils';

import { DashboardPage } from './DashboardPage';

describe('DashboardPage', () => {
  it('renders the page heading', () => {
    render(<DashboardPage />);

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  it('greets the signed-in staff member by first name', () => {
    render(<DashboardPage />, {
      preloadedState: {
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
      },
    });

    expect(screen.getByText('Welcome back, Ada.')).toBeVisible();
  });
});
