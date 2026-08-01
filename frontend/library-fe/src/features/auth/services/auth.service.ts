import { httpClient } from '@/services/httpClient';
import { ENDPOINTS } from '@/services/endpoints';

import type { LoginRequest, LoginResponse, StaffResponse } from '../types/auth.types';

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const { data } = await httpClient.post<LoginResponse>(ENDPOINTS.auth.login, credentials);
    return data;
  },

  async getCurrentStaff(): Promise<StaffResponse> {
    const { data } = await httpClient.get<StaffResponse>(ENDPOINTS.auth.me);
    return data;
  },
};
