import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { Loader } from '@/components/Loader';
import { useAuthBootstrap } from '@/features/auth/hooks/useAuthBootstrap';
import { AppLayout } from '@/layouts/AppLayout';
import { LoginPage } from '@/pages/LoginPage';

import { ProtectedRoute } from './ProtectedRoute';

// Everything behind ProtectedRoute is lazy-loaded so the initial bundle only
// ships the login flow — the rest splits into per-route chunks, fetched on
// first navigation. LoginPage stays eager since it's the first thing every
// unauthenticated visitor needs.
const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const BooksPage = lazy(() =>
  import('@/pages/BooksPage').then((module) => ({ default: module.BooksPage })),
);
const MembersPage = lazy(() =>
  import('@/pages/MembersPage').then((module) => ({ default: module.MembersPage })),
);
const CopiesPage = lazy(() =>
  import('@/pages/CopiesPage').then((module) => ({ default: module.CopiesPage })),
);
const LoansPage = lazy(() =>
  import('@/pages/LoansPage').then((module) => ({ default: module.LoansPage })),
);
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
);

export function AppRoutes() {
  useAuthBootstrap();

  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="books" element={<BooksPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="copies" element={<CopiesPage />} />
            <Route path="loans" element={<LoansPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
