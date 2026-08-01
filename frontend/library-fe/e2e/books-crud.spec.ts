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
      is_archived: false,
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
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({ json: STAFF_FIXTURE });
  });

  // The dashboard every visitor lands on after login fetches these — not
  // exercised by this spec, so a minimal empty response is enough.
  await page.route('**/api/v1/members**', (route) =>
    route.fulfill({ json: { items: [], total: 0, skip: 0, limit: 1 } }),
  );
  await page.route('**/api/v1/loans**', (route) =>
    route.fulfill({ json: { items: [], total: 0, skip: 0, limit: 1 } }),
  );
  await page.route('**/api/v1/loans/overdue**', (route) =>
    route.fulfill({ json: { items: [], total: 0, skip: 0, limit: 10 } }),
  );

  // BooksPage also loads the category filter options and, per row, a
  // copy-count badge — both unrelated to this spec's assertions, but
  // unmocked requests now reach the real local backend (vite preview proxies
  // /api/* since Vite 8) and 401 on the fake test token, logging the
  // session out mid-test.
  await page.route('**/api/v1/categories**', (route) =>
    route.fulfill({ json: { items: [], total: 0, skip: 0, limit: 200 } }),
  );
  await page.route('**/api/v1/book-copies**', (route) =>
    route.fulfill({ json: { items: [], total: 0, skip: 0, limit: 1 } }),
  );

  await page.route('**/api/v1/books**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (method === 'GET') {
      const archivedFilter = url.searchParams.get('archived') ?? 'active';
      const items =
        archivedFilter === 'all'
          ? books
          : books.filter((book) => book.is_archived === (archivedFilter === 'archived'));
      await route.fulfill({ json: { items, total: items.length, skip: 0, limit: 25 } });
      return;
    }

    // Books can only be archived/unarchived, never deleted — there is no
    // DELETE endpoint for books in the API (see api/books.py).
    if (url.pathname.endsWith('/archive') || url.pathname.endsWith('/unarchive')) {
      const isArchiving = url.pathname.endsWith('/archive');
      const bookId = url.pathname.split('/').slice(-2, -1)[0];
      books = books.map((book) =>
        book.book_id === bookId ? { ...book, is_archived: isArchiving } : book,
      );
      await route.fulfill({ json: books.find((book) => book.book_id === bookId) });
      return;
    }

    if (method === 'POST') {
      const payload = request.postDataJSON() as Omit<
        (typeof books)[number],
        'book_id' | 'is_archived'
      >;
      const created = {
        ...payload,
        book_id: `generated-${String(books.length + 1)}`,
        is_archived: false,
      };
      books = [...books, created];
      await route.fulfill({ status: 201, json: created });
      return;
    }

    if (method === 'PUT') {
      const bookId = url.pathname.split('/').pop();
      const payload = request.postDataJSON() as Omit<(typeof books)[number], 'book_id'>;
      books = books.map((book) =>
        book.book_id === bookId ? { ...book, ...payload, book_id: bookId } : book,
      );
      await route.fulfill({ json: books.find((book) => book.book_id === bookId) });
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
  test.describe.configure({ mode: 'serial' });

  test('navigates to the Books page and lists seeded books', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: /books/i }).click();

    await expect(page).toHaveURL(/\/books$/);
    await expect(page.getByRole('heading', { name: 'Books' })).toBeVisible();
    await expect(page.getByText('Clean Code')).toBeVisible();
  });

  test('adds a new book', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: /books/i }).click();
    await expect(page).toHaveURL(/\/books$/);

    const dialog = page.getByRole('dialog');
    await page.getByRole('button', { name: 'Add book' }).click();
    await dialog.getByLabel(/^title/i).fill('Refactoring');
    await dialog.getByLabel(/^author/i).fill('Martin Fowler');
    await dialog.getByRole('button', { name: 'Add book' }).click();

    await expect(page.getByText('Refactoring')).toBeVisible();
  });

  test('edits an existing book', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: /books/i }).click();
    await expect(page).toHaveURL(/\/books$/);

    await page.getByRole('menuitem', { name: 'Edit Clean Code' }).click();
    const dialog = page.getByRole('dialog');
    const titleField = dialog.getByLabel(/^title/i);
    await titleField.fill('Clean Code (2nd Edition)');
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByText('Clean Code (2nd Edition)')).toBeVisible();
  });

  test('archives a book, hiding it when filtered to Active status', async ({ page }) => {
    await page.goto('/books?status=Active');
    await expect(page.getByText('Clean Code')).toBeVisible();

    // Books have no delete action — only archive/unarchive (see
    // api/books.py, which exposes no DELETE /books/{id} route).
    await page.getByRole('menuitem', { name: 'Archive Clean Code' }).click();

    await expect(page.getByText(/no rows/i)).toBeVisible();
  });
});
