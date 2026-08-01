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

function seedMembers() {
  return [
    {
      member_id: 'm1',
      first_name: 'Katherine',
      last_name: 'Johnson',
      email: 'katherine@example.com',
      phone_number: null,
      government_id_type: null,
      government_id_number: null,
      street: null,
      city: null,
      state: null,
      postal_code: null,
      country: null,
      membership_status: 'ACTIVE',
      remarks: null,
    },
  ];
}

let members = seedMembers();

test.beforeEach(async ({ page }) => {
  members = seedMembers();

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
  await page.route('**/api/v1/loans**', (route) =>
    route.fulfill({ json: { items: [], total: 0, skip: 0, limit: 1 } }),
  );
  await page.route('**/api/v1/loans/overdue**', (route) =>
    route.fulfill({ json: { items: [], total: 0, skip: 0, limit: 10 } }),
  );

  await page.route('**/api/v1/members**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'GET') {
      await route.fulfill({ json: { items: members, total: members.length, skip: 0, limit: 25 } });
      return;
    }

    if (request.method() === 'POST') {
      const payload = request.postDataJSON() as Omit<(typeof members)[number], 'member_id'>;
      const created = { ...payload, member_id: `generated-${String(members.length + 1)}` };
      members = [...members, created];
      await route.fulfill({ status: 201, json: created });
      return;
    }

    const memberId = url.pathname.split('/').pop();
    if (request.method() === 'PUT') {
      const payload = request.postDataJSON() as Omit<(typeof members)[number], 'member_id'>;
      members = members.map((member) =>
        member.member_id === memberId ? { ...member, ...payload, member_id: memberId } : member,
      );
      await route.fulfill({ json: members.find((member) => member.member_id === memberId) });
      return;
    }

    if (request.method() === 'DELETE') {
      members = members.filter((member) => member.member_id !== memberId);
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

test.describe('members directory', () => {
  test('navigates to the Members page and lists seeded members', async ({ page }) => {
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /members/i })
      .click();

    await expect(page).toHaveURL(/\/members$/);
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();
    await expect(page.getByText('Katherine Johnson')).toBeVisible();
  });

  test('adds a new member', async ({ page }) => {
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /members/i })
      .click();
    await expect(page).toHaveURL(/\/members$/);

    const dialog = page.getByRole('dialog');
    await page.getByRole('button', { name: 'Add member' }).click();
    await dialog.getByLabel(/first name/i).fill('Ada');
    await dialog.getByLabel(/last name/i).fill('Lovelace');
    await dialog.getByLabel(/^email/i).fill('ada.member@example.com');
    await dialog.getByRole('button', { name: 'Add member' }).click();

    await expect(page.getByText('ada.member@example.com')).toBeVisible();
  });

  test('edits an existing member', async ({ page }) => {
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /members/i })
      .click();
    await expect(page).toHaveURL(/\/members$/);

    await page.getByRole('menuitem', { name: /edit katherine johnson/i }).click();
    const dialog = page.getByRole('dialog');
    const emailField = dialog.getByLabel(/^email/i);
    await emailField.fill('katherine.johnson@example.com');
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByText('katherine.johnson@example.com')).toBeVisible();
  });

  test('deletes a member after confirmation', async ({ page }) => {
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /members/i })
      .click();
    await expect(page).toHaveURL(/\/members$/);

    await page.getByRole('menuitem', { name: /delete katherine johnson/i }).click();
    await page.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText(/no rows/i)).toBeVisible();
  });
});
