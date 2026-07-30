import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { type FormEvent, useState } from 'react';

import { CopyCondition } from '@/types/api';

import type { Loan, LoanReturnRequest } from '../types/loan.types';

interface ReturnLoanDialogProps {
  open: boolean;
  loan: Loan | null;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: LoanReturnRequest) => void;
}

// Opened per-loan (parent bumps a `key` when it opens for a different loan,
// same reset rationale as IssueLoanDialog). No condition default — the return
// condition is a meaningful choice every time, unlike CopyFormDialog's NEW
// default for a brand-new copy.
export function ReturnLoanDialog({
  open,
  loan,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: ReturnLoanDialogProps) {
  const [condition, setCondition] = useState<CopyCondition | ''>('');
  const [remarks, setRemarks] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleConditionChange = (event: SelectChangeEvent<CopyCondition | ''>) => {
    setCondition(event.target.value);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!condition) {
      setFieldError('Return condition is required.');
      return;
    }

    setFieldError(null);
    onSubmit({ return_condition: condition, remarks: remarks.trim() || null });
  };

  const displayedError = fieldError ?? error;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Return loan</DialogTitle>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogContent>
          <Stack spacing={2}>
            <DialogContentText>Returning copy for loan {loan?.loan_id ?? ''}.</DialogContentText>
            {displayedError && <Alert severity="error">{displayedError}</Alert>}
            <FormControl fullWidth required>
              <InputLabel id="return-condition-label">Return condition</InputLabel>
              <Select
                labelId="return-condition-label"
                label="Return condition"
                value={condition}
                onChange={handleConditionChange}
              >
                <MenuItem value={CopyCondition.NEW}>New</MenuItem>
                <MenuItem value={CopyCondition.GOOD}>Good</MenuItem>
                <MenuItem value={CopyCondition.FAIR}>Fair</MenuItem>
                <MenuItem value={CopyCondition.DAMAGED}>Damaged</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            Return
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
