import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { type ChangeEvent, type FormEvent, useState } from 'react';

import type { Category, CategoryRequest } from '../types/category.types';

interface CategoryFormDialogProps {
  open: boolean;
  category: Category | null;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: CategoryRequest) => void;
}

interface FormValues {
  name: string;
  description: string;
}

const emptyValues: FormValues = { name: '', description: '' };

function valuesFromCategory(category: Category | null): FormValues {
  if (!category) {
    return emptyValues;
  }
  return { name: category.name, description: category.description ?? '' };
}

// Shared by CategoriesPage for both "Add category" (category: null) and "Edit
// category". The caller remounts this with a fresh `key` each time it opens
// (see CategoriesPage), so fields re-seed via the lazy initializer below.
export function CategoryFormDialog({
  open,
  category,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: CategoryFormDialogProps) {
  const [values, setValues] = useState<FormValues>(() => valuesFromCategory(category));
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleChange = (field: keyof FormValues) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const canSubmit = values.name.trim().length > 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      setFieldError('Name is required.');
      return;
    }

    setFieldError(null);
    onSubmit({
      name: values.name.trim(),
      description: values.description.trim() || null,
    });
  };

  const displayedError = fieldError ?? error;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{category ? 'Edit category' : 'Add category'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogContent>
          <Stack spacing={2}>
            {displayedError && <Alert severity="error">{displayedError}</Alert>}
            <TextField
              label="Name"
              value={values.name}
              onChange={handleChange('name')}
              fullWidth
              required
              autoFocus
            />
            <TextField
              label="Description"
              value={values.description}
              onChange={handleChange('description')}
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
          <Button type="submit" variant="contained" disabled={isSubmitting || !canSubmit}>
            {category ? 'Save changes' : 'Add category'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
