import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuthBootstrap } from '@/features/auth/hooks/useAuthBootstrap';
import { AppLayout } from '@/layouts/AppLayout';
import { BooksPage } from '@/pages/BooksPage';
import { CopiesPage } from '@/pages/CopiesPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoansPage } from '@/pages/LoansPage';
import { LoginPage } from '@/pages/LoginPage';
import { MembersPage } from '@/pages/MembersPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

import { ProtectedRoute } from './ProtectedRoute';

export function AppRoutes() {
  useAuthBootstrap();

  return (
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
  );
}
