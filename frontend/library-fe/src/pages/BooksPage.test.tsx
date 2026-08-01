import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { bookFixtures } from '@/tests/handlers';
import { server } from '@/tests/server';
import { render, screen, waitFor, within } from '@/tests/test-utils';

import { BooksPage } from './BooksPage';

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

describe('BooksPage', () => {
  it('lists books from the API', async () => {
    render(<BooksPage />);

    expect(await screen.findByText('Clean Code')).toBeVisible();
    expect(screen.getByText('The Pragmatic Programmer')).toBeVisible();
  });

  it('shows an empty state when a filter matches nothing', async () => {
    render(<BooksPage />, { initialEntries: ['/books?title=no+such+book'] });

    expect(await screen.findByText(/no rows/i)).toBeVisible();
  });

  it('filters the list by author, reflecting the filter in the URL', async () => {
    render(<BooksPage />, { initialEntries: ['/books?author=Hunt'] });

    expect(await screen.findByText('The Pragmatic Programmer')).toBeVisible();
    expect(screen.queryByText('Clean Code')).not.toBeInTheDocument();
  });

  it('filters by ISBN as a substring match', async () => {
    render(<BooksPage />, { initialEntries: ['/books?isbn=0132350'] });

    expect(await screen.findByText('Clean Code')).toBeVisible();
    expect(screen.queryByText('The Pragmatic Programmer')).not.toBeInTheDocument();
  });

  it('filters by stock (whether a book has an available copy)', async () => {
    render(<BooksPage />, { initialEntries: ['/books?stock=Out+of+Stock'] });

    expect(await screen.findByText('The Pragmatic Programmer')).toBeVisible();
    expect(screen.queryByText('Clean Code')).not.toBeInTheDocument();
  });

  it('adds a new book through the dialog', async () => {
    const user = userEvent.setup();
    render(<BooksPage />);
    await screen.findByText('Clean Code');

    await user.click(screen.getByRole('button', { name: 'Add book' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^title/i), 'Refactoring');
    await user.type(within(dialog).getByLabelText(/^author/i), 'Martin Fowler');
    await user.click(within(dialog).getByRole('button', { name: 'Add book' }));

    expect(await screen.findByText('Refactoring')).toBeVisible();
  });

  it('edits an existing book through the dialog', async () => {
    const user = userEvent.setup();
    render(<BooksPage />);
    const row = await findRow('Clean Code');

    await user.click(within(row).getByRole('menuitem', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    const titleField = within(dialog).getByLabelText(/^title/i);
    await user.clear(titleField);
    await user.type(titleField, 'Clean Code (2nd Edition)');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Clean Code (2nd Edition)')).toBeVisible();
  });

  it('archives a book, hiding it when the Active status filter is applied', async () => {
    const user = userEvent.setup();
    render(<BooksPage />, { initialEntries: ['/books?status=Active'] });
    const row = await findRow('Clean Code');

    await user.click(within(row).getByRole('menuitem', { name: 'Archive' }));

    await waitFor(() => {
      expect(screen.queryByText('Clean Code')).not.toBeInTheDocument();
    });
    expect(screen.getByText('The Pragmatic Programmer')).toBeVisible();
  });

  it('shows every status by default (no status filter pre-applied)', async () => {
    render(<BooksPage />);

    expect(await screen.findByText('Clean Code')).toBeVisible();
    // The Status column header shouldn't show an active-filter indicator.
    expect(screen.queryByRole('button', { name: 'Show filters' })).not.toBeInTheDocument();
  });

  it('opens the copies dialog when a row is clicked', async () => {
    const user = userEvent.setup();
    render(<BooksPage />);
    const row = await findRow('Clean Code');

    await user.click(row);

    expect(await screen.findByRole('dialog')).toBeVisible();
  });

  it('shows a server error message when the list fails to load', async () => {
    server.use(
      http.get(`${API_ORIGIN}/books`, () =>
        HttpResponse.json({ detail: 'Something went wrong' }, { status: 500 }),
      ),
    );
    render(<BooksPage />);

    expect(await screen.findByText(/something went wrong/i)).toBeVisible();
  });

  it('renders all seeded books when unfiltered', async () => {
    render(<BooksPage />);

    for (const book of bookFixtures) {
      expect(await screen.findByText(book.title)).toBeVisible();
    }
  });
});
