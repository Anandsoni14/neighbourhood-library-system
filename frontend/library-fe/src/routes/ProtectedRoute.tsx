import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { Loader } from '@/components/Loader';
import { useAuth } from '@/features/auth/hooks/useAuth';

import { ROUTES } from './paths';

/** Gates nested routes behind authentication. Shows a spinner while a
 * persisted token's validity is being confirmed (see useAuthBootstrap)
 * instead of flashing the login page on every reload. */
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
