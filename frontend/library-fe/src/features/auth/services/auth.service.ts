import { httpClient } from '@/services/httpClient';

import type { LoginRequest, LoginResponse, StaffResponse } from '../types/auth.types';

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const { data } = await httpClient.post<LoginResponse>('/auth/login', credentials);
    return data;
  },

  async getCurrentStaff(): Promise<StaffResponse> {
    const { data } = await httpClient.get<StaffResponse>('/auth/me');
    return data;
  },
};
