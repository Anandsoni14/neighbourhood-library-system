import { expect, test } from '@playwright/test';

const STAFF_FIXTURE = {
  staff_id: '11111111-1111-1111-1111-111111111111',
  employee_code: 'EMP-001',
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone_number: null,
  role: 'ADMIN',
  status: 'ACTIVE',
};

function seedStaff() {
  return [
    {
      staff_id: 's1',
      employee_code: 'EMP-002',
      first_name: 'Priya',
      last_name: 'Singh',
      email: 'priya.singh@example.com',
      phone_number: null,
      role: 'LIBRARIAN',
      status: 'ACTIVE',
    },
  ];
}

let staffList = seedStaff();

test.beforeEach(async ({ page }) => {
  staffList = seedStaff();

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

  await page.route('**/api/v1/staff**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (method === 'GET') {
      const statusFilter = url.searchParams.get('status');
      const items = statusFilter
        ? staffList.filter((member) => member.status === statusFilter)
        : staffList;
      await route.fulfill({ json: { items, total: items.length, skip: 0, limit: 25 } });
      return;
    }

    if (url.pathname.endsWith('/activate') || url.pathname.endsWith('/deactivate')) {
      const isActivating = url.pathname.endsWith('/activate');
      const staffId = url.pathname.split('/').slice(-2, -1)[0];
      staffList = staffList.map((member) =>
        member.staff_id === staffId
          ? { ...member, status: isActivating ? 'ACTIVE' : 'INACTIVE' }
          : member,
      );
      await route.fulfill({ json: staffList.find((member) => member.staff_id === staffId) });
      return;
    }

    if (method === 'POST') {
      const payload = request.postDataJSON() as Omit<
        (typeof staffList)[number],
        'staff_id' | 'status'
      > & { password: string };
      const created = {
        employee_code: payload.employee_code,
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email,
        phone_number: payload.phone_number ?? null,
        role: payload.role ?? 'LIBRARIAN',
        staff_id: `generated-${String(staffList.length + 1)}`,
        status: 'ACTIVE',
      };
      staffList = [...staffList, created];
      await route.fulfill({ status: 201, json: created });
      return;
    }

    if (method === 'PUT') {
      const staffId = url.pathname.split('/').pop();
      const payload = request.postDataJSON() as Omit<(typeof staffList)[number], 'staff_id'>;
      staffList = staffList.map((member) =>
        member.staff_id === staffId ? { ...member, ...payload, staff_id: staffId } : member,
      );
      await route.fulfill({ json: staffList.find((member) => member.staff_id === staffId) });
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

test.describe('staff directory', () => {
  test.describe.configure({ mode: 'serial' });

  test('navigates to the Staff page and lists seeded staff', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: /staff/i }).click();

    await expect(page).toHaveURL(/\/staff$/);
    await expect(page.getByRole('heading', { name: 'Staff' })).toBeVisible();
    await expect(page.getByText('Priya Singh')).toBeVisible();
  });

  test('adds a new staff member', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: /staff/i }).click();
    await expect(page).toHaveURL(/\/staff$/);

    const dialog = page.getByRole('dialog');
    await page.getByRole('button', { name: 'Add staff member' }).click();
    await dialog.getByLabel(/employee code/i).fill('EMP-010');
    await dialog.getByLabel(/first name/i).fill('Grace');
    await dialog.getByLabel(/last name/i).fill('Hopper');
    await dialog.getByLabel(/^email/i).fill('grace@example.com');
    await dialog.getByLabel(/^password/i).fill('password123');
    await dialog.getByRole('button', { name: 'Add staff member' }).click();

    await expect(page.getByText('Grace Hopper')).toBeVisible();
  });

  test('edits an existing staff member', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: /staff/i }).click();
    await expect(page).toHaveURL(/\/staff$/);

    await page.getByRole('menuitem', { name: 'Edit Priya Singh' }).click();
    const dialog = page.getByRole('dialog');
    const emailField = dialog.getByLabel(/^email/i);
    await emailField.fill('priya.s@example.com');
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByText('priya.s@example.com')).toBeVisible();
  });

  test('deactivates a staff member', async ({ page }) => {
    await page.goto('/staff?status=Active');
    await expect(page.getByText('Priya Singh')).toBeVisible();

    await page.getByRole('menuitem', { name: 'Deactivate Priya Singh' }).click();

    await expect(page.getByText(/no rows/i)).toBeVisible();
  });
});
