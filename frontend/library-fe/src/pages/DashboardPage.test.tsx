import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/tests/server';
import { render, screen, waitFor, within } from '@/tests/test-utils';

import { DashboardPage } from './DashboardPage';

const API_ORIGIN = 'http://localhost:3000/api/v1';

const authenticatedState = {
  auth: {
    token: 'tok',
    staff: {
      staff_id: '1',
      employee_code: 'EMP-1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      phone_number: null,
      role: 'LIBRARIAN' as const,
      status: 'ACTIVE' as const,
    },
    status: 'succeeded' as const,
    error: null,
  },
};

describe('DashboardPage', () => {
  it('renders the page heading', () => {
    render(<DashboardPage />);

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  it('greets the signed-in staff member by first name', () => {
    render(<DashboardPage />, { preloadedState: authenticatedState });

    expect(screen.getByText('Welcome back, Ada.')).toBeVisible();
  });

  it('shows summary counts as clickable links to the relevant page', async () => {
    render(<DashboardPage />);

    const booksLink = await screen.findByRole('link', { name: /books/i });
    expect(booksLink).toHaveAttribute('href', '/books');
    expect(screen.getByRole('link', { name: /members/i })).toHaveAttribute('href', '/members');
  });

  it('lists overdue loans with resolved member and book labels', async () => {
    render(<DashboardPage />);

    expect(await screen.findByText('Ada Lovelace')).toBeVisible();
    expect(screen.getByText(/The Pragmatic Programmer \(BC-002\)/)).toBeVisible();
  });

  it('returns an overdue loan and shows the resulting fine', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);
    await screen.findByText('Ada Lovelace');

    await user.click(screen.getByRole('button', { name: /return loan/i }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByLabelText(/return condition/i));
    await user.click(screen.getByRole('option', { name: 'Good' }));
    await user.click(within(dialog).getByRole('button', { name: 'Return' }));

    await waitFor(() => {
      expect(screen.getByText('No overdue loans.')).toBeVisible();
    });
    expect(await screen.findByText(/Loan returned\. Fine: \$/)).toBeVisible();
  });

  it('shows a server error message when the dashboard fails to load', async () => {
    server.use(
      http.get(`${API_ORIGIN}/loans/overdue`, () =>
        HttpResponse.json({ detail: 'Something went wrong' }, { status: 500 }),
      ),
    );
    render(<DashboardPage />);

    expect(await screen.findByText(/something went wrong/i)).toBeVisible();
  });
});
