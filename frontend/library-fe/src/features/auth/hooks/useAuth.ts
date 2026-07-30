import { useCallback } from 'react';

import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  login as loginThunk,
  logout as logoutAction,
  selectAuthError,
  selectAuthStatus,
  selectAuthToken,
  selectCurrentStaff,
} from '@/redux/slices/authSlice';
import { RequestStatus } from '@/types/common';

import type { LoginRequest } from '../types/auth.types';

/**
 * The single seam between auth UI (LoginPage, Header, ProtectedRoute) and
 * Redux — components read state and call actions through this hook rather
 * than importing the slice or dispatch directly, keeping them presentational.
 */
export function useAuth() {
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectAuthToken);
  const staff = useAppSelector(selectCurrentStaff);
  const status = useAppSelector(selectAuthStatus);
  const error = useAppSelector(selectAuthError);

  const login = useCallback(
    (credentials: LoginRequest) => dispatch(loginThunk(credentials)),
    [dispatch],
  );

  const logout = useCallback(() => dispatch(logoutAction()), [dispatch]);

  return {
    staff,
    token,
    error,
    // A persisted token whose validity hasn't been confirmed yet counts as
    // "checking", so ProtectedRoute can wait rather than bounce to /login.
    isCheckingSession: status === RequestStatus.LOADING && token !== null && staff === null,
    // Distinct from isCheckingSession: this is a login attempt in progress
    // (no token yet), used by LoginPage to disable its submit button.
    isSubmitting: status === RequestStatus.LOADING && token === null,
    isAuthenticated: token !== null,
    login,
    logout,
  };
}
