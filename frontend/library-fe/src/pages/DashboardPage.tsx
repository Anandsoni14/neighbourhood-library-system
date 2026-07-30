import Typography from '@mui/material/Typography';

import { useAuth } from '@/features/auth/hooks/useAuth';

// Deliberately minimal — Tier 8 (Dashboard) adds summary cards, recent
// activity, and quick actions. This is a genuine landing page today, not a
// placeholder: it's what a staff member sees immediately after signing in.
export function DashboardPage() {
  const { staff } = useAuth();

  return (
    <>
      <Typography component="h2" variant="h4" sx={{ mb: 1 }}>
        Dashboard
      </Typography>
      {staff && (
        <Typography variant="body1" color="text.secondary">
          Welcome back, {staff.first_name}.
        </Typography>
      )}
    </>
  );
}
