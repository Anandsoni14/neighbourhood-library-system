import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type ChangeEvent, useEffect, useState } from 'react';

import { BookFormDialog } from '@/features/books/components/BookFormDialog';
import { useBooks } from '@/features/books/hooks/useBooks';
import { BookSortField } from '@/features/books/types/book.types';
import type { Book, BookRequest } from '@/features/books/types/book.types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { SortDir } from '@/types/common';

/** How long a filter text field must sit idle before it triggers a fetch. */
const FILTER_DEBOUNCE_MS = 300;

interface SortableColumn {
  field: BookSortField;
  label: string;
}

const columns: SortableColumn[] = [
  { field: BookSortField.TITLE, label: 'Title' },
  { field: BookSortField.AUTHOR, label: 'Author' },
  { field: BookSortField.CATEGORY, label: 'Category' },
  { field: BookSortField.PUBLISHED_YEAR, label: 'Year' },
];

interface Filters {
  title: string;
  author: string;
  category: string;
  isbn: string;
}

const emptyFilters: Filters = { title: '', author: '', category: '', isbn: '' };

export function BooksPage() {
  const {
    books,
    total,
    error,
    mutationError,
    isLoading,
    isMutating,
    fetchBooks,
    createBook,
    updateBook,
    deleteBook,
    clearMutationError,
  } = useBooks();

  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const debouncedFilters = useDebouncedValue(filters, FILTER_DEBOUNCE_MS);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortBy, setSortBy] = useState<BookSortField>(BookSortField.TITLE);
  const [sortDir, setSortDir] = useState<SortDir>(SortDir.ASC);

  const [formOpen, setFormOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [deletingBook, setDeletingBook] = useState<Book | null>(null);
  // Bumped on every open so BookFormDialog remounts (and re-seeds its fields
  // from `editingBook`) instead of needing an effect to reset its state.
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    void fetchBooks({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      title: debouncedFilters.title,
      author: debouncedFilters.author,
      category: debouncedFilters.category,
      isbn: debouncedFilters.isbn,
      sortBy,
      sortDir,
    });
    // fetchBooks is a stable dispatch wrapper; including it would just add noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, sortBy, sortDir, debouncedFilters]);

  const handleFilterChange = (field: keyof Filters) => (event: ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, [field]: event.target.value }));
    setPage(0);
  };

  const handleSort = (field: BookSortField) => {
    if (field === sortBy) {
      setSortDir(sortDir === SortDir.ASC ? SortDir.DESC : SortDir.ASC);
    } else {
      setSortBy(field);
      setSortDir(SortDir.ASC);
    }
    setPage(0);
  };

  const refetch = () => {
    void fetchBooks({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      title: filters.title,
      author: filters.author,
      category: filters.category,
      isbn: filters.isbn,
      sortBy,
      sortDir,
    });
  };

  const openAddDialog = () => {
    setEditingBook(null);
    setFormOpen(true);
    setFormKey((key) => key + 1);
  };

  const openEditDialog = (book: Book) => {
    setEditingBook(book);
    setFormOpen(true);
    setFormKey((key) => key + 1);
  };

  const closeFormDialog = () => {
    setFormOpen(false);
    clearMutationError();
  };

  const handleFormSubmit = async (payload: BookRequest) => {
    const action = editingBook
      ? await updateBook(editingBook.book_id, payload)
      : await createBook(payload);

    if (!action.type.endsWith('/rejected')) {
      setFormOpen(false);
      refetch();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingBook) {
      return;
    }
    const action = await deleteBook(deletingBook.book_id);
    setDeletingBook(null);
    if (!action.type.endsWith('/rejected')) {
      refetch();
    }
  };

  return (
    <Box>
      <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="h2" variant="h4">
          Books
        </Typography>
        <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openAddDialog}>
          Add book
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <TextField
            label="Title"
            value={filters.title}
            onChange={handleFilterChange('title')}
            sx={{ minWidth: 180 }}
          />
          <TextField
            label="Author"
            value={filters.author}
            onChange={handleFilterChange('author')}
            sx={{ minWidth: 180 }}
          />
          <TextField
            label="Category"
            value={filters.category}
            onChange={handleFilterChange('category')}
            sx={{ minWidth: 160 }}
          />
          <TextField
            label="ISBN"
            value={filters.isbn}
            onChange={handleFilterChange('isbn')}
            sx={{ minWidth: 160 }}
          />
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper>
        {isLoading && <LinearProgress />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell key={column.field}>
                    <TableSortLabel
                      active={sortBy === column.field}
                      direction={sortBy === column.field ? sortDir : SortDir.ASC}
                      onClick={() => handleSort(column.field)}
                    >
                      {column.label}
                    </TableSortLabel>
                  </TableCell>
                ))}
                <TableCell>ISBN</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {books.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={columns.length + 2} align="center">
                    No books found.
                  </TableCell>
                </TableRow>
              )}
              {books.map((book) => (
                <TableRow key={book.book_id} hover>
                  <TableCell>{book.title}</TableCell>
                  <TableCell>{book.author}</TableCell>
                  <TableCell>{book.category ?? '—'}</TableCell>
                  <TableCell>{book.published_year ?? '—'}</TableCell>
                  <TableCell>{book.isbn ?? '—'}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={`Edit ${book.title}`}
                      onClick={() => openEditDialog(book)}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={`Delete ${book.title}`}
                      onClick={() => setDeletingBook(book)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_event, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>

      <BookFormDialog
        key={formKey}
        open={formOpen}
        book={editingBook}
        isSubmitting={isMutating}
        error={mutationError}
        onClose={closeFormDialog}
        onSubmit={(payload) => void handleFormSubmit(payload)}
      />

      <Dialog open={deletingBook !== null} onClose={() => setDeletingBook(null)}>
        <DialogTitle>Delete book</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete “{deletingBook?.title}”? This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingBook(null)} disabled={isMutating}>
            Cancel
          </Button>
          <Button color="error" onClick={() => void handleConfirmDelete()} disabled={isMutating}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={mutationError !== null && !formOpen && deletingBook === null}
        autoHideDuration={6000}
        onClose={clearMutationError}
      >
        <Alert severity="error" onClose={clearMutationError}>
          {mutationError}
        </Alert>
      </Snackbar>
    </Box>
  );
}
