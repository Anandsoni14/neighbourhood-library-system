import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/tests/test-utils';

import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders the title and description', () => {
    render(
      <ConfirmDialog
        open
        title="Delete book"
        description={'Delete "Clean Code"? This cannot be undone.'}
        isConfirming={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Delete book' })).toBeVisible();
    expect(screen.getByText('Delete "Clean Code"? This cannot be undone.')).toBeVisible();
  });

  it('defaults the confirm button label to "Delete"', () => {
    render(
      <ConfirmDialog
        open
        title="Delete book"
        description="Are you sure?"
        isConfirming={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible();
  });

  it('supports a custom confirm label', () => {
    render(
      <ConfirmDialog
        open
        title="Return loan"
        description="Return this loan?"
        confirmLabel="Return"
        isConfirming={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Return' })).toBeVisible();
  });

  it('calls onConfirm and onCancel appropriately', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Delete book"
        description="Are you sure?"
        isConfirming={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('disables both buttons while confirming', () => {
    render(
      <ConfirmDialog
        open
        title="Delete book"
        description="Are you sure?"
        isConfirming
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
