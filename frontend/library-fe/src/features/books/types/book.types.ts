import type { SortDir } from '@/types/common';

export interface Book {
  book_id: string;
  title: string;
  author: string;
  publisher: string | null;
  isbn: string | null;
  category: string | null;
  description: string | null;
  published_year: number | null;
}

export interface BookRequest {
  title: string;
  author: string;
  publisher?: string | null;
  isbn?: string | null;
  category?: string | null;
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

export interface ListBooksParams {
  skip: number;
  limit: number;
  title?: string;
  author?: string;
  category?: string;
  isbn?: string;
  sortBy: BookSortField;
  sortDir: SortDir;
}
