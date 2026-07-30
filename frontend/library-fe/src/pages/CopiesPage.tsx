import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
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

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FeedbackSnackbar } from '@/components/FeedbackSnackbar';
import { CopyFormDialog } from '@/features/copies/components/CopyFormDialog';
import { useCopies } from '@/features/copies/hooks/useCopies';
import { BookCopySortField } from '@/features/copies/types/copy.types';
import type {
  BookCopy,
  BookCopyRequest,
  BookCopyUpdateRequest,
} from '@/features/copies/types/copy.types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { CopyCondition, CopyStatus } from '@/types/api';
import { SortDir } from '@/types/common';

/** How long a filter text field must sit idle before it triggers a fetch. */
const FILTER_DEBOUNCE_MS = 300;

interface SortableColumn {
  field: BookCopySortField;
  label: string;
}

const columns: SortableColumn[] = [
  { field: BookCopySortField.BARCODE, label: 'Barcode' },
  { field: BookCopySortField.SHELF_CODE, label: 'Shelf code' },
  { field: BookCopySortField.CONDITION, label: 'Condition' },
  { field: BookCopySortField.STATUS, label: 'Status' },
];

const statusColors: Record<CopyStatus, 'success' | 'warning' | 'error' | 'default'> = {
  [CopyStatus.AVAILABLE]: 'success',
  [CopyStatus.BORROWED]: 'warning',
  [CopyStatus.LOST]: 'error',
  [CopyStatus.MAINTENANCE]: 'default',
};

interface Filters {
  bookId: string;
  status: CopyStatus | '';
  condition: CopyCondition | '';
  barcode: string;
}

const emptyFilters: Filters = { bookId: '', status: '', condition: '', barcode: '' };

export function CopiesPage() {
  useDocumentTitle('Copies');

  const {
    copies,
    total,
    error,
    mutationError,
    isLoading,
    isMutating,
    fetchCopies,
    createCopy,
    updateCopy,
    deleteCopy,
    clearMutationError,
  } = useCopies();

  const [filters, setFilters] = useState<Filters>(emptyFilters);
  // Only the free-text fields are debounced — status/condition are discrete
  // Select choices, not per-keystroke values, so they filter immediately.
  const debouncedBookId = useDebouncedValue(filters.bookId, FILTER_DEBOUNCE_MS);
  const debouncedBarcode = useDebouncedValue(filters.barcode, FILTER_DEBOUNCE_MS);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortBy, setSortBy] = useState<BookCopySortField>(BookCopySortField.BARCODE);
  const [sortDir, setSortDir] = useState<SortDir>(SortDir.ASC);

  const [formOpen, setFormOpen] = useState(false);
  const [editingCopy, setEditingCopy] = useState<BookCopy | null>(null);
  const [deletingCopy, setDeletingCopy] = useState<BookCopy | null>(null);
  // Bumped on every open so CopyFormDialog remounts (and re-seeds its fields
  // from `editingCopy`) instead of needing an effect to reset its state.
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    void fetchCopies({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      bookId: debouncedBookId,
      status: filters.status || undefined,
      condition: filters.condition || undefined,
      barcode: debouncedBarcode,
      sortBy,
      sortDir,
    });
    // fetchCopies is a stable dispatch wrapper; including it would just add noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    rowsPerPage,
    sortBy,
    sortDir,
    debouncedBookId,
    debouncedBarcode,
    filters.status,
    filters.condition,
  ]);

  const handleTextFilterChange =
    (field: 'bookId' | 'barcode') => (event: ChangeEvent<HTMLInputElement>) => {
      setFilters((prev) => ({ ...prev, [field]: event.target.value }));
      setPage(0);
    };

  const handleStatusFilterChange = (event: SelectChangeEvent<CopyStatus | ''>) => {
    setFilters((prev) => ({ ...prev, status: event.target.value }));
    setPage(0);
  };

  const handleConditionFilterChange = (event: SelectChangeEvent<CopyCondition | ''>) => {
    setFilters((prev) => ({ ...prev, condition: event.target.value }));
    setPage(0);
  };

  const handleSort = (field: BookCopySortField) => {
    if (field === sortBy) {
      setSortDir(sortDir === SortDir.ASC ? SortDir.DESC : SortDir.ASC);
    } else {
      setSortBy(field);
      setSortDir(SortDir.ASC);
    }
    setPage(0);
  };

  const refetch = () => {
    void fetchCopies({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      bookId: filters.bookId,
      status: filters.status || undefined,
      condition: filters.condition || undefined,
      barcode: filters.barcode,
      sortBy,
      sortDir,
    });
  };

  const openAddDialog = () => {
    setEditingCopy(null);
    setFormOpen(true);
    setFormKey((key) => key + 1);
  };

  const openEditDialog = (copy: BookCopy) => {
    setEditingCopy(copy);
    setFormOpen(true);
    setFormKey((key) => key + 1);
  };

  const closeFormDialog = () => {
    setFormOpen(false);
    clearMutationError();
  };

  const handleFormSubmit = async (payload: BookCopyRequest | BookCopyUpdateRequest) => {
    const action = editingCopy
      ? await updateCopy(editingCopy.copy_id, payload)
      : await createCopy(payload as BookCopyRequest);

    if (!action.type.endsWith('/rejected')) {
      setFormOpen(false);
      refetch();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCopy) {
      return;
    }
    const action = await deleteCopy(deletingCopy.copy_id);
    setDeletingCopy(null);
    if (!action.type.endsWith('/rejected')) {
      refetch();
    }
  };

  return (
    <Box>
      <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="h2" variant="h4">
          Copies
        </Typography>
        <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openAddDialog}>
          Add copy
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <TextField
            label="Book ID"
            value={filters.bookId}
            onChange={handleTextFilterChange('bookId')}
            sx={{ minWidth: 220 }}
          />
          <TextField
            label="Barcode"
            value={filters.barcode}
            onChange={handleTextFilterChange('barcode')}
            sx={{ minWidth: 160 }}
          />
          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel id="copy-status-filter-label">Status</InputLabel>
            <Select
              labelId="copy-status-filter-label"
              label="Status"
              value={filters.status}
              onChange={handleStatusFilterChange}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value={CopyStatus.AVAILABLE}>Available</MenuItem>
              <MenuItem value={CopyStatus.BORROWED}>Borrowed</MenuItem>
              <MenuItem value={CopyStatus.LOST}>Lost</MenuItem>
              <MenuItem value={CopyStatus.MAINTENANCE}>Maintenance</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel id="copy-condition-filter-label">Condition</InputLabel>
            <Select
              labelId="copy-condition-filter-label"
              label="Condition"
              value={filters.condition}
              onChange={handleConditionFilterChange}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value={CopyCondition.NEW}>New</MenuItem>
              <MenuItem value={CopyCondition.GOOD}>Good</MenuItem>
              <MenuItem value={CopyCondition.FAIR}>Fair</MenuItem>
              <MenuItem value={CopyCondition.DAMAGED}>Damaged</MenuItem>
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
                <TableCell>Book ID</TableCell>
                <TableCell>Max days</TableCell>
                <TableCell>Late fee/day</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {copies.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={columns.length + 4} align="center">
                    No copies found.
                  </TableCell>
                </TableRow>
              )}
              {copies.map((copy) => (
                <TableRow key={copy.copy_id} hover>
                  <TableCell>{copy.barcode}</TableCell>
                  <TableCell>{copy.shelf_code ?? '—'}</TableCell>
                  <TableCell>{copy.condition}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={copy.status}
                      color={statusColors[copy.status]}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{copy.book_id}</TableCell>
                  <TableCell>{copy.max_borrow_days}</TableCell>
                  <TableCell>{copy.late_fee_per_day.toFixed(2)}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={`Edit ${copy.barcode}`}
                      onClick={() => openEditDialog(copy)}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={`Delete ${copy.barcode}`}
                      onClick={() => setDeletingCopy(copy)}
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

      <CopyFormDialog
        key={formKey}
        open={formOpen}
        copy={editingCopy}
        isSubmitting={isMutating}
        error={mutationError}
        onClose={closeFormDialog}
        onSubmit={(payload) => void handleFormSubmit(payload)}
      />

      <ConfirmDialog
        open={deletingCopy !== null}
        title="Delete copy"
        description={`Delete copy "${deletingCopy?.barcode ?? ''}"? This cannot be undone.`}
        isConfirming={isMutating}
        onCancel={() => setDeletingCopy(null)}
        onConfirm={() => void handleConfirmDelete()}
      />

      <FeedbackSnackbar
        open={mutationError !== null && !formOpen && deletingCopy === null}
        message={mutationError}
        severity="error"
        onClose={clearMutationError}
      />
    </Box>
  );
}
