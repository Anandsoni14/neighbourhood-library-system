import { describe, expect, it } from 'vitest';

import { render, screen } from '@/tests/test-utils';

import { NotFoundPage } from './NotFoundPage';

describe('NotFoundPage', () => {
  it('renders a 404 message with a link back home', () => {
    render(<NotFoundPage />);

    expect(screen.getByText('404')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });
});
