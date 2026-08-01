import { httpClient } from '@/services/httpClient';
import { ENDPOINTS } from '@/services/endpoints';
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
    const { data } = await httpClient.get<Page<Category>>(ENDPOINTS.categories.list, {
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
    const { data } = await httpClient.post<Category>(ENDPOINTS.categories.list, payload);
    return data;
  },

  async update(categoryId: string, payload: CategoryRequest): Promise<Category> {
    const { data } = await httpClient.put<Category>(ENDPOINTS.categories.byId(categoryId), payload);
    return data;
  },

  async archive(categoryId: string): Promise<Category> {
    const { data } = await httpClient.post<Category>(ENDPOINTS.categories.archive(categoryId));
    return data;
  },

  async unarchive(categoryId: string): Promise<Category> {
    const { data } = await httpClient.post<Category>(ENDPOINTS.categories.unarchive(categoryId));
    return data;
  },
};
