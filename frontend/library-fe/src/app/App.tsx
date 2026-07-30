import { AppRoutes } from '@/routes/AppRoutes';

import { AppProviders } from './AppProviders';
import { ErrorBoundary } from './ErrorBoundary';

export function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </ErrorBoundary>
  );
}
