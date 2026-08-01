import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { memberFixtures } from '@/tests/handlers';
import { server } from '@/tests/server';
import { render, screen, waitFor, within } from '@/tests/test-utils';

import { MembersPage } from './MembersPage';

const API_ORIGIN = 'http://localhost:3000/api/v1';

function findRow(text: string) {
  return screen.findByText(text).then((cell) => {
    const row = cell.closest('[role="row"]');
    if (!row) {
      throw new Error(`Expected a DataGrid row containing "${text}"`);
    }
    return row as HTMLElement;
  });
}

describe('MembersPage', () => {
  it('lists members from the API', async () => {
    render(<MembersPage />);

    expect(await screen.findByText('Ada Lovelace')).toBeVisible();
    expect(screen.getByText('Grace Hopper')).toBeVisible();
  });

  it('filters the list by name, reflecting the filter in the URL', async () => {
    render(<MembersPage />, { initialEntries: ['/members?name=Grace'] });

    expect(await screen.findByText('Grace Hopper')).toBeVisible();
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
  });

  it('filters the list by email', async () => {
    render(<MembersPage />, { initialEntries: ['/members?email=grace'] });

    expect(await screen.findByText('Grace Hopper')).toBeVisible();
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
  });

  it('filters by phone as a substring match', async () => {
    render(<MembersPage />, { initialEntries: ['/members?phone=555123'] });

    expect(await screen.findByText('Ada Lovelace')).toBeVisible();
    expect(screen.queryByText('Grace Hopper')).not.toBeInTheDocument();
  });

  it('filters by status', async () => {
    render(<MembersPage />, { initialEntries: ['/members?status=Blocked'] });

    expect(await screen.findByText('Grace Hopper')).toBeVisible();
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
  });

  it('adds a new member through the dialog', async () => {
    const user = userEvent.setup();
    render(<MembersPage />);
    await screen.findByText('Ada Lovelace');

    await user.click(screen.getByRole('button', { name: 'Add member' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/first name/i), 'Katherine');
    await user.type(within(dialog).getByLabelText(/last name/i), 'Johnson');
    await user.type(within(dialog).getByLabelText(/^email/i), 'katherine@example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Add member' }));

    expect(await screen.findByText('Katherine Johnson')).toBeVisible();
  });

  it('edits an existing member through the dialog', async () => {
    const user = userEvent.setup();
    render(<MembersPage />);
    const row = await findRow('Ada Lovelace');

    await user.click(within(row).getByRole('menuitem', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    const emailField = within(dialog).getByLabelText(/^email/i);
    await user.clear(emailField);
    await user.type(emailField, 'ada.lovelace@example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('ada.lovelace@example.com')).toBeVisible();
  });

  it('deletes a member after confirmation', async () => {
    const user = userEvent.setup();
    render(<MembersPage />);
    const row = await findRow('Ada Lovelace');

    await user.click(within(row).getByRole('menuitem', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Grace Hopper')).toBeVisible();
  });

  it('opens the loan history dialog when a row is clicked', async () => {
    const user = userEvent.setup();
    render(<MembersPage />);
    const row = await findRow('Ada Lovelace');

    await user.click(row);

    expect(await screen.findByRole('dialog')).toBeVisible();
  });

  it('shows a server error message when the list fails to load', async () => {
    server.use(
      http.get(`${API_ORIGIN}/members`, () =>
        HttpResponse.json({ detail: 'Something went wrong' }, { status: 500 }),
      ),
    );
    render(<MembersPage />);

    expect(await screen.findByText(/something went wrong/i)).toBeVisible();
  });

  it('renders all seeded members when unfiltered', async () => {
    render(<MembersPage />);

    for (const member of memberFixtures) {
      expect(await screen.findByText(`${member.first_name} ${member.last_name}`)).toBeVisible();
    }
  });
});
