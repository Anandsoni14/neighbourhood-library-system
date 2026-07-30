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

const BOOK = {
  book_id: 'b1',
  title: 'Clean Code',
  author: 'Robert C. Martin',
  publisher: null,
  isbn: null,
  category: null,
  description: null,
  published_year: 2008,
};

const MEMBER = {
  member_id: 'm1',
  first_name: 'Grace',
  last_name: 'Hopper',
  email: 'grace@example.com',
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
};

const COPY = {
  copy_id: 'c1',
  book_id: 'b1',
  barcode: 'BC-001',
  shelf_code: 'A1',
  condition: 'GOOD',
  status: 'BORROWED',
  max_borrow_days: 14,
  late_fee_per_day: 5,
};

function seedOverdueLoan() {
  return {
    loan_id: 'l1',
    copy_id: 'c1',
    member_id: 'm1',
    issued_by_staff_id: STAFF_FIXTURE.staff_id,
    received_by_staff_id: null,
    borrowed_at: '2026-07-01T00:00:00Z',
    due_at: '2026-07-15T00:00:00Z',
    returned_at: null,
    borrow_condition: 'GOOD',
    return_condition: null,
    status: 'ACTIVE',
    calculated_fine: 0,
    remarks: null,
    created_at: '2026-07-01T00:00:00Z',
    closed_at: null,
    days_overdue: 15,
    estimated_fine: 75,
  };
}

let overdueLoans: Record<string, unknown>[];

test.beforeEach(async ({ page }) => {
  overdueLoans = [seedOverdueLoan()];

  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      json: { access_token: 'e2e-token', token_type: 'bearer', staff: STAFF_FIXTURE },
    });
  });

  await page.route('**/api/v1/books**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/books') {
      await route.fulfill({ json: { items: [BOOK], total: 1, skip: 0, limit: 1 } });
      return;
    }
    if (url.pathname === `/api/v1/books/${BOOK.book_id}`) {
      await route.fulfill({ json: BOOK });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/v1/members**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/members') {
      await route.fulfill({ json: { items: [MEMBER], total: 1, skip: 0, limit: 1 } });
      return;
    }
    if (url.pathname === `/api/v1/members/${MEMBER.member_id}`) {
      await route.fulfill({ json: MEMBER });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/v1/book-copies**', async (route) => {
    const url = new URL(route.request().url());
    const copyId = url.pathname.split('/').pop();
    if (copyId === COPY.copy_id) {
      await route.fulfill({ json: COPY });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/v1/loans**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/api/v1/loans/overdue') {
      await route.fulfill({
        json: { items: overdueLoans, total: overdueLoans.length, skip: 0, limit: 10 },
      });
      return;
    }

    if (url.pathname === '/api/v1/loans') {
      await route.fulfill({ json: { items: [], total: 2, skip: 0, limit: 1 } });
      return;
    }

    if (request.method() === 'POST' && url.pathname.endsWith('/return')) {
      const payload = request.postDataJSON() as { return_condition: string };
      const loanId = url.pathname.split('/')[url.pathname.split('/').length - 2];
      const now = new Date().toISOString();
      const returned = {
        ...overdueLoans.find((loan) => loan.loan_id === loanId),
        status: 'RETURNED',
        returned_at: now,
        closed_at: now,
        return_condition: payload.return_condition,
        calculated_fine: 75,
      };
      overdueLoans = overdueLoans.filter((loan) => loan.loan_id !== loanId);
      await route.fulfill({ json: returned });
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

test.describe('dashboard', () => {
  test('shows summary counts and the overdue loans report', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Grace Hopper')).toBeVisible();
    await expect(page.getByText(/Clean Code \(BC-001\)/)).toBeVisible();

    await expect(
      page.getByRole('main').getByRole('link', { name: /books/i }),
    ).toHaveAttribute('href', '/books');
  });

  test('returns an overdue loan directly from the dashboard', async ({ page }) => {
    await page.getByRole('button', { name: /return loan/i }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/return condition/i).click();
    await page.getByRole('option', { name: 'Good' }).click();
    await dialog.getByRole('button', { name: 'Return' }).click();

    await expect(page.getByText('No overdue loans.')).toBeVisible();
    await expect(page.getByText(/Loan returned\. Fine: \$75\.00/)).toBeVisible();
  });
});
