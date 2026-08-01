import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { Loader } from '@/components/Loader';
import { useAuthBootstrap } from '@/features/auth/hooks/useAuthBootstrap';
import { AppLayout } from '@/layouts/AppLayout';
import { LoginPage } from '@/pages/login/LoginPage';

import { ProtectedRoute } from './ProtectedRoute';
import { ROUTES } from './paths';

// Lazy-loaded so the initial bundle only ships the login flow; LoginPage
// stays eager since it's the first thing every unauthenticated visitor needs.
const DashboardPage = lazy(() =>
  import('@/pages/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const BooksPage = lazy(() =>
  import('@/pages/books/BooksPage').then((module) => ({ default: module.BooksPage })),
);
const CategoriesPage = lazy(() =>
  import('@/pages/categories/CategoriesPage').then((module) => ({
    default: module.CategoriesPage,
  })),
);
const MembersPage = lazy(() =>
  import('@/pages/members/MembersPage').then((module) => ({ default: module.MembersPage })),
);
const LoansPage = lazy(() =>
  import('@/pages/loans/LoansPage').then((module) => ({ default: module.LoansPage })),
);
const StaffPage = lazy(() =>
  import('@/pages/staff/StaffPage').then((module) => ({ default: module.StaffPage })),
);
const NotFoundPage = lazy(() =>
  import('@/pages/not-found/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
);

export function AppRoutes() {
  useAuthBootstrap();

  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path={ROUTES.login} element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to={ROUTES.dashboard} replace />} />
            <Route path={ROUTES.dashboard.slice(1)} element={<DashboardPage />} />
            <Route path={ROUTES.books.slice(1)} element={<BooksPage />} />
            <Route path={ROUTES.categories.slice(1)} element={<CategoriesPage />} />
            <Route path={ROUTES.members.slice(1)} element={<MembersPage />} />
            <Route path={ROUTES.loans.slice(1)} element={<LoansPage />} />
            <Route path={ROUTES.staff.slice(1)} element={<StaffPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
