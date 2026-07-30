import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { bookFixtures } from '@/tests/handlers';
import { server } from '@/tests/server';
import { render, screen, waitFor, within } from '@/tests/test-utils';

import { BooksPage } from './BooksPage';

const API_ORIGIN = 'http://localhost:3000/api/v1';

describe('BooksPage', () => {
  it('lists books from the API', async () => {
    render(<BooksPage />);

    expect(await screen.findByText('Clean Code')).toBeVisible();
    expect(screen.getByText('The Pragmatic Programmer')).toBeVisible();
  });

  it('shows an empty state when a filter matches nothing', async () => {
    const user = userEvent.setup();
    render(<BooksPage />);
    await screen.findByText('Clean Code');

    await user.type(screen.getByLabelText('Title'), 'no such book');

    expect(await screen.findByText('No books found.')).toBeVisible();
  });

  it('filters the list by author', async () => {
    const user = userEvent.setup();
    render(<BooksPage />);
    await screen.findByText('Clean Code');

    await user.type(screen.getByLabelText('Author'), 'Hunt');

    await waitFor(() => {
      expect(screen.queryByText('Clean Code')).not.toBeInTheDocument();
    });
    expect(screen.getByText('The Pragmatic Programmer')).toBeVisible();
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
    const row = (await screen.findByText('Clean Code')).closest('tr');
    if (!row) {
      throw new Error('Expected a table row');
    }

    await user.click(within(row).getByRole('button', { name: /edit clean code/i }));
    const dialog = screen.getByRole('dialog');
    const titleField = within(dialog).getByLabelText(/^title/i);
    await user.clear(titleField);
    await user.type(titleField, 'Clean Code (2nd Edition)');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Clean Code (2nd Edition)')).toBeVisible();
  });

  it('archives a book, hiding it from the default active list', async () => {
    const user = userEvent.setup();
    render(<BooksPage />);
    const row = (await screen.findByText('Clean Code')).closest('tr');
    if (!row) {
      throw new Error('Expected a table row');
    }

    await user.click(within(row).getByRole('button', { name: /archive clean code/i }));

    await waitFor(() => {
      expect(screen.queryByText('Clean Code')).not.toBeInTheDocument();
    });
    expect(screen.getByText('The Pragmatic Programmer')).toBeVisible();
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
