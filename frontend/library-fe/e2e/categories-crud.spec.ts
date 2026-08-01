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

function seedCategories() {
  return [
    {
      category_id: 'c1',
      name: 'Software',
      description: 'Programming books.',
      is_archived: false,
    },
  ];
}

let categories = seedCategories();

test.beforeEach(async ({ page }) => {
  categories = seedCategories();

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
  await page.route('**/api/v1/books**', (route) =>
    route.fulfill({ json: { items: [], total: 0, skip: 0, limit: 1 } }),
  );

  await page.route('**/api/v1/categories**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (method === 'GET') {
      const archivedFilter = url.searchParams.get('archived') ?? 'active';
      const items =
        archivedFilter === 'all'
          ? categories
          : categories.filter(
              (category) => category.is_archived === (archivedFilter === 'archived'),
            );
      await route.fulfill({ json: { items, total: items.length, skip: 0, limit: 25 } });
      return;
    }

    if (url.pathname.endsWith('/archive') || url.pathname.endsWith('/unarchive')) {
      const isArchiving = url.pathname.endsWith('/archive');
      const categoryId = url.pathname.split('/').slice(-2, -1)[0];
      categories = categories.map((category) =>
        category.category_id === categoryId ? { ...category, is_archived: isArchiving } : category,
      );
      await route.fulfill({ json: categories.find((category) => category.category_id === categoryId) });
      return;
    }

    if (method === 'POST') {
      const payload = request.postDataJSON() as Omit<
        (typeof categories)[number],
        'category_id' | 'is_archived'
      >;
      const created = {
        ...payload,
        category_id: `generated-${String(categories.length + 1)}`,
        is_archived: false,
      };
      categories = [...categories, created];
      await route.fulfill({ status: 201, json: created });
      return;
    }

    if (method === 'PUT') {
      const categoryId = url.pathname.split('/').pop();
      const payload = request.postDataJSON() as Omit<(typeof categories)[number], 'category_id'>;
      categories = categories.map((category) =>
        category.category_id === categoryId ? { ...category, ...payload, category_id: categoryId } : category,
      );
      await route.fulfill({ json: categories.find((category) => category.category_id === categoryId) });
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

test.describe('categories catalog', () => {
  test.describe.configure({ mode: 'serial' });

  test('navigates to the Categories page and lists seeded categories', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: /categories/i }).click();

    await expect(page).toHaveURL(/\/categories$/);
    await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();
    await expect(page.getByText('Software')).toBeVisible();
  });

  test('adds a new category', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: /categories/i }).click();
    await expect(page).toHaveURL(/\/categories$/);

    const dialog = page.getByRole('dialog');
    await page.getByRole('button', { name: 'Add category' }).click();
    await dialog.getByLabel(/^name/i).fill('Fiction');
    await dialog.getByRole('button', { name: 'Add category' }).click();

    await expect(page.getByText('Fiction')).toBeVisible();
  });

  test('edits an existing category', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: /categories/i }).click();
    await expect(page).toHaveURL(/\/categories$/);

    await page.getByRole('menuitem', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog');
    const nameField = dialog.getByLabel(/^name/i);
    await nameField.fill('Engineering');
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByText('Engineering')).toBeVisible();
  });

  test('archives a category, hiding it when filtered to Active status', async ({ page }) => {
    await page.goto('/categories?status=Active');
    await expect(page.getByText('Software')).toBeVisible();

    await page.getByRole('menuitem', { name: 'Archive' }).click();

    await expect(page.getByText(/no rows/i)).toBeVisible();
  });
});
