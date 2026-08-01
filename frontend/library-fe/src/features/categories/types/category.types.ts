import type { SortDir } from '@/types/common';

export interface Category {
  category_id: string;
  name: string;
  description: string | null;
  is_archived: boolean;
}

export interface CategoryRequest {
  name: string;
  description?: string | null;
}

/** Mirrors the backend's `CategorySortField` allowlist in `api/categories.py`. */
export const CategorySortField = {
  NAME: 'name',
  CREATED_AT: 'created_at',
} as const;
export type CategorySortField = (typeof CategorySortField)[keyof typeof CategorySortField];

/** Mirrors the backend's `CategoryArchiveFilter` in `api/categories.py`. */
export const CategoryArchiveFilter = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  ALL: 'all',
} as const;
export type CategoryArchiveFilter =
  (typeof CategoryArchiveFilter)[keyof typeof CategoryArchiveFilter];

export interface ListCategoriesParams {
  skip: number;
  limit: number;
  name?: string;
  archived?: CategoryArchiveFilter;
  sortBy: CategorySortField;
  sortDir: SortDir;
}
