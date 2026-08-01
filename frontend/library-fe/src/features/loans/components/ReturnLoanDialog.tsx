import DialogContentText from '@mui/material/DialogContentText';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import { type FormEvent, useState } from 'react';

import { FormDialog } from '@/components/FormDialog';
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

  const canSubmit = condition !== '';

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
    <FormDialog
      open={open}
      onClose={onClose}
      title="Return loan"
      maxWidth="xs"
      isSubmitting={isSubmitting}
      canSubmit={canSubmit}
      submitLabel="Return"
      error={displayedError}
      onSubmit={handleSubmit}
    >
      <DialogContentText>Returning copy for loan {loan?.loan_id ?? ''}.</DialogContentText>
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
    </FormDialog>
  );
}
