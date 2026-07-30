import { http, HttpResponse } from 'msw';

import type { Member } from '@/features/members/types/member.types';

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

export const bookFixtures = [
  {
    book_id: '22222222-2222-2222-2222-222222222221',
    title: 'Clean Code',
    author: 'Robert C. Martin',
    publisher: 'Prentice Hall',
    isbn: '9780132350884',
    category: 'Software',
    description: 'A handbook of agile software craftsmanship.',
    published_year: 2008,
  },
  {
    book_id: '22222222-2222-2222-2222-222222222222',
    title: 'The Pragmatic Programmer',
    author: 'Andrew Hunt',
    publisher: 'Addison-Wesley',
    isbn: '9780135957059',
    category: 'Software',
    description: null,
    published_year: 2019,
  },
];

export const memberFixtures: Member[] = [
  {
    member_id: '33333333-3333-3333-3333-333333333331',
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.com',
    phone_number: '555-1234',
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

/**
 * A mutable working copy so POST/PUT/DELETE handlers can simulate real
 * persistence within a test. `resetBooks` (called from setup.ts's afterEach)
 * restores it from `bookFixtures` so tests don't leak state into each other.
 */
let books = bookFixtures.map((book) => ({ ...book }));

export function resetBooks(): void {
  books = bookFixtures.map((book) => ({ ...book }));
}

/** Same rationale as `resetBooks`, for the member fixture store. */
let members = memberFixtures.map((member) => ({ ...member }));

export function resetMembers(): void {
  members = memberFixtures.map((member) => ({ ...member }));
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

  http.get(`${API_ORIGIN}/books`, ({ request }) => {
    const url = new URL(request.url);
    const skip = Number(url.searchParams.get('skip') ?? '0');
    const limit = Number(url.searchParams.get('limit') ?? '100');
    const title = url.searchParams.get('title');
    const author = url.searchParams.get('author');
    const category = url.searchParams.get('category');
    const isbn = url.searchParams.get('isbn');
    const sortBy = (url.searchParams.get('sort_by') ?? 'title') as keyof (typeof books)[number];
    const sortDir = url.searchParams.get('sort_dir') ?? 'asc';

    const filtered = books.filter(
      (book) =>
        matches(book.title, title) &&
        matches(book.author, author) &&
        matches(book.category, category) &&
        matches(book.isbn, isbn, true),
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

  http.post(`${API_ORIGIN}/books`, async ({ request }) => {
    const body = (await request.json()) as Omit<(typeof books)[number], 'book_id'>;
    const created = { ...body, book_id: `generated-${String(books.length + 1)}` };
    books = [...books, created];
    return HttpResponse.json(created, { status: 201 });
  }),

  http.put(`${API_ORIGIN}/books/:bookId`, async ({ request, params }) => {
    const body = (await request.json()) as Omit<(typeof books)[number], 'book_id'>;
    const index = books.findIndex((book) => book.book_id === params.bookId);
    if (index === -1) {
      return HttpResponse.json({ detail: 'Book not found' }, { status: 404 });
    }
    const updated = { ...body, book_id: params.bookId as string };
    books = [...books.slice(0, index), updated, ...books.slice(index + 1)];
    return HttpResponse.json(updated);
  }),

  http.delete(`${API_ORIGIN}/books/:bookId`, ({ params }) => {
    const index = books.findIndex((book) => book.book_id === params.bookId);
    if (index === -1) {
      return HttpResponse.json({ detail: 'Book not found' }, { status: 404 });
    }
    books = [...books.slice(0, index), ...books.slice(index + 1)];
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_ORIGIN}/members`, ({ request }) => {
    const url = new URL(request.url);
    const skip = Number(url.searchParams.get('skip') ?? '0');
    const limit = Number(url.searchParams.get('limit') ?? '100');
    const name = url.searchParams.get('name');
    const email = url.searchParams.get('email');
    const status = url.searchParams.get('status');
    const sortBy = (url.searchParams.get('sort_by') ?? 'last_name') as keyof (typeof members)[number];
    const sortDir = url.searchParams.get('sort_dir') ?? 'asc';

    const filtered = members.filter(
      (member) =>
        (matches(member.first_name, name) || matches(member.last_name, name)) &&
        matches(member.email, email) &&
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
];
