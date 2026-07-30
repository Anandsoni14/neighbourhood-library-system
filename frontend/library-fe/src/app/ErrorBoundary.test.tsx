import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from './ErrorBoundary';

function ProblemChild(): never {
  throw new Error('Boom');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs the caught error to the console (twice, in dev) — expected
    // noise for this test, not a real failure.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('All good')).toBeVisible();
  });

  it('renders a fallback UI when a child throws during render', () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeVisible();
  });

  it('logs the caught error', () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>,
    );

    expect(console.error).toHaveBeenCalledWith(
      'Unhandled error in the component tree',
      expect.any(Error),
      expect.anything(),
    );
  });
});
