import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '@/features/auth/hooks/useAuth';

/**
 * Gates every route nested under it behind authentication. A persisted
 * token's validity is confirmed asynchronously (see useAuthBootstrap), so
 * this shows a spinner rather than redirecting while that check is in
 * flight — otherwise a page reload would flash the login page every time.
 *
 * TODO(Tier 4): replace the inline CircularProgress with the shared Loader
 * component once the reusable component library exists.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isCheckingSession } = useAuth();
  const location = useLocation();

  if (isCheckingSession) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress size={32} aria-label="Checking session" />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
