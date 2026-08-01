import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { staffFixtures } from '@/tests/handlers';
import { server } from '@/tests/server';
import { render, screen, waitFor, within } from '@/tests/test-utils';
import { RequestStatus } from '@/types/common';

import { StaffPage } from './StaffPage';

const API_ORIGIN = 'http://localhost:3000/api/v1';

const adminFixture = {
  staff_id: '99999999-9999-9999-9999-999999999999',
  employee_code: 'EMP-001',
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone_number: null,
  role: 'ADMIN' as const,
  status: 'ACTIVE' as const,
};

const asAdmin = {
  preloadedState: {
    auth: {
      token: 'test-admin-token',
      staff: adminFixture,
      status: RequestStatus.SUCCEEDED,
      error: null,
    },
  },
};

function findRow(text: string) {
  return screen.findByText(text).then((cell) => {
    const row = cell.closest('[role="row"]');
    if (!row) {
      throw new Error(`Expected a DataGrid row containing "${text}"`);
    }
    return row as HTMLElement;
  });
}

describe('StaffPage', () => {
  it('shows a warning instead of the table for non-admins', async () => {
    render(<StaffPage />);

    expect(await screen.findByText(/only admins can manage staff accounts/i)).toBeVisible();
  });

  it('lists staff from the API for admins', async () => {
    render(<StaffPage />, asAdmin);

    expect(await screen.findByText('Priya Singh')).toBeVisible();
    expect(screen.getByText('James Chen')).toBeVisible();
  });

  it('filters the list by employee code, reflecting the filter in the URL', async () => {
    render(<StaffPage />, { ...asAdmin, initialEntries: ['/staff?employeeCode=EMP-003'] });

    expect(await screen.findByText('James Chen')).toBeVisible();
    expect(screen.queryByText('Priya Singh')).not.toBeInTheDocument();
  });

  it('filters by role', async () => {
    render(<StaffPage />, { ...asAdmin, initialEntries: ['/staff?role=Admin'] });

    expect(await screen.findByText('Priya Singh')).toBeVisible();
    expect(screen.queryByText('James Chen')).not.toBeInTheDocument();
  });

  it('filters by status', async () => {
    render(<StaffPage />, { ...asAdmin, initialEntries: ['/staff?status=Inactive'] });

    expect(await screen.findByText('James Chen')).toBeVisible();
    expect(screen.queryByText('Priya Singh')).not.toBeInTheDocument();
  });

  it('adds a new staff member through the dialog', async () => {
    const user = userEvent.setup();
    render(<StaffPage />, asAdmin);
    await screen.findByText('Priya Singh');

    await user.click(screen.getByRole('button', { name: 'Add staff member' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/employee code/i), 'EMP-010');
    await user.type(within(dialog).getByLabelText(/first name/i), 'Grace');
    await user.type(within(dialog).getByLabelText(/last name/i), 'Hopper');
    await user.type(within(dialog).getByLabelText(/^email/i), 'grace@example.com');
    await user.type(within(dialog).getByLabelText(/^password/i), 'password123');
    await user.click(within(dialog).getByRole('button', { name: 'Add staff member' }));

    expect(await screen.findByText('Grace Hopper')).toBeVisible();
  });

  it('edits an existing staff member through the dialog', async () => {
    const user = userEvent.setup();
    render(<StaffPage />, asAdmin);
    const row = await findRow('Priya Singh');

    await user.click(within(row).getByRole('menuitem', { name: /edit priya singh/i }));
    const dialog = screen.getByRole('dialog');
    const emailField = within(dialog).getByLabelText(/^email/i);
    await user.clear(emailField);
    await user.type(emailField, 'priya.s@example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('priya.s@example.com')).toBeVisible();
  });

  it('deactivates and reactivates a staff member', async () => {
    const user = userEvent.setup();
    render(<StaffPage />, asAdmin);
    const row = await findRow('Priya Singh');

    await user.click(within(row).getByRole('menuitem', { name: /deactivate priya singh/i }));

    await waitFor(async () => {
      const updatedRow = await findRow('Priya Singh');
      expect(within(updatedRow).getByText('INACTIVE')).toBeVisible();
    });

    const inactiveRow = await findRow('Priya Singh');
    await user.click(within(inactiveRow).getByRole('menuitem', { name: /activate priya singh/i }));

    await waitFor(async () => {
      const activeRow = await findRow('Priya Singh');
      expect(within(activeRow).getByText('ACTIVE')).toBeVisible();
    });
  });

  it('shows a server error message when the list fails to load', async () => {
    server.use(
      http.get(`${API_ORIGIN}/staff`, () =>
        HttpResponse.json({ detail: 'Something went wrong' }, { status: 500 }),
      ),
    );
    render(<StaffPage />, asAdmin);

    expect(await screen.findByText(/something went wrong/i)).toBeVisible();
  });

  it('renders all seeded staff when unfiltered', async () => {
    render(<StaffPage />, asAdmin);

    for (const member of staffFixtures) {
      expect(await screen.findByText(`${member.first_name} ${member.last_name}`)).toBeVisible();
    }
  });
});
