import type { SortDir } from '@/types/common';

export interface CategoryRef {
  category_id: string;
  name: string;
}

export interface Book {
  book_id: string;
  title: string;
  author: string;
  publisher: string | null;
  isbn: string | null;
  category_id: string | null;
  category: CategoryRef | null;
  description: string | null;
  published_year: number | null;
  is_archived: boolean;
}

export interface BookRequest {
  title: string;
  author: string;
  publisher?: string | null;
  isbn?: string | null;
  category_id?: string | null;
  description?: string | null;
  published_year?: number | null;
}

/** Mirrors the backend's `BookSortField` allowlist in `api/books.py`. */
export const BookSortField = {
  TITLE: 'title',
  AUTHOR: 'author',
  CATEGORY: 'category',
  PUBLISHED_YEAR: 'published_year',
  CREATED_AT: 'created_at',
} as const;
export type BookSortField = (typeof BookSortField)[keyof typeof BookSortField];

/** Mirrors the backend's `BookArchiveFilter` in `api/books.py`. */
export const BookArchiveFilter = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  ALL: 'all',
} as const;
export type BookArchiveFilter = (typeof BookArchiveFilter)[keyof typeof BookArchiveFilter];

export interface ListBooksParams {
  skip: number;
  limit: number;
  title?: string;
  author?: string;
  categoryId?: string;
  isbn?: string;
  archived?: BookArchiveFilter;
  inStock?: boolean;
  sortBy: BookSortField;
  sortDir: SortDir;
}
