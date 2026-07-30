import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Page not found');

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        minHeight: '100vh',
        textAlign: 'center',
        px: 3,
      }}
    >
      <Typography component="h1" variant="h3" color="text.secondary">
        404
      </Typography>
      <Typography variant="h6" component="h2">
        Page not found
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        The page you're looking for doesn't exist or has been moved.
      </Typography>
      <Button component={RouterLink} to="/" variant="contained">
        Back to home
      </Button>
    </Box>
  );
}
