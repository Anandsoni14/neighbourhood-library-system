import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { authService } from '@/features/auth/services/auth.service';
import type { LoginRequest, LoginResponse, StaffResponse } from '@/features/auth/types/auth.types';
import type { RootState } from '@/redux/store';
import { RequestStatus } from '@/types/common';
import { getApiErrorMessage } from '@/utils/apiError';

export const AUTH_TOKEN_STORAGE_KEY = 'lms_auth_token';

interface AuthState {
  token: string | null;
  staff: StaffResponse | null;
  status: RequestStatus;
  error: string | null;
}

function readPersistedToken(): string | null {
  // Guarded for non-browser test environments that construct the slice
  // before jsdom (or a real window) is available.
  return typeof localStorage === 'undefined' ? null : localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

const persistedToken = readPersistedToken();

const initialState: AuthState = {
  token: persistedToken,
  staff: null,
  // A persisted token's validity is unknown until fetchCurrentStaff confirms
  // it — starting at LOADING lets ProtectedRoute show a spinner instead of
  // bouncing straight to /login while that check is in flight.
  status: persistedToken ? RequestStatus.LOADING : RequestStatus.IDLE,
  error: null,
};

export const login = createAsyncThunk<LoginResponse, LoginRequest, { rejectValue: string }>(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      return await authService.login(credentials);
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to sign in.'));
    }
  },
);

export const fetchCurrentStaff = createAsyncThunk<StaffResponse, void, { rejectValue: string }>(
  'auth/fetchCurrentStaff',
  async (_arg, { rejectWithValue }) => {
    try {
      return await authService.getCurrentStaff();
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Your session has expired.'));
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.token = null;
      state.staff = null;
      state.status = RequestStatus.IDLE;
      state.error = null;
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = RequestStatus.LOADING;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.token = action.payload.access_token;
        state.staff = action.payload.staff;
        state.status = RequestStatus.SUCCEEDED;
        state.error = null;
        localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, action.payload.access_token);
      })
      .addCase(login.rejected, (state, action) => {
        state.status = RequestStatus.FAILED;
        state.error = action.payload ?? 'Unable to sign in.';
      })
      .addCase(fetchCurrentStaff.pending, (state) => {
        state.status = RequestStatus.LOADING;
      })
      .addCase(fetchCurrentStaff.fulfilled, (state, action) => {
        state.staff = action.payload;
        state.status = RequestStatus.SUCCEEDED;
        state.error = null;
      })
      .addCase(fetchCurrentStaff.rejected, (state, action) => {
        // The persisted token is invalid or expired. The 401 interceptor
        // also dispatches logout for calls made mid-session; clearing here
        // too keeps this slice correct standalone (e.g. under test) even
        // without the interceptor wired up.
        state.token = null;
        state.staff = null;
        state.status = RequestStatus.IDLE;
        state.error = action.payload ?? 'Your session has expired.';
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;

export const selectAuthToken = (state: RootState): string | null => state.auth.token;
export const selectCurrentStaff = (state: RootState): StaffResponse | null => state.auth.staff;
export const selectAuthStatus = (state: RootState): RequestStatus => state.auth.status;
export const selectAuthError = (state: RootState): string | null => state.auth.error;
