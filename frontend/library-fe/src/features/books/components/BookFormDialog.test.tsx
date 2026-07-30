import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/tests/test-utils';

import { BookFormDialog } from './BookFormDialog';

const categories = [{ category_id: 'cat-1', name: 'Software', description: null, is_archived: false }];

const book = {
  book_id: '1',
  title: 'Clean Code',
  author: 'Robert C. Martin',
  publisher: 'Prentice Hall',
  isbn: '9780132350884',
  category_id: 'cat-1',
  category: { category_id: 'cat-1', name: 'Software' },
  description: 'A handbook of agile software craftsmanship.',
  published_year: 2008,
  is_archived: false,
};

describe('BookFormDialog', () => {
  it('renders blank fields and submits a new book', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <BookFormDialog
        open
        book={null}
        categories={categories}
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Add book' })).toBeVisible();
    await user.type(screen.getByLabelText(/^title/i), 'Clean Code');
    await user.type(screen.getByLabelText(/^author/i), 'Robert C. Martin');
    await user.click(screen.getByRole('button', { name: 'Add book' }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Clean Code',
      author: 'Robert C. Martin',
      publisher: null,
      isbn: null,
      category_id: null,
      description: null,
      published_year: null,
    });
  });

  it('pre-fills fields from an existing book for editing', () => {
    render(
      <BookFormDialog
        open
        book={book}
        categories={categories}
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Edit book' })).toBeVisible();
    expect(screen.getByDisplayValue('Clean Code')).toBeVisible();
    expect(screen.getByDisplayValue('2008')).toBeVisible();
  });

  it('blocks submission when title or author is missing', () => {
    const onSubmit = vi.fn();
    render(
      <BookFormDialog
        open
        book={null}
        categories={categories}
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    // The submit button stays disabled while required fields are empty,
    // rather than allowing a click that then surfaces a validation message.
    expect(screen.getByRole('button', { name: 'Add book' })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a non-integer published year', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <BookFormDialog
        open
        book={null}
        categories={categories}
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/^title/i), 'Clean Code');
    await user.type(screen.getByLabelText(/^author/i), 'Robert C. Martin');
    await user.type(screen.getByLabelText(/published year/i), 'not-a-year');
    await user.click(screen.getByRole('button', { name: 'Add book' }));

    expect(await screen.findByText(/whole number/i)).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the server error passed in', () => {
    render(
      <BookFormDialog
        open
        book={null}
        categories={categories}
        isSubmitting={false}
        error="ISBN already exists."
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText('ISBN already exists.')).toBeVisible();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <BookFormDialog
        open
        book={null}
        categories={categories}
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
