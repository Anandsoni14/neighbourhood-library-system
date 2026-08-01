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
  list(params: ListStaffParams): Promise<Page<Staff>> {
    return httpClient.get<Page<Staff>>(ENDPOINTS.staff.list, {
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
  },

  create(payload: StaffCreateRequest): Promise<Staff> {
    return httpClient.post<Staff>(ENDPOINTS.staff.list, payload);
  },

  update(staffId: string, payload: StaffUpdateRequest): Promise<Staff> {
    return httpClient.put<Staff>(ENDPOINTS.staff.byId(staffId), payload);
  },

  activate(staffId: string): Promise<Staff> {
    return httpClient.post<Staff>(ENDPOINTS.staff.activate(staffId));
  },

  deactivate(staffId: string): Promise<Staff> {
    return httpClient.post<Staff>(ENDPOINTS.staff.deactivate(staffId));
  },
};
