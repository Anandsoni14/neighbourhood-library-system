import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { RootState } from '@/redux/store';
import { render, screen } from '@/tests/test-utils';

import { ProtectedRoute } from './ProtectedRoute';

const authenticatedStaff = {
  staff_id: '1',
  employee_code: 'EMP-1',
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone_number: null,
  role: 'LIBRARIAN' as const,
  status: 'ACTIVE' as const,
};

function renderProtected(preloadedState?: Partial<RootState>) {
  return render(
    <Routes>
      <Route path="/login" element={<div>Login page</div>} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<div>Dashboard content</div>} />
      </Route>
    </Routes>,
    { initialEntries: ['/dashboard'], preloadedState },
  );
}

describe('ProtectedRoute', () => {
  it('redirects to /login when unauthenticated', () => {
    renderProtected();

    expect(screen.getByText('Login page')).toBeVisible();
  });

  it('renders the nested route when authenticated', () => {
    renderProtected({
      auth: { token: 'tok', staff: authenticatedStaff, status: 'succeeded', error: null },
    });

    expect(screen.getByText('Dashboard content')).toBeVisible();
  });

  it('shows a loading indicator while a persisted token is being validated', () => {
    renderProtected({
      auth: { token: 'persisted-token', staff: null, status: 'loading', error: null },
    });

    expect(screen.getByLabelText('Checking session')).toBeVisible();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
  });
});
