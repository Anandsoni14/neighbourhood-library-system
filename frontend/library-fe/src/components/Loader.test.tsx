import { describe, expect, it } from 'vitest';

import { render, screen } from '@/tests/test-utils';

import { Loader } from './Loader';

describe('Loader', () => {
  it('renders a spinner with a default label', () => {
    render(<Loader />);

    expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeVisible();
  });

  it('accepts a custom label', () => {
    render(<Loader label="Checking session" />);

    expect(screen.getByRole('progressbar', { name: 'Checking session' })).toBeVisible();
  });
});
