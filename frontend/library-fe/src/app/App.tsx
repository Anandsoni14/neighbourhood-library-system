import CssBaseline from '@mui/material/CssBaseline';
import Typography from '@mui/material/Typography';
import { ThemeProvider } from '@mui/material/styles';

import { theme } from '@/theme';

// Temporary root content — Tier 2 replaces this with the router, layout, and pages.
export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Typography component="h1" variant="h1" sx={{ p: 3 }}>
        Library Management System
      </Typography>
    </ThemeProvider>
  );
}
