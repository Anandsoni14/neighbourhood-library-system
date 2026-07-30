import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/tests/test-utils';
import { MembershipStatus } from '@/types/api';

import { MemberFormDialog } from './MemberFormDialog';

const member = {
  member_id: '1',
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone_number: '555-1234',
  government_id_type: 'PASSPORT',
  government_id_number: 'X12345',
  street: '1 Analytical Engine Way',
  city: 'London',
  state: null,
  postal_code: null,
  country: 'UK',
  membership_status: MembershipStatus.ACTIVE,
  remarks: null,
};

describe('MemberFormDialog', () => {
  it('renders blank fields and submits a new member', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <MemberFormDialog
        open
        member={null}
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Add member' })).toBeVisible();
    expect(screen.queryByLabelText(/membership status/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/first name/i), 'Ada');
    await user.type(screen.getByLabelText(/last name/i), 'Lovelace');
    await user.type(screen.getByLabelText(/^email/i), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Add member' }));

    expect(onSubmit).toHaveBeenCalledWith({
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      phone_number: null,
      government_id_type: null,
      government_id_number: null,
      street: null,
      city: null,
      state: null,
      postal_code: null,
      country: null,
      remarks: null,
    });
  });

  it('pre-fills fields and includes membership status when editing', () => {
    render(
      <MemberFormDialog
        open
        member={member}
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Edit member' })).toBeVisible();
    expect(screen.getByDisplayValue('Ada')).toBeVisible();
    expect(screen.getByDisplayValue('Lovelace')).toBeVisible();
    expect(screen.getByLabelText(/membership status/i)).toBeVisible();
  });

  it('blocks submission when required fields are missing', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <MemberFormDialog
        open
        member={null}
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add member' }));

    expect(await screen.findByText(/first name, last name, and email are required/i)).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the server error passed in', () => {
    render(
      <MemberFormDialog
        open
        member={null}
        isSubmitting={false}
        error="Member with email ada@example.com already exists"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText(/already exists/i)).toBeVisible();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MemberFormDialog
        open
        member={null}
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
