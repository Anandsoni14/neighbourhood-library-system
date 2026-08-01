import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import type { FormEvent, ReactNode } from 'react';

interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  maxWidth?: 'xs' | 'sm' | 'md';
  isSubmitting: boolean;
  canSubmit: boolean;
  submitLabel: string;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}

/** Shared Dialog/form/actions shell for entity create-or-edit dialogs, replacing
 * each one's near-identical Dialog + form + error alert + Cancel/Submit boilerplate. */
export function FormDialog({
  open,
  onClose,
  title,
  maxWidth = 'sm',
  isSubmitting,
  canSubmit,
  submitLabel,
  error,
  onSubmit,
  children,
}: FormDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth={maxWidth} fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <Box component="form" onSubmit={onSubmit} noValidate>
        <DialogContent>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            {children}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting || !canSubmit}>
            {submitLabel}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
