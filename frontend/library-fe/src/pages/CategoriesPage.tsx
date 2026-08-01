import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
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
import { CategoryFormDialog } from '@/features/categories/components/CategoryFormDialog';
import { useCategories } from '@/features/categories/hooks/useCategories';
import { CategorySortField } from '@/features/categories/types/category.types';
import type { Category, CategoryRequest } from '@/features/categories/types/category.types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { SortDir } from '@/types/common';

const FILTER_DEBOUNCE_MS = 300;

export function CategoriesPage() {
  useDocumentTitle('Categories');

  const {
    categories,
    total,
    error,
    mutationError,
    isLoading,
    isMutating,
    fetchCategories,
    createCategory,
    updateCategory,
    archiveCategory,
    unarchiveCategory,
    clearMutationError,
  } = useCategories();

  const [name, setName] = useState('');
  const debouncedName = useDebouncedValue(name, FILTER_DEBOUNCE_MS);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortDir, setSortDir] = useState<SortDir>(SortDir.ASC);

  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    void fetchCategories({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      name: debouncedName,
      includeArchived,
      sortBy: CategorySortField.NAME,
      sortDir,
    });
    // fetchCategories is a stable dispatch wrapper; including it would just add noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, sortDir, debouncedName, includeArchived]);

  const refetch = () => {
    void fetchCategories({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      name,
      includeArchived,
      sortBy: CategorySortField.NAME,
      sortDir,
    });
  };

  const handleSort = () => {
    setSortDir(sortDir === SortDir.ASC ? SortDir.DESC : SortDir.ASC);
    setPage(0);
  };

  const openAddDialog = () => {
    setEditingCategory(null);
    setFormOpen(true);
    setFormKey((key) => key + 1);
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setFormOpen(true);
    setFormKey((key) => key + 1);
  };

  const closeFormDialog = () => {
    setFormOpen(false);
    clearMutationError();
  };

  const handleFormSubmit = async (payload: CategoryRequest) => {
    const action = editingCategory
      ? await updateCategory(editingCategory.category_id, payload)
      : await createCategory(payload);

    if (!action.type.endsWith('/rejected')) {
      setFormOpen(false);
      refetch();
    }
  };

  const handleToggleArchive = async (category: Category) => {
    const action = category.is_archived
      ? await unarchiveCategory(category.category_id)
      : await archiveCategory(category.category_id);

    if (!action.type.endsWith('/rejected')) {
      refetch();
    }
  };

  return (
    <Box>
      <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="h2" variant="h4">
          Categories
        </Typography>
        <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openAddDialog}>
          Add category
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ flexWrap: 'wrap', alignItems: 'center' }}
        >
          <TextField
            label="Name"
            value={name}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setName(event.target.value);
              setPage(0);
            }}
            sx={{ minWidth: 220 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={includeArchived}
                onChange={(event) => {
                  setIncludeArchived(event.target.checked);
                  setPage(0);
                }}
              />
            }
            label="Show archived"
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
                <TableCell>
                  <TableSortLabel active direction={sortDir} onClick={handleSort}>
                    Name
                  </TableSortLabel>
                </TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categories.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    No categories found.
                  </TableCell>
                </TableRow>
              )}
              {categories.map((category) => (
                <TableRow key={category.category_id} hover>
                  <TableCell>{category.name}</TableCell>
                  <TableCell>{category.description ?? '—'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={category.is_archived ? 'Archived' : 'Active'}
                      color={category.is_archived ? 'default' : 'success'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={`Edit ${category.name}`}
                      onClick={() => openEditDialog(category)}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={
                        category.is_archived
                          ? `Unarchive ${category.name}`
                          : `Archive ${category.name}`
                      }
                      onClick={() => void handleToggleArchive(category)}
                    >
                      {category.is_archived ? (
                        <UnarchiveOutlinedIcon fontSize="small" />
                      ) : (
                        <ArchiveOutlinedIcon fontSize="small" />
                      )}
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

      <CategoryFormDialog
        key={formKey}
        open={formOpen}
        category={editingCategory}
        isSubmitting={isMutating}
        error={mutationError}
        onClose={closeFormDialog}
        onSubmit={(payload) => void handleFormSubmit(payload)}
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
