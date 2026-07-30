import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { render, screen } from '@/tests/test-utils';

import { Header } from './Header';

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

describe('Header', () => {
  it('renders the application title', () => {
    render(<Header />);

    expect(screen.getByRole('heading', { name: 'Neighbour Library' })).toBeVisible();
  });

  it('shows the signed-in staff name and role when authenticated', () => {
    render(<Header />, {
      preloadedState: { auth: { token: 'tok', staff, status: 'succeeded', error: null } },
    });

    expect(screen.getByText('Ada Lovelace')).toBeVisible();
    expect(screen.getByText('LIBRARIAN')).toBeVisible();
  });

  it('does not show staff details when unauthenticated', () => {
    render(<Header />);

    expect(screen.queryByText(/lovelace/i)).not.toBeInTheDocument();
  });

  it('clears the session when the logout button is clicked', async () => {
    const user = userEvent.setup();
    const { store } = render(<Header />, {
      preloadedState: { auth: { token: 'tok', staff, status: 'succeeded', error: null } },
    });

    await user.click(screen.getByRole('button', { name: 'Log out' }));

    expect(store.getState().auth.token).toBeNull();
  });
});
