import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { type ChangeEvent, type FormEvent, useState } from 'react';

import type { Book, BookRequest } from '../types/book.types';

interface BookFormDialogProps {
  open: boolean;
  book: Book | null;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: BookRequest) => void;
}

interface FormValues {
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  category: string;
  description: string;
  publishedYear: string;
}

const emptyValues: FormValues = {
  title: '',
  author: '',
  publisher: '',
  isbn: '',
  category: '',
  description: '',
  publishedYear: '',
};

function valuesFromBook(book: Book | null): FormValues {
  if (!book) {
    return emptyValues;
  }
  return {
    title: book.title,
    author: book.author,
    publisher: book.publisher ?? '',
    isbn: book.isbn ?? '',
    category: book.category ?? '',
    description: book.description ?? '',
    publishedYear: book.published_year != null ? String(book.published_year) : '',
  };
}

// Shared by BooksPage for both "Add book" (book: null) and "Edit book".
// The caller remounts this with a fresh `key` each time it opens (see
// BooksPage), so fields re-seed from `book` via the lazy initializer below
// rather than an effect that would otherwise call setState on every render.
export function BookFormDialog({
  open,
  book,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: BookFormDialogProps) {
  const [values, setValues] = useState<FormValues>(() => valuesFromBook(book));
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleChange = (field: keyof FormValues) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!values.title.trim() || !values.author.trim()) {
      setFieldError('Title and author are required.');
      return;
    }

    let publishedYear: number | undefined;
    if (values.publishedYear.trim()) {
      const parsed = Number(values.publishedYear);
      if (!Number.isInteger(parsed)) {
        setFieldError('Published year must be a whole number.');
        return;
      }
      publishedYear = parsed;
    }

    setFieldError(null);
    onSubmit({
      title: values.title.trim(),
      author: values.author.trim(),
      publisher: values.publisher.trim() || null,
      isbn: values.isbn.trim() || null,
      category: values.category.trim() || null,
      description: values.description.trim() || null,
      published_year: publishedYear ?? null,
    });
  };

  const displayedError = fieldError ?? error;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{book ? 'Edit book' : 'Add book'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogContent>
          <Stack spacing={2}>
            {displayedError && <Alert severity="error">{displayedError}</Alert>}
            <Grid container spacing={2}>
              <Grid size={6}>
                <TextField
                  label="Title"
                  value={values.title}
                  onChange={handleChange('title')}
                  fullWidth
                  required
                  autoFocus
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Author"
                  value={values.author}
                  onChange={handleChange('author')}
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Publisher"
                  value={values.publisher}
                  onChange={handleChange('publisher')}
                  fullWidth
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="ISBN"
                  value={values.isbn}
                  onChange={handleChange('isbn')}
                  fullWidth
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Category"
                  value={values.category}
                  onChange={handleChange('category')}
                  fullWidth
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Published year"
                  value={values.publishedYear}
                  onChange={handleChange('publishedYear')}
                  fullWidth
                  inputMode="numeric"
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  label="Description"
                  value={values.description}
                  onChange={handleChange('description')}
                  fullWidth
                  multiline
                  minRows={3}
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
            {book ? 'Save changes' : 'Add book'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
