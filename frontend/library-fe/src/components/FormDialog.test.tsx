import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/tests/test-utils';

import { FormDialog } from './FormDialog';

describe('FormDialog', () => {
  it('renders the title, children, and submit label', () => {
    render(
      <FormDialog
        open
        onClose={vi.fn()}
        title="Add book"
        isSubmitting={false}
        canSubmit
        submitLabel="Add book"
        error={null}
        onSubmit={vi.fn()}
      >
        <input aria-label="Title" />
      </FormDialog>,
    );

    expect(screen.getByRole('heading', { name: 'Add book' })).toBeVisible();
    expect(screen.getByLabelText('Title')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add book' })).toBeVisible();
  });

  it('shows the error alert only when an error is present', () => {
    const { rerender } = render(
      <FormDialog
        open
        onClose={vi.fn()}
        title="Add book"
        isSubmitting={false}
        canSubmit
        submitLabel="Add book"
        error={null}
        onSubmit={vi.fn()}
      >
        <div />
      </FormDialog>,
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    rerender(
      <FormDialog
        open
        onClose={vi.fn()}
        title="Add book"
        isSubmitting={false}
        canSubmit
        submitLabel="Add book"
        error="Something went wrong."
        onSubmit={vi.fn()}
      >
        <div />
      </FormDialog>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
  });

  it('calls onSubmit when the submit button is clicked, and onClose for cancel', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const onClose = vi.fn();
    render(
      <FormDialog
        open
        onClose={onClose}
        title="Add book"
        isSubmitting={false}
        canSubmit
        submitLabel="Add book"
        error={null}
        onSubmit={onSubmit}
      >
        <div />
      </FormDialog>,
    );

    await user.click(screen.getByRole('button', { name: 'Add book' }));
    expect(onSubmit).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('disables the submit button when canSubmit is false, regardless of isSubmitting', () => {
    render(
      <FormDialog
        open
        onClose={vi.fn()}
        title="Add book"
        isSubmitting={false}
        canSubmit={false}
        submitLabel="Add book"
        error={null}
        onSubmit={vi.fn()}
      >
        <div />
      </FormDialog>,
    );

    expect(screen.getByRole('button', { name: 'Add book' })).toBeDisabled();
  });

  it('disables both buttons while submitting', () => {
    render(
      <FormDialog
        open
        onClose={vi.fn()}
        title="Add book"
        isSubmitting
        canSubmit
        submitLabel="Add book"
        error={null}
        onSubmit={vi.fn()}
      >
        <div />
      </FormDialog>,
    );

    expect(screen.getByRole('button', { name: 'Add book' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
