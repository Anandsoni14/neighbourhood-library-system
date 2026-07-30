import { describe, expect, it } from 'vitest';

import { render, screen } from '@/tests/test-utils';

import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  it('renders a Dashboard navigation link', () => {
    render(<Sidebar />);

    const link = screen.getByRole('link', { name: /dashboard/i });
    expect(link).toBeVisible();
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('marks the Dashboard link selected when on /dashboard', () => {
    render(<Sidebar />, { initialEntries: ['/dashboard'] });

    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveClass('Mui-selected');
  });

  it('does not mark the Dashboard link selected on another route', () => {
    render(<Sidebar />, { initialEntries: ['/somewhere-else'] });

    expect(screen.getByRole('link', { name: /dashboard/i })).not.toHaveClass('Mui-selected');
  });

  it('renders a Books navigation link', () => {
    render(<Sidebar />);

    const link = screen.getByRole('link', { name: /books/i });
    expect(link).toBeVisible();
    expect(link).toHaveAttribute('href', '/books');
  });

  it('renders a Members navigation link', () => {
    render(<Sidebar />);

    const link = screen.getByRole('link', { name: /members/i });
    expect(link).toBeVisible();
    expect(link).toHaveAttribute('href', '/members');
  });
});
