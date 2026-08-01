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
  list(params: ListCategoriesParams): Promise<Page<Category>> {
    return httpClient.get<Page<Category>>(ENDPOINTS.categories.list, {
      params: {
        skip: params.skip,
        limit: params.limit,
        name: nonEmpty(params.name),
        include_archived: params.includeArchived,
        sort_by: params.sortBy,
        sort_dir: params.sortDir,
      },
    });
  },

  create(payload: CategoryRequest): Promise<Category> {
    return httpClient.post<Category>(ENDPOINTS.categories.list, payload);
  },

  update(categoryId: string, payload: CategoryRequest): Promise<Category> {
    return httpClient.put<Category>(ENDPOINTS.categories.byId(categoryId), payload);
  },

  archive(categoryId: string): Promise<Category> {
    return httpClient.post<Category>(ENDPOINTS.categories.archive(categoryId));
  },

  unarchive(categoryId: string): Promise<Category> {
    return httpClient.post<Category>(ENDPOINTS.categories.unarchive(categoryId));
  },
};
