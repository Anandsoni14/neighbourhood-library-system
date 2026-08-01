import { httpClient } from '@/services/httpClient';
import { ENDPOINTS } from '@/services/endpoints';
import type { Page } from '@/types/api';

import type {
  ListStaffParams,
  Staff,
  StaffCreateRequest,
  StaffUpdateRequest,
} from '../types/staff.types';

/** An empty filter string means "no filter" to the API, so send `undefined` instead. */
function nonEmpty(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value;
}

export const staffService = {
  async list(params: ListStaffParams): Promise<Page<Staff>> {
    const { data } = await httpClient.get<Page<Staff>>(ENDPOINTS.staff.list, {
      params: {
        skip: params.skip,
        limit: params.limit,
        name: nonEmpty(params.name),
        role: params.role,
        status: params.status,
        sort_by: params.sortBy,
        sort_dir: params.sortDir,
      },
    });
    return data;
  },

  async create(payload: StaffCreateRequest): Promise<Staff> {
    const { data } = await httpClient.post<Staff>(ENDPOINTS.staff.list, payload);
    return data;
  },

  async update(staffId: string, payload: StaffUpdateRequest): Promise<Staff> {
    const { data } = await httpClient.put<Staff>(ENDPOINTS.staff.byId(staffId), payload);
    return data;
  },

  async activate(staffId: string): Promise<Staff> {
    const { data } = await httpClient.post<Staff>(ENDPOINTS.staff.activate(staffId));
    return data;
  },

  async deactivate(staffId: string): Promise<Staff> {
    const { data } = await httpClient.post<Staff>(ENDPOINTS.staff.deactivate(staffId));
    return data;
  },
};
