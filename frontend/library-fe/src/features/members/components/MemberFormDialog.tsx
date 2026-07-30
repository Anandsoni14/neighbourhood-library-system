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

import { MembershipStatus } from '@/types/api';

import type { Member, MemberRequest } from '../types/member.types';

interface MemberFormDialogProps {
  open: boolean;
  member: Member | null;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: MemberRequest) => void;
}

interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  governmentIdType: string;
  governmentIdNumber: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  membershipStatus: MembershipStatus;
  remarks: string;
}

const emptyValues: FormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  governmentIdType: '',
  governmentIdNumber: '',
  street: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  membershipStatus: MembershipStatus.ACTIVE,
  remarks: '',
};

function valuesFromMember(member: Member | null): FormValues {
  if (!member) {
    return emptyValues;
  }
  return {
    firstName: member.first_name,
    lastName: member.last_name,
    email: member.email,
    phoneNumber: member.phone_number ?? '',
    governmentIdType: member.government_id_type ?? '',
    governmentIdNumber: member.government_id_number ?? '',
    street: member.street ?? '',
    city: member.city ?? '',
    state: member.state ?? '',
    postalCode: member.postal_code ?? '',
    country: member.country ?? '',
    membershipStatus: member.membership_status,
    remarks: member.remarks ?? '',
  };
}

// Shared by MembersPage for both "Add member" (member: null) and "Edit member".
// The caller remounts this with a fresh `key` each time it opens (see
// MembersPage), so fields re-seed from `member` via the lazy initializer below
// rather than an effect that would otherwise call setState on every render.
export function MemberFormDialog({
  open,
  member,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: MemberFormDialogProps) {
  const [values, setValues] = useState<FormValues>(() => valuesFromMember(member));
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleChange = (field: keyof FormValues) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleStatusChange = (event: SelectChangeEvent<MembershipStatus>) => {
    setValues((prev) => ({ ...prev, membershipStatus: event.target.value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!values.firstName.trim() || !values.lastName.trim() || !values.email.trim()) {
      setFieldError('First name, last name, and email are required.');
      return;
    }

    setFieldError(null);
    onSubmit({
      first_name: values.firstName.trim(),
      last_name: values.lastName.trim(),
      email: values.email.trim(),
      phone_number: values.phoneNumber.trim() || null,
      government_id_type: values.governmentIdType.trim() || null,
      government_id_number: values.governmentIdNumber.trim() || null,
      street: values.street.trim() || null,
      city: values.city.trim() || null,
      state: values.state.trim() || null,
      postal_code: values.postalCode.trim() || null,
      country: values.country.trim() || null,
      remarks: values.remarks.trim() || null,
      ...(member ? { membership_status: values.membershipStatus } : {}),
    });
  };

  const displayedError = fieldError ?? error;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{member ? 'Edit member' : 'Add member'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogContent>
          <Stack spacing={2}>
            {displayedError && <Alert severity="error">{displayedError}</Alert>}
            <Grid container spacing={2}>
              <Grid size={6}>
                <TextField
                  label="First name"
                  value={values.firstName}
                  onChange={handleChange('firstName')}
                  fullWidth
                  required
                  autoFocus
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
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Phone number"
                  value={values.phoneNumber}
                  onChange={handleChange('phoneNumber')}
                  fullWidth
                />
              </Grid>
              {member && (
                <Grid size={6}>
                  <FormControl fullWidth>
                    <InputLabel id="membership-status-label">Membership status</InputLabel>
                    <Select
                      labelId="membership-status-label"
                      label="Membership status"
                      value={values.membershipStatus}
                      onChange={handleStatusChange}
                    >
                      <MenuItem value={MembershipStatus.ACTIVE}>Active</MenuItem>
                      <MenuItem value={MembershipStatus.BLOCKED}>Blocked</MenuItem>
                      <MenuItem value={MembershipStatus.INACTIVE}>Inactive</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid size={6}>
                <TextField
                  label="Government ID type"
                  value={values.governmentIdType}
                  onChange={handleChange('governmentIdType')}
                  fullWidth
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Government ID number"
                  value={values.governmentIdNumber}
                  onChange={handleChange('governmentIdNumber')}
                  fullWidth
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  label="Street"
                  value={values.street}
                  onChange={handleChange('street')}
                  fullWidth
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="City"
                  value={values.city}
                  onChange={handleChange('city')}
                  fullWidth
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="State"
                  value={values.state}
                  onChange={handleChange('state')}
                  fullWidth
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Postal code"
                  value={values.postalCode}
                  onChange={handleChange('postalCode')}
                  fullWidth
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Country"
                  value={values.country}
                  onChange={handleChange('country')}
                  fullWidth
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  label="Remarks"
                  value={values.remarks}
                  onChange={handleChange('remarks')}
                  fullWidth
                  multiline
                  minRows={2}
                />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {member ? 'Save changes' : 'Add member'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
