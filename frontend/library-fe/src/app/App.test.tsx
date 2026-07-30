import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('renders the application title', () => {
    // App provides its own ThemeProvider, so this uses the plain RTL render
    // rather than @/tests/test-utils to avoid a redundant double wrap.
    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Library Management System' }),
    ).toBeInTheDocument();
  });
});
