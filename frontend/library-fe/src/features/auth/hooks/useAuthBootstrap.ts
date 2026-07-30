import { useEffect } from 'react';

import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchCurrentStaff, selectAuthStatus, selectAuthToken } from '@/redux/slices/authSlice';
import { RequestStatus } from '@/types/common';

/**
 * Runs once on app start: if a token survived a page reload, its validity
 * is unknown, so this confirms it (and refreshes the staff record) via
 * GET /auth/me before ProtectedRoute decides whether to render or redirect.
 */
export function useAuthBootstrap(): void {
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectAuthToken);
  const status = useAppSelector(selectAuthStatus);

  useEffect(() => {
    if (token && status === RequestStatus.LOADING) {
      void dispatch(fetchCurrentStaff());
    }
    // Intentionally runs once per mount, not on every token/status change —
    // this is a one-time boot check, not a resync-on-every-render effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
