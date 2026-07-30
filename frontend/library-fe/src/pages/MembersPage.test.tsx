import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { memberFixtures } from '@/tests/handlers';
import { server } from '@/tests/server';
import { render, screen, waitFor, within } from '@/tests/test-utils';

import { MembersPage } from './MembersPage';

const API_ORIGIN = 'http://localhost:3000/api/v1';

describe('MembersPage', () => {
  it('lists members from the API', async () => {
    render(<MembersPage />);

    expect(await screen.findByText('Ada')).toBeVisible();
    expect(screen.getByText('Grace')).toBeVisible();
  });

  it('shows an empty state when a filter matches nothing', async () => {
    const user = userEvent.setup();
    render(<MembersPage />);
    await screen.findByText('Ada');

    await user.type(screen.getByLabelText('Name'), 'no such member');

    expect(await screen.findByText('No members found.')).toBeVisible();
  });

  it('filters the list by email', async () => {
    const user = userEvent.setup();
    render(<MembersPage />);
    await screen.findByText('Ada');

    await user.type(screen.getByLabelText('Email'), 'grace');

    await waitFor(() => {
      expect(screen.queryByText('Ada')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Grace')).toBeVisible();
  });

  it('adds a new member through the dialog', async () => {
    const user = userEvent.setup();
    render(<MembersPage />);
    await screen.findByText('Ada');

    await user.click(screen.getByRole('button', { name: 'Add member' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/first name/i), 'Katherine');
    await user.type(within(dialog).getByLabelText(/last name/i), 'Johnson');
    await user.type(within(dialog).getByLabelText(/^email/i), 'katherine@example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Add member' }));

    expect(await screen.findByText('Katherine')).toBeVisible();
  });

  it('edits an existing member through the dialog', async () => {
    const user = userEvent.setup();
    render(<MembersPage />);
    const row = (await screen.findByText('Ada')).closest('tr');
    if (!row) {
      throw new Error('Expected a table row');
    }

    await user.click(within(row).getByRole('button', { name: /edit ada lovelace/i }));
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
    const row = (await screen.findByText('Ada')).closest('tr');
    if (!row) {
      throw new Error('Expected a table row');
    }

    await user.click(within(row).getByRole('button', { name: /delete ada lovelace/i }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByText('Ada')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Grace')).toBeVisible();
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
      expect(await screen.findByText(member.first_name)).toBeVisible();
    }
  });
});
