import { AppRoutes } from '@/routes/AppRoutes';

import { AppProviders } from './AppProviders';

export function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}
