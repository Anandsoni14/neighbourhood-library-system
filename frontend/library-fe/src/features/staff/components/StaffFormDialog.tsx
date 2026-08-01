import Alert from '@mui/material/Alert';
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

import { StaffRole } from '@/types/api';

import type { Staff, StaffCreateRequest, StaffUpdateRequest } from '../types/staff.types';

interface StaffFormDialogProps {
  open: boolean;
  staff: Staff | null;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: StaffCreateRequest | StaffUpdateRequest) => void;
}

interface FormValues {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber: string;
  role: StaffRole;
}

const emptyValues: FormValues = {
  employeeCode: '',
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phoneNumber: '',
  role: StaffRole.LIBRARIAN,
};

function valuesFromStaff(staff: Staff | null): FormValues {
  if (!staff) {
    return emptyValues;
  }
  return {
    employeeCode: staff.employee_code,
    firstName: staff.first_name,
    lastName: staff.last_name,
    email: staff.email,
    password: '',
    phoneNumber: staff.phone_number ?? '',
    role: staff.role,
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{10}$/;

// Shared for "Add staff" (staff: null) and "Edit staff"; the caller remounts
// with a fresh `key` each open. Password is only collected on create — a
// password change is a separate backend endpoint this dialog doesn't drive.
export function StaffFormDialog({
  open,
  staff,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: StaffFormDialogProps) {
  const [values, setValues] = useState<FormValues>(() => valuesFromStaff(staff));
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleChange = (field: keyof FormValues) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleRoleChange = (event: SelectChangeEvent<StaffRole>) => {
    setValues((prev) => ({ ...prev, role: event.target.value }));
  };

  const phoneValid =
    values.phoneNumber.trim() === '' || PHONE_PATTERN.test(values.phoneNumber.trim());
  const canSubmit =
    values.firstName.trim().length > 0 &&
    values.lastName.trim().length > 0 &&
    EMAIL_PATTERN.test(values.email.trim()) &&
    phoneValid &&
    (staff !== null ||
      (values.employeeCode.trim().length > 0 && values.password.trim().length >= 8));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !values.firstName.trim() ||
      !values.lastName.trim() ||
      !EMAIL_PATTERN.test(values.email.trim())
    ) {
      setFieldError('First name, last name, and a valid email are required.');
      return;
    }
    if (!phoneValid) {
      setFieldError('Phone number must be exactly 10 digits.');
      return;
    }

    if (!staff) {
      if (!values.employeeCode.trim()) {
        setFieldError('Employee code is required.');
        return;
      }
      if (values.password.trim().length < 8) {
        setFieldError('Password must be at least 8 characters.');
        return;
      }
      setFieldError(null);
      const payload: StaffCreateRequest = {
        employee_code: values.employeeCode.trim(),
        first_name: values.firstName.trim(),
        last_name: values.lastName.trim(),
        email: values.email.trim(),
        password: values.password,
        phone_number: values.phoneNumber.trim() || null,
        role: values.role,
      };
      onSubmit(payload);
      return;
    }

    setFieldError(null);
    const payload: StaffUpdateRequest = {
      first_name: values.firstName.trim(),
      last_name: values.lastName.trim(),
      email: values.email.trim(),
      phone_number: values.phoneNumber.trim() || null,
      role: values.role,
    };
    onSubmit(payload);
  };

  const displayedError = fieldError ?? error;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{staff ? 'Edit staff member' : 'Add staff member'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogContent>
          <Stack spacing={2}>
            {displayedError && <Alert severity="error">{displayedError}</Alert>}
            <Grid container spacing={2}>
              {!staff && (
                <Grid size={6}>
                  <TextField
                    label="Employee code"
                    value={values.employeeCode}
                    onChange={handleChange('employeeCode')}
                    fullWidth
                    required
                    autoFocus
                  />
                </Grid>
              )}
              <Grid size={6}>
                <TextField
                  label="First name"
                  value={values.firstName}
                  onChange={handleChange('firstName')}
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Last name"
                  value={values.lastName}
                  onChange={handleChange('lastName')}
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Email"
                  type="email"
                  value={values.email}
                  onChange={handleChange('email')}
                  fullWidth
                  required
                  error={values.email.trim().length > 0 && !EMAIL_PATTERN.test(values.email.trim())}
                  helperText={
                    values.email.trim().length > 0 && !EMAIL_PATTERN.test(values.email.trim())
                      ? 'Enter a valid email address.'
                      : ' '
                  }
                />
              </Grid>
              {!staff && (
                <Grid size={6}>
                  <TextField
                    label="Password"
                    type="password"
                    value={values.password}
                    onChange={handleChange('password')}
                    fullWidth
                    required
                    helperText="At least 8 characters."
                  />
                </Grid>
              )}
              <Grid size={6}>
                <TextField
                  label="Phone number"
                  value={values.phoneNumber}
                  onChange={handleChange('phoneNumber')}
                  fullWidth
                  error={!phoneValid}
                  helperText={phoneValid ? ' ' : 'Must be exactly 10 digits.'}
                />
              </Grid>
              <Grid size={6}>
                <FormControl fullWidth>
                  <InputLabel id="staff-role-label">Role</InputLabel>
                  <Select
                    labelId="staff-role-label"
                    label="Role"
                    value={values.role}
                    onChange={handleRoleChange}
                  >
                    <MenuItem value={StaffRole.LIBRARIAN}>Librarian</MenuItem>
                    <MenuItem value={StaffRole.ADMIN}>Admin</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting || !canSubmit}>
            {staff ? 'Save changes' : 'Add staff member'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
