import { httpClient } from '@/services/httpClient';
import type { Page } from '@/types/api';

import type { Category, CategoryRequest, ListCategoriesParams } from '../types/category.types';

/** An empty filter string means "no filter" to the API, so send `undefined` instead. */
function nonEmpty(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value;
}

export const categoryService = {
  async list(params: ListCategoriesParams): Promise<Page<Category>> {
    const { data } = await httpClient.get<Page<Category>>('/categories', {
      params: {
        skip: params.skip,
        limit: params.limit,
        name: nonEmpty(params.name),
        include_archived: params.includeArchived,
        sort_by: params.sortBy,
        sort_dir: params.sortDir,
      },
    });
    return data;
  },

  async create(payload: CategoryRequest): Promise<Category> {
    const { data } = await httpClient.post<Category>('/categories', payload);
    return data;
  },

  async update(categoryId: string, payload: CategoryRequest): Promise<Category> {
    const { data } = await httpClient.put<Category>(`/categories/${categoryId}`, payload);
    return data;
  },

  async archive(categoryId: string): Promise<Category> {
    const { data } = await httpClient.post<Category>(`/categories/${categoryId}/archive`);
    return data;
  },

  async unarchive(categoryId: string): Promise<Category> {
    const { data } = await httpClient.post<Category>(`/categories/${categoryId}/unarchive`);
    return data;
  },
};
