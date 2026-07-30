import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('boots to the login page when no session is persisted', () => {
    // App provides its own Theme/Redux/Router providers, so this uses the
    // plain RTL render rather than @/tests/test-utils to avoid a redundant
    // double wrap. jsdom's default location ("/") is unauthenticated by
    // default, so ProtectedRoute redirects straight to /login.
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
  });
});
