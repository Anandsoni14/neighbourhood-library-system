import { http, HttpResponse } from 'msw';

import type { Book } from '@/features/books/types/book.types';
import type { Category } from '@/features/categories/types/category.types';
import type { BookCopy } from '@/features/copies/types/copy.types';
import type { Loan } from '@/features/loans/types/loan.types';
import type { Member } from '@/features/members/types/member.types';
import type { Staff } from '@/features/staff/types/staff.types';

// Matches the jsdom `url` pinned in vite.config.ts's test.environmentOptions.
// Requests axios sends with a relative baseURL (e.g. `/api/v1/...`) resolve
// against this, so handlers match it explicitly rather than relying on a
// wildcard host pattern.
const API_ORIGIN = 'http://localhost:3000/api/v1';

export const staffFixture = {
  staff_id: '11111111-1111-1111-1111-111111111111',
  employee_code: 'EMP-001',
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone_number: null,
  role: 'LIBRARIAN' as const,
  status: 'ACTIVE' as const,
};

export const staffFixtures: Staff[] = [
  {
    staff_id: '88888888-8888-8888-8888-888888888881',
    employee_code: 'EMP-002',
    first_name: 'Priya',
    last_name: 'Singh',
    email: 'priya.singh@example.com',
    phone_number: '9990000001',
    role: 'ADMIN',
    status: 'ACTIVE',
  },
  {
    staff_id: '88888888-8888-8888-8888-888888888882',
    employee_code: 'EMP-003',
    first_name: 'James',
    last_name: 'Chen',
    email: 'james.chen@example.com',
    phone_number: null,
    role: 'LIBRARIAN',
    status: 'INACTIVE',
  },
];

export const categoryFixtures: Category[] = [
  {
    category_id: '66666666-6666-6666-6666-666666666661',
    name: 'Software',
    description: 'Programming and software engineering.',
    is_archived: false,
  },
  {
    category_id: '66666666-6666-6666-6666-666666666662',
    name: 'History',
    description: null,
    is_archived: true,
  },
];

export const bookFixtures: Book[] = [
  {
    book_id: '22222222-2222-2222-2222-222222222221',
    title: 'Clean Code',
    author: 'Robert C. Martin',
    publisher: 'Prentice Hall',
    isbn: '9780132350884',
    category_id: '66666666-6666-6666-6666-666666666661',
    category: { category_id: '66666666-6666-6666-6666-666666666661', name: 'Software' },
    description: 'A handbook of agile software craftsmanship.',
    published_year: 2008,
    is_archived: false,
  },
  {
    book_id: '22222222-2222-2222-2222-222222222222',
    title: 'The Pragmatic Programmer',
    author: 'Andrew Hunt',
    publisher: 'Addison-Wesley',
    isbn: '9780135957059',
    category_id: '66666666-6666-6666-6666-666666666661',
    category: { category_id: '66666666-6666-6666-6666-666666666661', name: 'Software' },
    description: null,
    published_year: 2019,
    is_archived: false,
  },
];

export const memberFixtures: Member[] = [
  {
    member_id: '33333333-3333-3333-3333-333333333331',
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.com',
    phone_number: '5551234567',
    government_id_type: 'PASSPORT',
    government_id_number: 'X12345',
    street: '1 Analytical Engine Way',
    city: 'London',
    state: null,
    postal_code: null,
    country: 'UK',
    membership_status: 'ACTIVE',
    remarks: null,
  },
  {
    member_id: '33333333-3333-3333-3333-333333333332',
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
    membership_status: 'BLOCKED',
    remarks: null,
  },
];

const FIRST_BOOK_ID = '22222222-2222-2222-2222-222222222221';
const SECOND_BOOK_ID = '22222222-2222-2222-2222-222222222222';
const FIRST_COPY_ID = '44444444-4444-4444-4444-444444444441';
const SECOND_COPY_ID = '44444444-4444-4444-4444-444444444442';
const FIRST_MEMBER_ID = '33333333-3333-3333-3333-333333333331';

export const copyFixtures: BookCopy[] = [
  {
    copy_id: FIRST_COPY_ID,
    book_id: FIRST_BOOK_ID,
    barcode: 'BC-001',
    shelf_code: 'A1',
    condition: 'NEW',
    status: 'AVAILABLE',
    max_borrow_days: 14,
    late_fee_per_day: 5,
  },
  {
    copy_id: SECOND_COPY_ID,
    book_id: SECOND_BOOK_ID,
    barcode: 'BC-002',
    shelf_code: 'B2',
    condition: 'GOOD',
    status: 'BORROWED',
    max_borrow_days: 14,
    late_fee_per_day: 5,
  },
];

export const loanFixtures: Loan[] = [
  {
    loan_id: '55555555-5555-5555-5555-555555555551',
    copy_id: SECOND_COPY_ID,
    member_id: FIRST_MEMBER_ID,
    issued_by_staff_id: staffFixture.staff_id,
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
  },
];

/**
 * A mutable working copy so POST/PUT/DELETE handlers can simulate real
 * persistence within a test. `resetBooks` (called from setup.ts's afterEach)
 * restores it from `bookFixtures` so tests don't leak state into each other.
 */
let books = bookFixtures.map((book) => ({ ...book }));

export function resetBooks(): void {
  books = bookFixtures.map((book) => ({ ...book }));
}

/** Same rationale as `resetBooks`, for the category fixture store. */
let categories = categoryFixtures.map((category) => ({ ...category }));

export function resetCategories(): void {
  categories = categoryFixtures.map((category) => ({ ...category }));
}

/** Same rationale as `resetBooks`, for the member fixture store. */
let members = memberFixtures.map((member) => ({ ...member }));

export function resetMembers(): void {
  members = memberFixtures.map((member) => ({ ...member }));
}

/** Same rationale as `resetBooks`, for the copy fixture store. */
let copies = copyFixtures.map((copy) => ({ ...copy }));

export function resetCopies(): void {
  copies = copyFixtures.map((copy) => ({ ...copy }));
}

/** Same rationale as `resetBooks`, for the loan fixture store. */
let loans = loanFixtures.map((loan) => ({ ...loan }));

export function resetLoans(): void {
  loans = loanFixtures.map((loan) => ({ ...loan }));
}

/** Same rationale as `resetBooks`, for the staff fixture store. */
let staffList = staffFixtures.map((member) => ({ ...member }));

export function resetStaff(): void {
  staffList = staffFixtures.map((member) => ({ ...member }));
}

function matches(value: string | null, query: string | null, exact = false): boolean {
  if (!query) {
    return true;
  }
  if (value === null) {
    return false;
  }
  return exact ? value === query : value.toLowerCase().includes(query.toLowerCase());
}

/** Default happy-path handlers; individual tests override with `server.use(...)`. */
export const handlers = [
  http.post(`${API_ORIGIN}/auth/login`, () =>
    HttpResponse.json({
      access_token: 'test-access-token',
      token_type: 'bearer',
      staff: staffFixture,
    }),
  ),
  http.get(`${API_ORIGIN}/auth/me`, () => HttpResponse.json(staffFixture)),

  http.get(`${API_ORIGIN}/categories`, ({ request }) => {
    const url = new URL(request.url);
    const skip = Number(url.searchParams.get('skip') ?? '0');
    const limit = Number(url.searchParams.get('limit') ?? '100');
    const name = url.searchParams.get('name');
    const archived = url.searchParams.get('archived') ?? 'active';

    const filtered = categories.filter(
      (category) =>
        matches(category.name, name) &&
        (archived === 'all' ? true : archived === 'archived' ? category.is_archived : !category.is_archived),
    );
    const page = filtered.slice(skip, skip + limit);

    return HttpResponse.json({ items: page, total: filtered.length, skip, limit });
  }),

  http.post(`${API_ORIGIN}/categories`, async ({ request }) => {
    const body = (await request.json()) as { name: string; description?: string | null };
    const created = {
      category_id: `generated-category-${String(categories.length + 1)}`,
      name: body.name,
      description: body.description ?? null,
      is_archived: false,
    };
    categories = [...categories, created];
    return HttpResponse.json(created, { status: 201 });
  }),

  http.put(`${API_ORIGIN}/categories/:categoryId`, async ({ request, params }) => {
    const body = (await request.json()) as { name?: string; description?: string | null };
    const index = categories.findIndex((category) => category.category_id === params.categoryId);
    const existing = categories[index];
    if (index === -1 || !existing) {
      return HttpResponse.json({ detail: 'Category not found' }, { status: 404 });
    }
    const updated = { ...existing, ...body };
    categories = [...categories.slice(0, index), updated, ...categories.slice(index + 1)];
    return HttpResponse.json(updated);
  }),

  http.post(`${API_ORIGIN}/categories/:categoryId/archive`, ({ params }) => {
    const index = categories.findIndex((category) => category.category_id === params.categoryId);
    const existing = categories[index];
    if (index === -1 || !existing) {
      return HttpResponse.json({ detail: 'Category not found' }, { status: 404 });
    }
    const updated = { ...existing, is_archived: true };
    categories = [...categories.slice(0, index), updated, ...categories.slice(index + 1)];
    return HttpResponse.json(updated);
  }),

  http.post(`${API_ORIGIN}/categories/:categoryId/unarchive`, ({ params }) => {
    const index = categories.findIndex((category) => category.category_id === params.categoryId);
    const existing = categories[index];
    if (index === -1 || !existing) {
      return HttpResponse.json({ detail: 'Category not found' }, { status: 404 });
    }
    const updated = { ...existing, is_archived: false };
    categories = [...categories.slice(0, index), updated, ...categories.slice(index + 1)];
    return HttpResponse.json(updated);
  }),

  http.get(`${API_ORIGIN}/books`, ({ request }) => {
    const url = new URL(request.url);
    const skip = Number(url.searchParams.get('skip') ?? '0');
    const limit = Number(url.searchParams.get('limit') ?? '100');
    const title = url.searchParams.get('title');
    const author = url.searchParams.get('author');
    const categoryId = url.searchParams.get('category_id');
    const isbn = url.searchParams.get('isbn');
    const archived = url.searchParams.get('archived') ?? 'active';
    const inStockParam = url.searchParams.get('in_stock');
    const sortBy = (url.searchParams.get('sort_by') ?? 'title') as keyof (typeof books)[number];
    const sortDir = url.searchParams.get('sort_dir') ?? 'asc';

    const hasAvailableCopy = (bookId: string) =>
      copies.some((copy) => copy.book_id === bookId && copy.status === 'AVAILABLE');

    const filtered = books.filter(
      (book) =>
        matches(book.title, title) &&
        matches(book.author, author) &&
        (categoryId ? book.category_id === categoryId : true) &&
        matches(book.isbn, isbn) &&
        (archived === 'all'
          ? true
          : archived === 'archived'
            ? book.is_archived
            : !book.is_archived) &&
        (inStockParam === null ? true : hasAvailableCopy(book.book_id) === (inStockParam === 'true')),
    );

    const sorted = [...filtered].sort((a, b) => {
      const left = sortBy === 'category' ? a.category?.name : a[sortBy];
      const right = sortBy === 'category' ? b.category?.name : b[sortBy];
      if (left === right) {
        return 0;
      }
      const direction = left != null && right != null && left > right ? 1 : -1;
      return sortDir === 'desc' ? -direction : direction;
    });

    const page = sorted.slice(skip, skip + limit);

    return HttpResponse.json({ items: page, total: filtered.length, skip, limit });
  }),

  http.post(`${API_ORIGIN}/books`, async ({ request }) => {
    const body = (await request.json()) as {
      title: string;
      author: string;
      publisher?: string | null;
      isbn?: string | null;
      category_id?: string | null;
      description?: string | null;
      published_year?: number | null;
    };
    const category = categories.find((candidate) => candidate.category_id === body.category_id);
    const created = {
      book_id: `generated-${String(books.length + 1)}`,
      title: body.title,
      author: body.author,
      publisher: body.publisher ?? null,
      isbn: body.isbn ?? null,
      category_id: body.category_id ?? null,
      category: category ? { category_id: category.category_id, name: category.name } : null,
      description: body.description ?? null,
      published_year: body.published_year ?? null,
      is_archived: false,
    };
    books = [...books, created];
    return HttpResponse.json(created, { status: 201 });
  }),

  http.get(`${API_ORIGIN}/books/:bookId`, ({ params }) => {
    const book = books.find((candidate) => candidate.book_id === params.bookId);
    if (!book) {
      return HttpResponse.json({ detail: 'Book not found' }, { status: 404 });
    }
    return HttpResponse.json(book);
  }),

  http.put(`${API_ORIGIN}/books/:bookId`, async ({ request, params }) => {
    const body = (await request.json()) as {
      title: string;
      author: string;
      publisher?: string | null;
      isbn?: string | null;
      category_id?: string | null;
      description?: string | null;
      published_year?: number | null;
    };
    const index = books.findIndex((book) => book.book_id === params.bookId);
    const existing = books[index];
    if (index === -1 || !existing) {
      return HttpResponse.json({ detail: 'Book not found' }, { status: 404 });
    }
    const category = categories.find((candidate) => candidate.category_id === body.category_id);
    const updated = {
      ...existing,
      title: body.title,
      author: body.author,
      publisher: body.publisher ?? null,
      isbn: body.isbn ?? null,
      category_id: body.category_id ?? null,
      category: category ? { category_id: category.category_id, name: category.name } : null,
      description: body.description ?? null,
      published_year: body.published_year ?? null,
    };
    books = [...books.slice(0, index), updated, ...books.slice(index + 1)];
    return HttpResponse.json(updated);
  }),

  http.post(`${API_ORIGIN}/books/:bookId/archive`, ({ params }) => {
    const index = books.findIndex((book) => book.book_id === params.bookId);
    const existing = books[index];
    if (index === -1 || !existing) {
      return HttpResponse.json({ detail: 'Book not found' }, { status: 404 });
    }
    const updated = { ...existing, is_archived: true };
    books = [...books.slice(0, index), updated, ...books.slice(index + 1)];
    return HttpResponse.json(updated);
  }),

  http.post(`${API_ORIGIN}/books/:bookId/unarchive`, ({ params }) => {
    const index = books.findIndex((book) => book.book_id === params.bookId);
    const existing = books[index];
    if (index === -1 || !existing) {
      return HttpResponse.json({ detail: 'Book not found' }, { status: 404 });
    }
    const updated = { ...existing, is_archived: false };
    books = [...books.slice(0, index), updated, ...books.slice(index + 1)];
    return HttpResponse.json(updated);
  }),

  http.get(`${API_ORIGIN}/members`, ({ request }) => {
    const url = new URL(request.url);
    const skip = Number(url.searchParams.get('skip') ?? '0');
    const limit = Number(url.searchParams.get('limit') ?? '100');
    const name = url.searchParams.get('name');
    const email = url.searchParams.get('email');
    const phoneNumber = url.searchParams.get('phone_number');
    const status = url.searchParams.get('status');
    const sortBy = (url.searchParams.get('sort_by') ??
      'last_name') as keyof (typeof members)[number];
    const sortDir = url.searchParams.get('sort_dir') ?? 'asc';

    const filtered = members.filter(
      (member) =>
        (matches(member.first_name, name) || matches(member.last_name, name)) &&
        matches(member.email, email) &&
        matches(member.phone_number, phoneNumber) &&
        (status ? member.membership_status === status : true),
    );

    const sorted = [...filtered].sort((a, b) => {
      const left = a[sortBy];
      const right = b[sortBy];
      if (left === right) {
        return 0;
      }
      const direction = left != null && right != null && left > right ? 1 : -1;
      return sortDir === 'desc' ? -direction : direction;
    });

    const page = sorted.slice(skip, skip + limit);

    return HttpResponse.json({ items: page, total: filtered.length, skip, limit });
  }),

  http.post(`${API_ORIGIN}/members`, async ({ request }) => {
    const body = (await request.json()) as Omit<(typeof members)[number], 'member_id'>;
    const created = { ...body, member_id: `generated-${String(members.length + 1)}` };
    members = [...members, created];
    return HttpResponse.json(created, { status: 201 });
  }),

  http.get(`${API_ORIGIN}/members/:memberId`, ({ params }) => {
    const member = members.find((candidate) => candidate.member_id === params.memberId);
    if (!member) {
      return HttpResponse.json({ detail: 'Member not found' }, { status: 404 });
    }
    return HttpResponse.json(member);
  }),

  http.put(`${API_ORIGIN}/members/:memberId`, async ({ request, params }) => {
    const body = (await request.json()) as Omit<(typeof members)[number], 'member_id'>;
    const index = members.findIndex((member) => member.member_id === params.memberId);
    if (index === -1) {
      return HttpResponse.json({ detail: 'Member not found' }, { status: 404 });
    }
    const updated = { ...members[index], ...body, member_id: params.memberId as string };
    members = [...members.slice(0, index), updated, ...members.slice(index + 1)];
    return HttpResponse.json(updated);
  }),

  http.delete(`${API_ORIGIN}/members/:memberId`, ({ params }) => {
    const index = members.findIndex((member) => member.member_id === params.memberId);
    if (index === -1) {
      return HttpResponse.json({ detail: 'Member not found' }, { status: 404 });
    }
    members = [...members.slice(0, index), ...members.slice(index + 1)];
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_ORIGIN}/book-copies`, ({ request }) => {
    const url = new URL(request.url);
    const skip = Number(url.searchParams.get('skip') ?? '0');
    const limit = Number(url.searchParams.get('limit') ?? '100');
    const bookId = url.searchParams.get('book_id');
    const status = url.searchParams.get('status');
    const condition = url.searchParams.get('condition');
    const barcode = url.searchParams.get('barcode');
    const sortBy = (url.searchParams.get('sort_by') ?? 'barcode') as keyof (typeof copies)[number];
    const sortDir = url.searchParams.get('sort_dir') ?? 'asc';

    const filtered = copies.filter(
      (copy) =>
        (bookId ? copy.book_id === bookId : true) &&
        (status ? copy.status === status : true) &&
        (condition ? copy.condition === condition : true) &&
        matches(copy.barcode, barcode),
    );

    const sorted = [...filtered].sort((a, b) => {
      const left = a[sortBy];
      const right = b[sortBy];
      if (left === right) {
        return 0;
      }
      const direction = left != null && right != null && left > right ? 1 : -1;
      return sortDir === 'desc' ? -direction : direction;
    });

    const page = sorted.slice(skip, skip + limit);

    return HttpResponse.json({ items: page, total: filtered.length, skip, limit });
  }),

  http.get(`${API_ORIGIN}/book-copies/:copyId`, ({ params }) => {
    const copy = copies.find((candidate) => candidate.copy_id === params.copyId);
    if (!copy) {
      return HttpResponse.json({ detail: 'Copy not found' }, { status: 404 });
    }
    return HttpResponse.json(copy);
  }),

  http.post(`${API_ORIGIN}/book-copies`, async ({ request }) => {
    const body = (await request.json()) as {
      book_id: string;
      barcode: string;
      shelf_code?: string | null;
      condition?: BookCopy['condition'];
      max_borrow_days?: number;
      late_fee_per_day?: number;
    };
    const created: BookCopy = {
      copy_id: `generated-${String(copies.length + 1)}`,
      book_id: body.book_id,
      barcode: body.barcode,
      shelf_code: body.shelf_code ?? null,
      condition: body.condition ?? 'NEW',
      status: 'AVAILABLE',
      max_borrow_days: body.max_borrow_days ?? 14,
      late_fee_per_day: body.late_fee_per_day ?? 5,
    };
    copies = [...copies, created];
    return HttpResponse.json(created, { status: 201 });
  }),

  http.put(`${API_ORIGIN}/book-copies/:copyId`, async ({ request, params }) => {
    const body = (await request.json()) as Partial<BookCopy>;
    const index = copies.findIndex((copy) => copy.copy_id === params.copyId);
    const existing = copies[index];
    if (index === -1 || !existing) {
      return HttpResponse.json({ detail: 'Copy not found' }, { status: 404 });
    }
    const updated: BookCopy = { ...existing, ...body, copy_id: params.copyId as string };
    copies = [...copies.slice(0, index), updated, ...copies.slice(index + 1)];
    return HttpResponse.json(updated);
  }),

  http.delete(`${API_ORIGIN}/book-copies/:copyId`, ({ params }) => {
    const index = copies.findIndex((copy) => copy.copy_id === params.copyId);
    if (index === -1) {
      return HttpResponse.json({ detail: 'Copy not found' }, { status: 404 });
    }
    copies = [...copies.slice(0, index), ...copies.slice(index + 1)];
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_ORIGIN}/loans`, ({ request }) => {
    const url = new URL(request.url);
    const skip = Number(url.searchParams.get('skip') ?? '0');
    const limit = Number(url.searchParams.get('limit') ?? '100');
    const memberId = url.searchParams.get('member_id');
    const copyId = url.searchParams.get('copy_id');
    const status = url.searchParams.get('status');
    const memberName = url.searchParams.get('member_name');
    const bookTitle = url.searchParams.get('book_title');
    const copyBarcode = url.searchParams.get('copy_barcode');
    const sortBy = (url.searchParams.get('sort_by') ??
      'borrowed_at') as keyof (typeof loans)[number];
    const sortDir = url.searchParams.get('sort_dir') ?? 'desc';

    const filtered = loans.filter((loan) => {
      const copy = copies.find((candidate) => candidate.copy_id === loan.copy_id);
      const book = copy ? books.find((candidate) => candidate.book_id === copy.book_id) : undefined;
      const member = members.find((candidate) => candidate.member_id === loan.member_id);

      return (
        (memberId ? loan.member_id === memberId : true) &&
        (copyId ? loan.copy_id === copyId : true) &&
        (status ? loan.status === status : true) &&
        (memberName
          ? matches(member?.first_name ?? null, memberName) ||
            matches(member?.last_name ?? null, memberName)
          : true) &&
        matches(book?.title ?? null, bookTitle) &&
        matches(copy?.barcode ?? null, copyBarcode)
      );
    });

    const sorted = [...filtered].sort((a, b) => {
      const left = a[sortBy];
      const right = b[sortBy];
      if (left === right) {
        return 0;
      }
      const direction = left != null && right != null && left > right ? 1 : -1;
      return sortDir === 'desc' ? -direction : direction;
    });

    const page = sorted.slice(skip, skip + limit);

    return HttpResponse.json({ items: page, total: filtered.length, skip, limit });
  }),

  // Declared before /loans/:loanId so this static path isn't captured by the
  // loanId path parameter, mirroring the backend's own route ordering.
  http.get(`${API_ORIGIN}/loans/overdue`, ({ request }) => {
    const url = new URL(request.url);
    const skip = Number(url.searchParams.get('skip') ?? '0');
    const limit = Number(url.searchParams.get('limit') ?? '100');
    const sortBy = (url.searchParams.get('sort_by') ?? 'due_at') as keyof (typeof loans)[number];
    const sortDir = url.searchParams.get('sort_dir') ?? 'asc';
    const now = new Date();

    const overdue = loans
      .filter((loan) => loan.status === 'ACTIVE' && new Date(loan.due_at) < now)
      .map((loan) => {
        const copy = copies.find((candidate) => candidate.copy_id === loan.copy_id);
        const daysOverdue = Math.ceil(
          (now.getTime() - new Date(loan.due_at).getTime()) / (24 * 60 * 60 * 1000),
        );
        return {
          ...loan,
          days_overdue: daysOverdue,
          estimated_fine: daysOverdue * (copy?.late_fee_per_day ?? 0),
        };
      });

    const sorted = [...overdue].sort((a, b) => {
      const left = a[sortBy];
      const right = b[sortBy];
      if (left === right) {
        return 0;
      }
      const direction = left != null && right != null && left > right ? 1 : -1;
      return sortDir === 'desc' ? -direction : direction;
    });

    const page = sorted.slice(skip, skip + limit);

    return HttpResponse.json({ items: page, total: overdue.length, skip, limit });
  }),

  http.get(`${API_ORIGIN}/loans/:loanId`, ({ params }) => {
    const loan = loans.find((candidate) => candidate.loan_id === params.loanId);
    if (!loan) {
      return HttpResponse.json({ detail: 'Loan not found' }, { status: 404 });
    }
    return HttpResponse.json(loan);
  }),

  http.post(`${API_ORIGIN}/loans`, async ({ request }) => {
    const body = (await request.json()) as {
      copy_id: string;
      member_id: string;
      remarks?: string | null;
    };
    const now = new Date();
    const dueAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const created: Loan = {
      loan_id: `generated-${String(loans.length + 1)}`,
      copy_id: body.copy_id,
      member_id: body.member_id,
      issued_by_staff_id: staffFixture.staff_id,
      received_by_staff_id: null,
      borrowed_at: now.toISOString(),
      due_at: dueAt.toISOString(),
      returned_at: null,
      borrow_condition: 'GOOD',
      return_condition: null,
      status: 'ACTIVE',
      calculated_fine: 0,
      remarks: body.remarks ?? null,
      created_at: now.toISOString(),
      closed_at: null,
    };
    loans = [...loans, created];

    const copyIndex = copies.findIndex((copy) => copy.copy_id === body.copy_id);
    const existingCopy = copies[copyIndex];
    if (copyIndex !== -1 && existingCopy) {
      const borrowed: BookCopy = { ...existingCopy, status: 'BORROWED' };
      copies = [...copies.slice(0, copyIndex), borrowed, ...copies.slice(copyIndex + 1)];
    }

    return HttpResponse.json(created, { status: 201 });
  }),

  http.post(`${API_ORIGIN}/loans/:loanId/return`, async ({ request, params }) => {
    const body = (await request.json()) as {
      return_condition: BookCopy['condition'];
      remarks?: string | null;
    };
    const index = loans.findIndex((loan) => loan.loan_id === params.loanId);
    const existingLoan = loans[index];
    if (index === -1 || !existingLoan) {
      return HttpResponse.json({ detail: 'Loan not found' }, { status: 404 });
    }
    const now = new Date().toISOString();
    const updated: Loan = {
      ...existingLoan,
      status: 'RETURNED',
      returned_at: now,
      closed_at: now,
      return_condition: body.return_condition,
      remarks: body.remarks ?? existingLoan.remarks,
      calculated_fine: 0,
    };
    loans = [...loans.slice(0, index), updated, ...loans.slice(index + 1)];

    const copyIndex = copies.findIndex((copy) => copy.copy_id === updated.copy_id);
    const existingCopy = copies[copyIndex];
    if (copyIndex !== -1 && existingCopy) {
      const nextStatus = body.return_condition === 'DAMAGED' ? 'MAINTENANCE' : 'AVAILABLE';
      const returned: BookCopy = {
        ...existingCopy,
        condition: body.return_condition,
        status: nextStatus,
      };
      copies = [...copies.slice(0, copyIndex), returned, ...copies.slice(copyIndex + 1)];
    }

    return HttpResponse.json(updated);
  }),

  http.get(`${API_ORIGIN}/staff`, ({ request }) => {
    const url = new URL(request.url);
    const skip = Number(url.searchParams.get('skip') ?? '0');
    const limit = Number(url.searchParams.get('limit') ?? '100');
    const name = url.searchParams.get('name');
    const employeeCode = url.searchParams.get('employee_code');
    const email = url.searchParams.get('email');
    const phoneNumber = url.searchParams.get('phone_number');
    const role = url.searchParams.get('role');
    const status = url.searchParams.get('status');
    const sortBy = (url.searchParams.get('sort_by') ??
      'employee_code') as keyof (typeof staffList)[number];
    const sortDir = url.searchParams.get('sort_dir') ?? 'asc';

    const filtered = staffList.filter(
      (member) =>
        (matches(member.first_name, name) || matches(member.last_name, name)) &&
        matches(member.employee_code, employeeCode) &&
        matches(member.email, email) &&
        matches(member.phone_number, phoneNumber) &&
        (role ? member.role === role : true) &&
        (status ? member.status === status : true),
    );

    const sorted = [...filtered].sort((a, b) => {
      const left = a[sortBy];
      const right = b[sortBy];
      if (left === right) {
        return 0;
      }
      const direction = left != null && right != null && left > right ? 1 : -1;
      return sortDir === 'desc' ? -direction : direction;
    });

    const page = sorted.slice(skip, skip + limit);

    return HttpResponse.json({ items: page, total: filtered.length, skip, limit });
  }),

  http.post(`${API_ORIGIN}/staff`, async ({ request }) => {
    const body = (await request.json()) as Omit<
      (typeof staffList)[number],
      'staff_id' | 'status'
    > & { password: string };
    const created: Staff = {
      staff_id: `generated-${String(staffList.length + 1)}`,
      employee_code: body.employee_code,
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      phone_number: body.phone_number ?? null,
      role: body.role ?? 'LIBRARIAN',
      status: 'ACTIVE',
    };
    staffList = [...staffList, created];
    return HttpResponse.json(created, { status: 201 });
  }),

  http.put(`${API_ORIGIN}/staff/:staffId`, async ({ request, params }) => {
    const body = (await request.json()) as Partial<(typeof staffList)[number]>;
    const index = staffList.findIndex((member) => member.staff_id === params.staffId);
    const existing = staffList[index];
    if (index === -1 || !existing) {
      return HttpResponse.json({ detail: 'Staff not found' }, { status: 404 });
    }
    const updated = { ...existing, ...body };
    staffList = [...staffList.slice(0, index), updated, ...staffList.slice(index + 1)];
    return HttpResponse.json(updated);
  }),

  http.post(`${API_ORIGIN}/staff/:staffId/activate`, ({ params }) => {
    const index = staffList.findIndex((member) => member.staff_id === params.staffId);
    const existing = staffList[index];
    if (index === -1 || !existing) {
      return HttpResponse.json({ detail: 'Staff not found' }, { status: 404 });
    }
    const updated = { ...existing, status: 'ACTIVE' as const };
    staffList = [...staffList.slice(0, index), updated, ...staffList.slice(index + 1)];
    return HttpResponse.json(updated);
  }),

  http.post(`${API_ORIGIN}/staff/:staffId/deactivate`, ({ params }) => {
    const index = staffList.findIndex((member) => member.staff_id === params.staffId);
    const existing = staffList[index];
    if (index === -1 || !existing) {
      return HttpResponse.json({ detail: 'Staff not found' }, { status: 404 });
    }
    const updated = { ...existing, status: 'INACTIVE' as const };
    staffList = [...staffList.slice(0, index), updated, ...staffList.slice(index + 1)];
    return HttpResponse.json(updated);
  }),
];
