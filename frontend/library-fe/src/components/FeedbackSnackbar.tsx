import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';

interface FeedbackSnackbarProps {
  open: boolean;
  message: string | null;
  severity: 'error' | 'success';
  onClose: () => void;
}

/**
 * Shared error/success toast, standardizing position and auto-hide timing
 * across every page instead of each one hand-rolling its own Snackbar+Alert.
 */
export function FeedbackSnackbar({ open, message, severity, onClose }: FeedbackSnackbarProps) {
  return (
    <Snackbar
      open={open}
      autoHideDuration={6000}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert severity={severity} onClose={onClose} sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  );
}
