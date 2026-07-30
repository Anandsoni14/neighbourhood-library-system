import { HttpResponse, http } from 'msw';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { server } from '@/tests/server';
import { render, screen } from '@/tests/test-utils';

import { LoginPage } from './LoginPage';

const API_ORIGIN = 'http://localhost:3000/api/v1';

function renderLoginPage(initialEntries = ['/login']) {
  return render(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<div>Dashboard content</div>} />
      <Route path="/reports" element={<div>Reports content</div>} />
    </Routes>,
    { initialEntries },
  );
}

describe('LoginPage', () => {
  it('shows a validation message when submitted empty', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText(/enter both email and password/i)).toBeVisible();
  });

  it('signs in and redirects to the dashboard on success', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Dashboard content')).toBeVisible();
  });

  it('redirects back to the page the user originally requested', async () => {
    const user = userEvent.setup();
    render(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reports" element={<div>Reports content</div>} />
      </Routes>,
      {
        initialEntries: [{ pathname: '/login', state: { from: { pathname: '/reports' } } }],
      },
    );

    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Reports content')).toBeVisible();
  });

  it('shows the server error message on invalid credentials', async () => {
    server.use(
      http.post(`${API_ORIGIN}/auth/login`, () =>
        HttpResponse.json({ detail: 'Invalid email or password' }, { status: 401 }),
      ),
    );
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid email or password')).toBeVisible();
  });
});
