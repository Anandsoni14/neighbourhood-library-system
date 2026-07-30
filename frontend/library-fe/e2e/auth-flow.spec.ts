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

test.describe('app boot', () => {
  test('renders the title', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveTitle('Library Management System');
  });
});

test.describe('unauthenticated', () => {
  test('is redirected from / to the login page', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('shows a 404 page for an unknown route', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');

    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});

test.describe('login', () => {
  test('signs in and lands on the dashboard inside the app shell', async ({ page }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        json: { access_token: 'e2e-token', token_type: 'bearer', staff: STAFF_FIXTURE },
      });
    });

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(STAFF_FIXTURE.email);
    await page.getByLabel(/password/i).fill('secret123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText(`Welcome back, ${STAFF_FIXTURE.first_name}.`)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Library Management System' })).toBeVisible();
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
  });

  test('shows the server error message on invalid credentials', async ({ page }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        json: { detail: 'Invalid email or password' },
      });
    });

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(STAFF_FIXTURE.email);
    await page.getByLabel(/password/i).fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Invalid email or password')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('authenticated session', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        json: { access_token: 'e2e-token', token_type: 'bearer', staff: STAFF_FIXTURE },
      });
    });

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(STAFF_FIXTURE.email);
    await page.getByLabel(/password/i).fill('secret123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('shows a 404 page for an unknown route while signed in', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');

    await expect(page.getByText('404')).toBeVisible();
  });

  test('logs out and returns to the login page', async ({ page }) => {
    await page.getByRole('button', { name: 'Log out' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    // The token is gone, so revisiting a protected route bounces back here.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });
});
