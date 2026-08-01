import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { categoryFixtures } from '@/tests/handlers';
import { server } from '@/tests/server';
import { render, screen, waitFor, within } from '@/tests/test-utils';

import { CategoriesPage } from './CategoriesPage';

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

describe('CategoriesPage', () => {
  it('lists categories from the API', async () => {
    render(<CategoriesPage />);

    expect(await screen.findByText('Software')).toBeVisible();
  });

  it('shows every status by default (no status filter pre-applied)', async () => {
    render(<CategoriesPage />, { initialEntries: ['/categories?status=All'] });

    expect(await screen.findByText('Software')).toBeVisible();
    expect(screen.getByText('History')).toBeVisible();
  });

  it('filters the list by name, reflecting the filter in the URL', async () => {
    render(<CategoriesPage />, { initialEntries: ['/categories?name=Soft'] });

    expect(await screen.findByText('Software')).toBeVisible();
    expect(screen.queryByText('History')).not.toBeInTheDocument();
  });

  it('filters by status', async () => {
    render(<CategoriesPage />, { initialEntries: ['/categories?status=Archived'] });

    expect(await screen.findByText('History')).toBeVisible();
    expect(screen.queryByText('Software')).not.toBeInTheDocument();
  });

  it('adds a new category through the dialog', async () => {
    const user = userEvent.setup();
    render(<CategoriesPage />);
    await screen.findByText('Software');

    await user.click(screen.getByRole('button', { name: 'Add category' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^name/i), 'Fiction');
    await user.click(within(dialog).getByRole('button', { name: 'Add category' }));

    expect(await screen.findByText('Fiction')).toBeVisible();
  });

  it('edits an existing category through the dialog', async () => {
    const user = userEvent.setup();
    render(<CategoriesPage />);
    const row = await findRow('Software');

    await user.click(within(row).getByRole('menuitem', { name: /edit software/i }));
    const dialog = screen.getByRole('dialog');
    const nameField = within(dialog).getByLabelText(/^name/i);
    await user.clear(nameField);
    await user.type(nameField, 'Engineering');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Engineering')).toBeVisible();
  });

  it('archives a category, hiding it when the Active status filter is applied', async () => {
    const user = userEvent.setup();
    render(<CategoriesPage />, { initialEntries: ['/categories?status=Active'] });
    const row = await findRow('Software');

    await user.click(within(row).getByRole('menuitem', { name: /archive software/i }));

    await waitFor(() => {
      expect(screen.queryByText('Software')).not.toBeInTheDocument();
    });
  });

  it('shows a server error message when the list fails to load', async () => {
    server.use(
      http.get(`${API_ORIGIN}/categories`, () =>
        HttpResponse.json({ detail: 'Something went wrong' }, { status: 500 }),
      ),
    );
    render(<CategoriesPage />);

    expect(await screen.findByText(/something went wrong/i)).toBeVisible();
  });

  it('renders all seeded active categories when unfiltered', async () => {
    render(<CategoriesPage />);

    for (const category of categoryFixtures.filter((candidate) => !candidate.is_archived)) {
      expect(await screen.findByText(category.name)).toBeVisible();
    }
  });
});
