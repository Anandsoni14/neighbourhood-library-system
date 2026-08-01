import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { Loader } from '@/components/Loader';
import { useAuth } from '@/features/auth/hooks/useAuth';

import { ROUTES } from './paths';

/**
 * Gates every route nested under it behind authentication. A persisted
 * token's validity is confirmed asynchronously (see useAuthBootstrap), so
 * this shows a spinner rather than redirecting while that check is in
 * flight — otherwise a page reload would flash the login page every time.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isCheckingSession } = useAuth();
  const location = useLocation();

  if (isCheckingSession) {
    return <Loader label="Checking session" />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.login} state={{ from: location }} replace />;
  }

  return <Outlet />;
}
