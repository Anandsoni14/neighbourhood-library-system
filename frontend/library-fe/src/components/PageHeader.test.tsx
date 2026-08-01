import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/tests/test-utils';

import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders the title as a heading', () => {
    render(<PageHeader title="Books" />);

    expect(screen.getByRole('heading', { name: 'Books' })).toBeVisible();
  });

  it('renders an "Add X" button when actionLabel and onAction are given', () => {
    render(<PageHeader title="Books" actionLabel="Add book" onAction={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Add book' })).toBeVisible();
  });

  it('calls onAction when the button is clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<PageHeader title="Books" actionLabel="Add book" onAction={onAction} />);

    await user.click(screen.getByRole('button', { name: 'Add book' }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('omits the button when actionLabel/onAction are not provided', () => {
    render(<PageHeader title="Staff" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
