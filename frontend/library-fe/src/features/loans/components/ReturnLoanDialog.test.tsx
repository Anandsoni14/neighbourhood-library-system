import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/tests/test-utils';
import { CopyCondition, LoanStatus } from '@/types/api';

import { ReturnLoanDialog } from './ReturnLoanDialog';

const loan = {
  loan_id: 'l1',
  copy_id: 'c1',
  member_id: 'm1',
  issued_by_staff_id: 's1',
  received_by_staff_id: null,
  borrowed_at: '2026-07-01T00:00:00Z',
  due_at: '2026-07-15T00:00:00Z',
  returned_at: null,
  borrow_condition: CopyCondition.GOOD,
  return_condition: null,
  status: LoanStatus.ACTIVE,
  calculated_fine: 0,
  remarks: null,
  created_at: '2026-07-01T00:00:00Z',
  closed_at: null,
};

describe('ReturnLoanDialog', () => {
  it('submits the selected return condition and remarks', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ReturnLoanDialog
        open
        loan={loan}
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByLabelText(/return condition/i));
    await user.click(screen.getByRole('option', { name: 'Good' }));
    await user.type(screen.getByLabelText(/remarks/i), 'Minor wear');
    await user.click(screen.getByRole('button', { name: 'Return' }));

    expect(onSubmit).toHaveBeenCalledWith({
      return_condition: CopyCondition.GOOD,
      remarks: 'Minor wear',
    });
  });

  it('blocks submission when no condition is selected', () => {
    const onSubmit = vi.fn();
    render(
      <ReturnLoanDialog
        open
        loan={loan}
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    // The submit button stays disabled until a return condition is chosen,
    // rather than allowing a click that then surfaces an error.
    expect(screen.getByRole('button', { name: 'Return' })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the server error passed in', () => {
    render(
      <ReturnLoanDialog
        open
        loan={loan}
        isSubmitting={false}
        error="Loan has already been returned."
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText('Loan has already been returned.')).toBeVisible();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ReturnLoanDialog
        open
        loan={loan}
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
