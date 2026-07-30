import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/tests/test-utils';
import { CopyCondition, CopyStatus } from '@/types/api';

import { CopyFormDialog } from './CopyFormDialog';

const copy = {
  copy_id: '1',
  book_id: 'b1',
  barcode: 'BC-001',
  shelf_code: 'A1',
  condition: CopyCondition.GOOD,
  status: CopyStatus.AVAILABLE,
  max_borrow_days: 14,
  late_fee_per_day: 5,
};

describe('CopyFormDialog', () => {
  it('renders blank fields and submits a new copy', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <CopyFormDialog
        open
        copy={null}
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Add copy' })).toBeVisible();
    expect(screen.queryByLabelText(/^status/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/book id/i), 'b1');
    await user.type(screen.getByLabelText(/barcode/i), 'BC-001');
    await user.click(screen.getByRole('button', { name: 'Add copy' }));

    expect(onSubmit).toHaveBeenCalledWith({
      book_id: 'b1',
      barcode: 'BC-001',
      shelf_code: null,
      condition: CopyCondition.NEW,
      max_borrow_days: undefined,
      late_fee_per_day: undefined,
    });
  });

  it('pre-fills fields and includes status when editing', () => {
    render(
      <CopyFormDialog
        open
        copy={copy}
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Edit copy' })).toBeVisible();
    expect(screen.getByDisplayValue('BC-001')).toBeVisible();
    expect(screen.getByLabelText(/^status/i)).toBeVisible();
    expect(screen.getByLabelText(/book id/i)).toBeDisabled();
  });

  it('blocks submission when barcode is missing', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <CopyFormDialog
        open
        copy={null}
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/book id/i), 'b1');
    await user.click(screen.getByRole('button', { name: 'Add copy' }));

    expect(await screen.findByText(/barcode is required/i)).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a non-positive max borrow days', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <CopyFormDialog
        open
        copy={null}
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/book id/i), 'b1');
    await user.type(screen.getByLabelText(/barcode/i), 'BC-001');
    await user.type(screen.getByLabelText(/max borrow days/i), '0');
    await user.click(screen.getByRole('button', { name: 'Add copy' }));

    expect(await screen.findByText(/positive whole number/i)).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the server error passed in', () => {
    render(
      <CopyFormDialog
        open
        copy={null}
        isSubmitting={false}
        error="Barcode already exists."
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText('Barcode already exists.')).toBeVisible();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CopyFormDialog
        open
        copy={null}
        isSubmitting={false}
        error={null}
        onClose={onClose}
        onSubmit={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
  });
});
