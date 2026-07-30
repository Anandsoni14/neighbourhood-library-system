import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

interface LoaderProps {
  label?: string;
}

/** Full-viewport centered spinner, shared by route-level loading states. */
export function Loader({ label = 'Loading' }: LoaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <CircularProgress size={32} aria-label={label} />
    </Box>
  );
}
