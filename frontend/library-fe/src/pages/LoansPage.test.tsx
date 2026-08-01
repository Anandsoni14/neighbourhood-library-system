import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { loanFixtures } from '@/tests/handlers';
import { server } from '@/tests/server';
import { render, screen, waitFor, within } from '@/tests/test-utils';

import { LoansPage } from './LoansPage';

const API_ORIGIN = 'http://localhost:3000/api/v1';
const [seededLoan] = loanFixtures;
if (!seededLoan) {
  throw new Error('Expected at least one seeded loan fixture');
}

function findRow(text: string) {
  return screen.findByText(text).then((cell) => {
    const row = cell.closest('[role="row"]');
    if (!row) {
      throw new Error(`Expected a DataGrid row containing "${text}"`);
    }
    return row as HTMLElement;
  });
}

describe('LoansPage', () => {
  it('lists loans from the API with resolved member and book labels', async () => {
    render(<LoansPage />);

    expect(await screen.findByText('Ada Lovelace')).toBeVisible();
    expect(screen.getByText('The Pragmatic Programmer')).toBeVisible();
    expect(screen.getByText('BC-002')).toBeVisible();
    expect(screen.getByText('ACTIVE')).toBeVisible();
  });

  it('shows an empty state when a filter matches nothing', async () => {
    render(<LoansPage />, { initialEntries: ['/loans?member=no+such+member'] });

    expect(await screen.findByText(/no rows/i)).toBeVisible();
  });

  it('filters by member name, reflecting the filter in the URL', async () => {
    render(<LoansPage />, { initialEntries: ['/loans?member=Ada'] });

    expect(await screen.findByText('Ada Lovelace')).toBeVisible();
  });

  it('filters by book title', async () => {
    render(<LoansPage />, { initialEntries: ['/loans?book=Pragmatic'] });

    expect(await screen.findByText('The Pragmatic Programmer')).toBeVisible();
  });

  it('filters by copy barcode', async () => {
    render(<LoansPage />, { initialEntries: ['/loans?barcode=BC-002'] });

    expect(await screen.findByText('BC-002')).toBeVisible();
  });

  it('issues a new loan through the dialog', async () => {
    const user = userEvent.setup();
    render(<LoansPage />);
    await screen.findByText('Ada Lovelace');

    await user.click(screen.getByRole('button', { name: 'Issue loan' }));
    const dialog = screen.getByRole('dialog');

    await user.type(within(dialog).getByLabelText('Book'), 'Clean');
    await screen.findByText(/Clean Code — Robert C\. Martin/);
    await user.click(screen.getByText(/Clean Code — Robert C\. Martin/));

    await user.click(within(dialog).getByLabelText('Copy'));
    await screen.findByText(/BC-001/);
    await user.click(screen.getByText(/BC-001/));

    await user.type(within(dialog).getByLabelText('Member'), 'Grace');
    await screen.findByText(/Grace Hopper/);
    await user.click(screen.getByText(/Grace Hopper/));

    await user.click(within(dialog).getByRole('button', { name: 'Issue loan' }));

    await waitFor(() => {
      expect(screen.getAllByText('ACTIVE').length).toBeGreaterThan(1);
    });
  });

  it('returns an active loan and shows the resulting fine', async () => {
    const user = userEvent.setup();
    render(<LoansPage />);
    const row = await findRow('Ada Lovelace');

    await user.click(
      within(row).getByRole('menuitem', { name: `Return loan ${seededLoan.loan_id}` }),
    );
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByLabelText(/return condition/i));
    await user.click(screen.getByRole('option', { name: 'Good' }));
    await user.click(within(dialog).getByRole('button', { name: 'Return' }));

    await waitFor(() => {
      expect(screen.getByText('RETURNED')).toBeVisible();
    });
    expect(await screen.findByText(/Loan returned\. Fine: \$0\.00/)).toBeVisible();
  });

  it('shows a server error message when the list fails to load', async () => {
    server.use(
      http.get(`${API_ORIGIN}/loans`, () =>
        HttpResponse.json({ detail: 'Something went wrong' }, { status: 500 }),
      ),
    );
    render(<LoansPage />);

    expect(await screen.findByText(/something went wrong/i)).toBeVisible();
  });
});
