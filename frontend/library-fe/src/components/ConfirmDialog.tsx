import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  isConfirming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Shared destructive-action confirmation, replacing each page's near-identical dialog. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  isConfirming,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isConfirming}>
          Cancel
        </Button>
        <Button color="error" onClick={onConfirm} disabled={isConfirming}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
