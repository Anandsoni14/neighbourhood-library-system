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

function seedCopies() {
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
let loans: Record<string, unknown>[] = [];

test.beforeEach(async ({ page }) => {
  copies = seedCopies();
  loans = [];

  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      json: { access_token: 'e2e-token', token_type: 'bearer', staff: STAFF_FIXTURE },
    });
  });

  await page.route('**/api/v1/books**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/books') {
      await route.fulfill({ json: { items: [BOOK], total: 1, skip: 0, limit: 25 } });
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
      await route.fulfill({ json: { items: [MEMBER], total: 1, skip: 0, limit: 25 } });
      return;
    }
    if (url.pathname === `/api/v1/members/${MEMBER.member_id}`) {
      await route.fulfill({ json: MEMBER });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/v1/book-copies**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'GET' && url.pathname === '/api/v1/book-copies') {
      const status = url.searchParams.get('status');
      const items = status ? copies.filter((copy) => copy.status === status) : copies;
      await route.fulfill({ json: { items, total: items.length, skip: 0, limit: 50 } });
      return;
    }

    if (request.method() === 'GET') {
      const copyId = url.pathname.split('/').pop();
      const copy = copies.find((candidate) => candidate.copy_id === copyId);
      await route.fulfill({ json: copy });
      return;
    }

    await route.continue();
  });

  await page.route('**/api/v1/loans**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'GET' && url.pathname === '/api/v1/loans') {
      await route.fulfill({ json: { items: loans, total: loans.length, skip: 0, limit: 25 } });
      return;
    }

    // The dashboard every visitor lands on after login fetches this — not
    // exercised by this spec, so a minimal empty response is enough.
    if (request.method() === 'GET' && url.pathname === '/api/v1/loans/overdue') {
      await route.fulfill({ json: { items: [], total: 0, skip: 0, limit: 10 } });
      return;
    }

    if (request.method() === 'POST' && url.pathname === '/api/v1/loans') {
      const payload = request.postDataJSON() as { copy_id: string; member_id: string };
      const now = new Date();
      const due = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const created = {
        loan_id: 'l1',
        copy_id: payload.copy_id,
        member_id: payload.member_id,
        issued_by_staff_id: STAFF_FIXTURE.staff_id,
        received_by_staff_id: null,
        borrowed_at: now.toISOString(),
        due_at: due.toISOString(),
        returned_at: null,
        borrow_condition: 'NEW',
        return_condition: null,
        status: 'ACTIVE',
        calculated_fine: 0,
        remarks: null,
        created_at: now.toISOString(),
        closed_at: null,
      };
      loans = [...loans, created];
      copies = copies.map((copy) =>
        copy.copy_id === payload.copy_id ? { ...copy, status: 'BORROWED' } : copy,
      );
      await route.fulfill({ status: 201, json: created });
      return;
    }

    if (request.method() === 'POST' && url.pathname.endsWith('/return')) {
      const payload = request.postDataJSON() as { return_condition: string };
      const loanId = url.pathname.split('/')[url.pathname.split('/').length - 2];
      const now = new Date().toISOString();
      loans = loans.map((loan) =>
        loan.loan_id === loanId
          ? {
              ...loan,
              status: 'RETURNED',
              returned_at: now,
              closed_at: now,
              return_condition: payload.return_condition,
              calculated_fine: 2.5,
            }
          : loan,
      );
      const updated = loans.find((loan) => loan.loan_id === loanId);
      await route.fulfill({ json: updated });
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

test.describe('loan lifecycle', () => {
  test('issues a loan and then returns it', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: /loans/i }).click();
    await expect(page).toHaveURL(/\/loans$/);

    await page.getByRole('button', { name: 'Issue loan' }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Book').fill('Clean');
    await page.getByText(/Clean Code — Robert C\. Martin/).click();

    await dialog.getByLabel('Copy').click();
    await page.getByText(/BC-001/).click();

    await dialog.getByLabel('Member').fill('Grace');
    await page.getByText(/Grace Hopper/).click();

    await dialog.getByRole('button', { name: 'Issue loan' }).click();

    await expect(page.getByRole('cell', { name: 'ACTIVE' })).toBeVisible();

    await page.getByRole('button', { name: /return loan/i }).click();
    const returnDialog = page.getByRole('dialog');
    await returnDialog.getByLabel(/return condition/i).click();
    await page.getByRole('option', { name: 'Good' }).click();
    await returnDialog.getByRole('button', { name: 'Return' }).click();

    await expect(page.getByRole('cell', { name: 'RETURNED' })).toBeVisible();
    await expect(page.getByText(/Loan returned\. Fine: \$2\.50/)).toBeVisible();
  });
});
