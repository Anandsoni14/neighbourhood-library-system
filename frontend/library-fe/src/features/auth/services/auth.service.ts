import { httpClient } from '@/services/httpClient';
import { ENDPOINTS } from '@/services/endpoints';

import type { LoginRequest, LoginResponse, StaffResponse } from '../types/auth.types';

export const authService = {
  login(credentials: LoginRequest): Promise<LoginResponse> {
    return httpClient.post<LoginResponse>(ENDPOINTS.auth.login, credentials);
  },

  getCurrentStaff(): Promise<StaffResponse> {
    return httpClient.get<StaffResponse>(ENDPOINTS.auth.me);
  },
};
