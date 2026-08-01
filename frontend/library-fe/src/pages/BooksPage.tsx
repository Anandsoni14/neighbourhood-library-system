import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
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

import { FeedbackSnackbar } from '@/components/FeedbackSnackbar';
import { BookFormDialog } from '@/features/books/components/BookFormDialog';
import { useBooks } from '@/features/books/hooks/useBooks';
import { BookArchiveFilter, BookSortField } from '@/features/books/types/book.types';
import type { Book, BookRequest } from '@/features/books/types/book.types';
import { useCategories } from '@/features/categories/hooks/useCategories';
import { CategorySortField } from '@/features/categories/types/category.types';
import { BookCopiesDialog } from '@/features/copies/components/BookCopiesDialog';
import { useBookCopyCounts } from '@/features/copies/hooks/useBookCopyCounts';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
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
  categoryId: string;
  isbn: string;
  archived: BookArchiveFilter;
}

const emptyFilters: Filters = {
  title: '',
  author: '',
  categoryId: '',
  isbn: '',
  archived: BookArchiveFilter.ACTIVE,
};

export function BooksPage() {
  useDocumentTitle('Books');

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
    archiveBook,
    unarchiveBook,
    clearMutationError,
  } = useBooks();
  const { categories, fetchCategories } = useCategories();
  const bookIds = books.map((book) => book.book_id);
  const [copyCountsReloadToken, setCopyCountsReloadToken] = useState(0);
  const copyCounts = useBookCopyCounts(bookIds, copyCountsReloadToken);

  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const debouncedFilters = useDebouncedValue(filters, FILTER_DEBOUNCE_MS);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortBy, setSortBy] = useState<BookSortField>(BookSortField.TITLE);
  const [sortDir, setSortDir] = useState<SortDir>(SortDir.ASC);

  const [formOpen, setFormOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  // Bumped on every open so BookFormDialog remounts (and re-seeds its fields
  // from `editingBook`) instead of needing an effect to reset its state.
  const [formKey, setFormKey] = useState(0);
  const [viewingCopiesBook, setViewingCopiesBook] = useState<Book | null>(null);

  useEffect(() => {
    void fetchCategories({
      skip: 0,
      limit: 200,
      includeArchived: false,
      sortBy: CategorySortField.NAME,
      sortDir: SortDir.ASC,
    });
    // Fetched once on mount to populate the category dropdown/filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchBooks({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      title: debouncedFilters.title,
      author: debouncedFilters.author,
      categoryId: debouncedFilters.categoryId || undefined,
      isbn: debouncedFilters.isbn,
      archived: debouncedFilters.archived,
      sortBy,
      sortDir,
    });
    // fetchBooks is a stable dispatch wrapper; including it would just add noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, sortBy, sortDir, debouncedFilters]);

  const handleFilterChange =
    (field: 'title' | 'author' | 'isbn') => (event: ChangeEvent<HTMLInputElement>) => {
      setFilters((prev) => ({ ...prev, [field]: event.target.value }));
      setPage(0);
    };

  const handleCategoryFilterChange = (event: SelectChangeEvent<string>) => {
    setFilters((prev) => ({ ...prev, categoryId: event.target.value }));
    setPage(0);
  };

  const handleArchivedFilterChange = (event: SelectChangeEvent<BookArchiveFilter>) => {
    setFilters((prev) => ({ ...prev, archived: event.target.value }));
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
      categoryId: filters.categoryId || undefined,
      isbn: filters.isbn,
      archived: filters.archived,
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

  const handleToggleArchive = async (book: Book) => {
    const action = book.is_archived
      ? await unarchiveBook(book.book_id)
      : await archiveBook(book.book_id);

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
          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel id="book-category-filter-label">Category</InputLabel>
            <Select
              labelId="book-category-filter-label"
              label="Category"
              value={filters.categoryId}
              onChange={handleCategoryFilterChange}
            >
              <MenuItem value="">All</MenuItem>
              {categories.map((category) => (
                <MenuItem key={category.category_id} value={category.category_id}>
                  {category.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="ISBN"
            value={filters.isbn}
            onChange={handleFilterChange('isbn')}
            sx={{ minWidth: 160 }}
          />
          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel id="book-archived-filter-label">Status</InputLabel>
            <Select
              labelId="book-archived-filter-label"
              label="Status"
              value={filters.archived}
              onChange={handleArchivedFilterChange}
            >
              <MenuItem value={BookArchiveFilter.ACTIVE}>Active</MenuItem>
              <MenuItem value={BookArchiveFilter.ARCHIVED}>Archived</MenuItem>
              <MenuItem value={BookArchiveFilter.ALL}>All</MenuItem>
            </Select>
          </FormControl>
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
                <TableCell>Status</TableCell>
                <TableCell>Copies</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {books.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={columns.length + 4} align="center">
                    No books found.
                  </TableCell>
                </TableRow>
              )}
              {books.map((book) => {
                const counts = copyCounts[book.book_id];
                return (
                  <TableRow
                    key={book.book_id}
                    hover
                    onClick={() => setViewingCopiesBook(book)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{book.title}</TableCell>
                    <TableCell>{book.author}</TableCell>
                    <TableCell>{book.category?.name ?? '—'}</TableCell>
                    <TableCell>{book.published_year ?? '—'}</TableCell>
                    <TableCell>{book.isbn ?? '—'}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={book.is_archived ? 'Archived' : 'Active'}
                        color={book.is_archived ? 'default' : 'success'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{counts ? `${counts.available} / ${counts.total}` : '…'}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        aria-label={`View copies for ${book.title}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setViewingCopiesBook(book);
                        }}
                      >
                        <Inventory2OutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label={`Edit ${book.title}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditDialog(book);
                        }}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label={
                          book.is_archived ? `Unarchive ${book.title}` : `Archive ${book.title}`
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleToggleArchive(book);
                        }}
                      >
                        {book.is_archived ? (
                          <UnarchiveOutlinedIcon fontSize="small" />
                        ) : (
                          <ArchiveOutlinedIcon fontSize="small" />
                        )}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
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
        categories={categories}
        isSubmitting={isMutating}
        error={mutationError}
        onClose={closeFormDialog}
        onSubmit={(payload) => void handleFormSubmit(payload)}
      />

      <BookCopiesDialog
        open={viewingCopiesBook !== null}
        book={viewingCopiesBook}
        onClose={() => setViewingCopiesBook(null)}
        onCopiesChanged={() => setCopyCountsReloadToken((token) => token + 1)}
      />

      <FeedbackSnackbar
        open={mutationError !== null && !formOpen}
        message={mutationError}
        severity="error"
        onClose={clearMutationError}
      />
    </Box>
  );
}
