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

interface CopyFixture {
  copy_id: string;
  book_id: string;
  barcode: string;
  shelf_code: string | null;
  condition: string;
  status: string;
  max_borrow_days: number;
  late_fee_per_day: number;
}

function seedCopies(): CopyFixture[] {
  return [
    {
      copy_id: 'c1',
      book_id: 'b1',
      barcode: 'BC-001',
      shelf_code: 'A1',
      condition: 'NEW',
      status: 'AVAILABLE',
      max_borrow_days: 14,
      late_fee_per_day: 5,
    },
  ];
}

let copies = seedCopies();

test.beforeEach(async ({ page }) => {
  copies = seedCopies();

  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      json: { access_token: 'e2e-token', token_type: 'bearer', staff: STAFF_FIXTURE },
    });
  });

  // The dashboard every visitor lands on after login fetches these — not
  // exercised by this spec, so a minimal empty response is enough.
  await page.route('**/api/v1/books**', (route) =>
    route.fulfill({ json: { items: [], total: 0, skip: 0, limit: 1 } }),
  );
  await page.route('**/api/v1/members**', (route) =>
    route.fulfill({ json: { items: [], total: 0, skip: 0, limit: 1 } }),
  );
  await page.route('**/api/v1/loans**', (route) =>
    route.fulfill({ json: { items: [], total: 0, skip: 0, limit: 1 } }),
  );
  await page.route('**/api/v1/loans/overdue**', (route) =>
    route.fulfill({ json: { items: [], total: 0, skip: 0, limit: 10 } }),
  );

  await page.route('**/api/v1/book-copies**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'GET' && url.pathname === '/api/v1/book-copies') {
      await route.fulfill({ json: { items: copies, total: copies.length, skip: 0, limit: 25 } });
      return;
    }

    if (request.method() === 'POST') {
      const payload = request.postDataJSON() as {
        book_id: string;
        barcode: string;
        shelf_code?: string | null;
        condition?: string;
        max_borrow_days?: number;
        late_fee_per_day?: number;
      };
      const created = {
        copy_id: `generated-${String(copies.length + 1)}`,
        book_id: payload.book_id,
        barcode: payload.barcode,
        shelf_code: payload.shelf_code ?? null,
        condition: payload.condition ?? 'NEW',
        status: 'AVAILABLE',
        max_borrow_days: payload.max_borrow_days ?? 14,
        late_fee_per_day: payload.late_fee_per_day ?? 5,
      };
      copies = [...copies, created];
      await route.fulfill({ status: 201, json: created });
      return;
    }

    const copyId = url.pathname.split('/').pop();
    if (request.method() === 'PUT') {
      const payload = request.postDataJSON() as Partial<(typeof copies)[number]>;
      copies = copies.map((copy) =>
        copy.copy_id === copyId ? { ...copy, ...payload, copy_id: copyId } : copy,
      );
      await route.fulfill({ json: copies.find((copy) => copy.copy_id === copyId) });
      return;
    }

    if (request.method() === 'DELETE') {
      copies = copies.filter((copy) => copy.copy_id !== copyId);
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

test.describe('copies inventory', () => {
  test('navigates to the Copies page and lists seeded copies', async ({ page }) => {
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /copies/i })
      .click();

    await expect(page).toHaveURL(/\/copies$/);
    await expect(page.getByRole('heading', { name: 'Copies' })).toBeVisible();
    await expect(page.getByText('BC-001')).toBeVisible();
  });

  test('adds a new copy', async ({ page }) => {
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /copies/i })
      .click();
    await expect(page).toHaveURL(/\/copies$/);

    const dialog = page.getByRole('dialog');
    await page.getByRole('button', { name: 'Add copy' }).click();
    await dialog.getByLabel(/book id/i).fill('b1');
    await dialog.getByLabel(/barcode/i).fill('BC-NEW');
    await dialog.getByRole('button', { name: 'Add copy' }).click();

    await expect(page.getByText('BC-NEW')).toBeVisible();
  });

  test('edits an existing copy', async ({ page }) => {
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /copies/i })
      .click();
    await expect(page).toHaveURL(/\/copies$/);

    await page.getByRole('button', { name: 'Edit BC-001' }).click();
    const dialog = page.getByRole('dialog');
    const shelfField = dialog.getByLabel(/shelf code/i);
    await shelfField.fill('Z9');
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByText('Z9')).toBeVisible();
  });

  test('deletes a copy after confirmation', async ({ page }) => {
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /copies/i })
      .click();
    await expect(page).toHaveURL(/\/copies$/);

    await page.getByRole('button', { name: 'Delete BC-001' }).click();
    await page.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText('No copies found.')).toBeVisible();
  });
});
