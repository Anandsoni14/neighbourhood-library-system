import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FeedbackSnackbar } from '@/components/FeedbackSnackbar';
import type { Book } from '@/features/books/types/book.types';
import { CopyStatus } from '@/types/api';
import { SortDir } from '@/types/common';

import { useCopies } from '../hooks/useCopies';
import { BookCopySortField } from '../types/copy.types';
import type { BookCopy, BookCopyRequest, BookCopyUpdateRequest } from '../types/copy.types';
import { CopyFormDialog } from './CopyFormDialog';

interface BookCopiesDialogProps {
  open: boolean;
  book: Book | null;
  onClose: () => void;
  /** Notifies the caller so it can refresh any "available copies" counts it shows elsewhere. */
  onCopiesChanged?: () => void;
}

const statusColors: Record<CopyStatus, 'success' | 'warning' | 'error' | 'default'> = {
  [CopyStatus.AVAILABLE]: 'success',
  [CopyStatus.BORROWED]: 'warning',
  [CopyStatus.LOST]: 'error',
  [CopyStatus.MAINTENANCE]: 'default',
};

/** Copies management scoped to a single book, reached from BooksPage's "View
 * copies" action. Mirrors CopiesPage's CRUD flow but pre-filtered to `book.book_id`. */
export function BookCopiesDialog({ open, book, onClose, onCopiesChanged }: BookCopiesDialogProps) {
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

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [formOpen, setFormOpen] = useState(false);
  const [editingCopy, setEditingCopy] = useState<BookCopy | null>(null);
  const [deletingCopy, setDeletingCopy] = useState<BookCopy | null>(null);
  const [formKey, setFormKey] = useState(0);

  const bookId = book?.book_id;

  const refetch = () => {
    if (!bookId) {
      return;
    }
    void fetchCopies({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      bookId,
      sortBy: BookCopySortField.BARCODE,
      sortDir: SortDir.ASC,
    });
  };

  useEffect(() => {
    if (!open || !bookId) {
      return;
    }
    void fetchCopies({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      bookId,
      sortBy: BookCopySortField.BARCODE,
      sortDir: SortDir.ASC,
    });
    // fetchCopies is a stable dispatch wrapper; including it would just add noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bookId, page, rowsPerPage]);

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
      onCopiesChanged?.();
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
      onCopiesChanged?.();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Copies — {book?.title}</DialogTitle>
      <DialogContent>
        <Stack direction="row" sx={{ mb: 2, justifyContent: 'flex-end' }}>
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openAddDialog}>
            Add copy
          </Button>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ position: 'relative' }}>
          {isLoading && <LinearProgress />}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Barcode</TableCell>
                  <TableCell>Shelf code</TableCell>
                  <TableCell>Condition</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Max days</TableCell>
                  <TableCell>Late fee/day</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {copies.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No copies for this book yet.
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
                    <TableCell>{copy.max_borrow_days}</TableCell>
                    <TableCell>{Number(copy.late_fee_per_day).toFixed(2)}</TableCell>
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
            rowsPerPageOptions={[5, 10, 25]}
          />
        </Box>
      </DialogContent>

      <CopyFormDialog
        key={formKey}
        open={formOpen}
        copy={editingCopy}
        books={book ? [book] : []}
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
    </Dialog>
  );
}
