import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { copyFixtures } from '@/tests/handlers';
import { server } from '@/tests/server';
import { render, screen, waitFor, within } from '@/tests/test-utils';

import { CopiesPage } from './CopiesPage';

const API_ORIGIN = 'http://localhost:3000/api/v1';
const [firstCopy, secondCopy] = copyFixtures;
if (!firstCopy || !secondCopy) {
  throw new Error('Expected at least two seeded copy fixtures');
}

describe('CopiesPage', () => {
  it('lists copies from the API', async () => {
    render(<CopiesPage />);

    expect(await screen.findByText(firstCopy.barcode)).toBeVisible();
    expect(screen.getByText(secondCopy.barcode)).toBeVisible();
  });

  it('shows an empty state when a filter matches nothing', async () => {
    const user = userEvent.setup();
    render(<CopiesPage />);
    await screen.findByText(firstCopy.barcode);

    await user.type(screen.getByLabelText('Barcode'), 'no-such-barcode');

    expect(await screen.findByText('No copies found.')).toBeVisible();
  });

  it('adds a new copy through the dialog', async () => {
    const user = userEvent.setup();
    render(<CopiesPage />);
    await screen.findByText(firstCopy.barcode);

    await user.click(screen.getByRole('button', { name: 'Add copy' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/book id/i), firstCopy.book_id);
    await user.type(within(dialog).getByLabelText(/barcode/i), 'BC-NEW');
    await user.click(within(dialog).getByRole('button', { name: 'Add copy' }));

    expect(await screen.findByText('BC-NEW')).toBeVisible();
  });

  it('edits an existing copy through the dialog', async () => {
    const user = userEvent.setup();
    render(<CopiesPage />);
    const row = (await screen.findByText(firstCopy.barcode)).closest('tr');
    if (!row) {
      throw new Error('Expected a table row');
    }

    await user.click(within(row).getByRole('button', { name: `Edit ${firstCopy.barcode}` }));
    const dialog = screen.getByRole('dialog');
    const shelfField = within(dialog).getByLabelText(/shelf code/i);
    await user.clear(shelfField);
    await user.type(shelfField, 'Z9');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Z9')).toBeVisible();
  });

  it('deletes a copy after confirmation', async () => {
    const user = userEvent.setup();
    render(<CopiesPage />);
    const row = (await screen.findByText(firstCopy.barcode)).closest('tr');
    if (!row) {
      throw new Error('Expected a table row');
    }

    await user.click(
      within(row).getByRole('button', { name: `Delete ${firstCopy.barcode}` }),
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByText(firstCopy.barcode)).not.toBeInTheDocument();
    });
    expect(screen.getByText(secondCopy.barcode)).toBeVisible();
  });

  it('shows a server error message when the list fails to load', async () => {
    server.use(
      http.get(`${API_ORIGIN}/book-copies`, () =>
        HttpResponse.json({ detail: 'Something went wrong' }, { status: 500 }),
      ),
    );
    render(<CopiesPage />);

    expect(await screen.findByText(/something went wrong/i)).toBeVisible();
  });
});
