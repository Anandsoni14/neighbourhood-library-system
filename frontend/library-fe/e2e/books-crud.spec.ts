import { expect, test } from '@playwright/test';

const STAFF_FIXTURE = {
  staff_id: '11111111-1111-1111-1111-111111111111',
  employee_code: 'EMP-001',
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone_number: null,
  role: 'LIBRARIAN',
  status: 'ACTIVE',
};

function seedBooks() {
  return [
    {
      book_id: 'b1',
      title: 'Clean Code',
      author: 'Robert C. Martin',
      publisher: 'Prentice Hall',
      isbn: '9780132350884',
      category: 'Software',
      description: null,
      published_year: 2008,
    },
  ];
}

let books = seedBooks();

test.beforeEach(async ({ page }) => {
  books = seedBooks();

  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      json: { access_token: 'e2e-token', token_type: 'bearer', staff: STAFF_FIXTURE },
    });
  });

  await page.route('**/api/v1/books**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'GET') {
      await route.fulfill({ json: { items: books, total: books.length, skip: 0, limit: 25 } });
      return;
    }

    if (request.method() === 'POST') {
      const payload = request.postDataJSON() as Omit<(typeof books)[number], 'book_id'>;
      const created = { ...payload, book_id: `generated-${String(books.length + 1)}` };
      books = [...books, created];
      await route.fulfill({ status: 201, json: created });
      return;
    }

    const bookId = url.pathname.split('/').pop();
    if (request.method() === 'PUT') {
      const payload = request.postDataJSON() as Omit<(typeof books)[number], 'book_id'>;
      books = books.map((book) =>
        book.book_id === bookId ? { ...payload, book_id: bookId } : book,
      );
      await route.fulfill({ json: books.find((book) => book.book_id === bookId) });
      return;
    }

    if (request.method() === 'DELETE') {
      books = books.filter((book) => book.book_id !== bookId);
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    await route.continue();
  });

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(STAFF_FIXTURE.email);
  await page.getByLabel(/password/i).fill('secret123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test.describe('books catalog', () => {
  test('navigates to the Books page and lists seeded books', async ({ page }) => {
    await page.getByRole('link', { name: /books/i }).click();

    await expect(page).toHaveURL(/\/books$/);
    await expect(page.getByRole('heading', { name: 'Books' })).toBeVisible();
    await expect(page.getByText('Clean Code')).toBeVisible();
  });

  test('adds a new book', async ({ page }) => {
    await page.getByRole('link', { name: /books/i }).click();
    await expect(page).toHaveURL(/\/books$/);

    const dialog = page.getByRole('dialog');
    await page.getByRole('button', { name: 'Add book' }).click();
    await dialog.getByLabel(/^title/i).fill('Refactoring');
    await dialog.getByLabel(/^author/i).fill('Martin Fowler');
    await dialog.getByRole('button', { name: 'Add book' }).click();

    await expect(page.getByText('Refactoring')).toBeVisible();
  });

  test('edits an existing book', async ({ page }) => {
    await page.getByRole('link', { name: /books/i }).click();
    await expect(page).toHaveURL(/\/books$/);

    await page.getByRole('button', { name: /edit clean code/i }).click();
    const dialog = page.getByRole('dialog');
    const titleField = dialog.getByLabel(/^title/i);
    await titleField.fill('Clean Code (2nd Edition)');
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByText('Clean Code (2nd Edition)')).toBeVisible();
  });

  test('deletes a book after confirmation', async ({ page }) => {
    await page.getByRole('link', { name: /books/i }).click();
    await expect(page).toHaveURL(/\/books$/);

    await page.getByRole('button', { name: /delete clean code/i }).click();
    await page.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText('No books found.')).toBeVisible();
  });
});
