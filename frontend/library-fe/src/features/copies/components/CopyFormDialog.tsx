import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { type ChangeEvent, type FormEvent, useState } from 'react';

import type { Book } from '@/features/books/types/book.types';
import { CopyCondition, CopyStatus } from '@/types/api';

import type { BookCopy, BookCopyRequest, BookCopyUpdateRequest } from '../types/copy.types';

interface CopyFormDialogProps {
  open: boolean;
  copy: BookCopy | null;
  /** Books eligible to receive a new copy — only needed (and only rendered) on create. */
  books: Book[];
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: BookCopyRequest | BookCopyUpdateRequest) => void;
}

interface FormValues {
  bookId: string;
  barcode: string;
  shelfCode: string;
  condition: CopyCondition;
  status: CopyStatus;
  maxBorrowDays: string;
  lateFeePerDay: string;
}

const emptyValues: FormValues = {
  bookId: '',
  barcode: '',
  shelfCode: '',
  condition: CopyCondition.NEW,
  status: CopyStatus.AVAILABLE,
  maxBorrowDays: '',
  lateFeePerDay: '',
};

function valuesFromCopy(copy: BookCopy | null): FormValues {
  if (!copy) {
    return emptyValues;
  }
  return {
    bookId: copy.book_id,
    barcode: copy.barcode,
    shelfCode: copy.shelf_code ?? '',
    condition: copy.condition,
    status: copy.status,
    maxBorrowDays: String(copy.max_borrow_days),
    lateFeePerDay: String(copy.late_fee_per_day),
  };
}

// Shared by CopiesPage for both "Add copy" (copy: null) and "Edit copy".
// The caller remounts this with a fresh `key` each time it opens (see
// CopiesPage), so fields re-seed from `copy` via the lazy initializer below
// rather than an effect that would otherwise call setState on every render.
export function CopyFormDialog({
  open,
  copy,
  books,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: CopyFormDialogProps) {
  const [values, setValues] = useState<FormValues>(() => valuesFromCopy(copy));
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleChange = (field: keyof FormValues) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleConditionChange = (event: SelectChangeEvent<CopyCondition>) => {
    setValues((prev) => ({ ...prev, condition: event.target.value }));
  };

  const handleStatusChange = (event: SelectChangeEvent<CopyStatus>) => {
    setValues((prev) => ({ ...prev, status: event.target.value }));
  };

  const maxBorrowDaysValid =
    values.maxBorrowDays.trim() === '' ||
    (Number.isInteger(Number(values.maxBorrowDays)) && Number(values.maxBorrowDays) > 0);
  const lateFeeValid =
    values.lateFeePerDay.trim() === '' ||
    (!Number.isNaN(Number(values.lateFeePerDay)) && Number(values.lateFeePerDay) >= 0);
  // Gated on required-field presence only — the optional numeric fields keep
  // their existing on-submit validation (below) rather than also disabling
  // the button, so a typo mid-edit doesn't lock the form before the error
  // message ever has a chance to explain what's wrong.
  const canSubmit = (copy !== null || values.bookId.trim().length > 0) && values.barcode.trim().length > 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!copy && !values.bookId.trim()) {
      setFieldError('Book is required.');
      return;
    }
    if (!values.barcode.trim()) {
      setFieldError('Barcode is required.');
      return;
    }

    let maxBorrowDays: number | undefined;
    if (values.maxBorrowDays.trim()) {
      const parsed = Number(values.maxBorrowDays);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        setFieldError('Max borrow days must be a positive whole number.');
        return;
      }
      maxBorrowDays = parsed;
    }

    let lateFeePerDay: number | undefined;
    if (values.lateFeePerDay.trim()) {
      const parsed = Number(values.lateFeePerDay);
      if (Number.isNaN(parsed) || parsed < 0) {
        setFieldError('Late fee per day must be a non-negative number.');
        return;
      }
      lateFeePerDay = parsed;
    }

    setFieldError(null);

    if (copy) {
      const payload: BookCopyUpdateRequest = {
        barcode: values.barcode.trim(),
        shelf_code: values.shelfCode.trim() || null,
        condition: values.condition,
        status: values.status,
        max_borrow_days: maxBorrowDays,
        late_fee_per_day: lateFeePerDay,
      };
      onSubmit(payload);
      return;
    }

    const payload: BookCopyRequest = {
      book_id: values.bookId.trim(),
      barcode: values.barcode.trim(),
      shelf_code: values.shelfCode.trim() || null,
      condition: values.condition,
      max_borrow_days: maxBorrowDays,
      late_fee_per_day: lateFeePerDay,
    };
    onSubmit(payload);
  };

  const displayedError = fieldError ?? error;
  const selectedBook = books.find((book) => book.book_id === values.bookId) ?? null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{copy ? 'Edit copy' : 'Add copy'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogContent>
          <Stack spacing={2}>
            {displayedError && <Alert severity="error">{displayedError}</Alert>}
            <Grid container spacing={2}>
              {!copy && (
                <Grid size={12}>
                  <Autocomplete
                    options={books}
                    getOptionLabel={(book) => `${book.title} — ${book.author}`}
                    value={selectedBook}
                    onChange={(_event, newValue) => {
                      setValues((prev) => ({ ...prev, bookId: newValue?.book_id ?? '' }));
                    }}
                    isOptionEqualToValue={(option, value) => option.book_id === value.book_id}
                    renderInput={(params) => (
                      <TextField {...params} label="Book" required autoFocus />
                    )}
                  />
                </Grid>
              )}
              <Grid size={6}>
                <TextField
                  label="Barcode"
                  value={values.barcode}
                  onChange={handleChange('barcode')}
                  fullWidth
                  required
                  autoFocus={copy !== null}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Shelf code"
                  value={values.shelfCode}
                  onChange={handleChange('shelfCode')}
                  fullWidth
                />
              </Grid>
              <Grid size={6}>
                <FormControl fullWidth>
                  <InputLabel id="condition-label">Condition</InputLabel>
                  <Select
                    labelId="condition-label"
                    label="Condition"
                    value={values.condition}
                    onChange={handleConditionChange}
                  >
                    <MenuItem value={CopyCondition.NEW}>New</MenuItem>
                    <MenuItem value={CopyCondition.GOOD}>Good</MenuItem>
                    <MenuItem value={CopyCondition.FAIR}>Fair</MenuItem>
                    <MenuItem value={CopyCondition.DAMAGED}>Damaged</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {copy && (
                <Grid size={6}>
                  <FormControl fullWidth>
                    <InputLabel id="status-label">Status</InputLabel>
                    <Select
                      labelId="status-label"
                      label="Status"
                      value={values.status}
                      onChange={handleStatusChange}
                    >
                      <MenuItem value={CopyStatus.AVAILABLE}>Available</MenuItem>
                      <MenuItem value={CopyStatus.BORROWED}>Borrowed</MenuItem>
                      <MenuItem value={CopyStatus.LOST}>Lost</MenuItem>
                      <MenuItem value={CopyStatus.MAINTENANCE}>Maintenance</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid size={6}>
                <TextField
                  label="Max borrow days"
                  value={values.maxBorrowDays}
                  onChange={handleChange('maxBorrowDays')}
                  fullWidth
                  inputMode="numeric"
                  error={!maxBorrowDaysValid}
                  helperText={maxBorrowDaysValid ? ' ' : 'Positive whole number.'}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Late fee per day"
                  value={values.lateFeePerDay}
                  onChange={handleChange('lateFeePerDay')}
                  fullWidth
                  inputMode="decimal"
                  error={!lateFeeValid}
                  helperText={lateFeeValid ? ' ' : 'Non-negative number.'}
                />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting || !canSubmit}>
            {copy ? 'Save changes' : 'Add copy'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
