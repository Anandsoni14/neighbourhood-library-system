import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  GridActionsCellItem,
  type GridColDef,
  type GridFilterModel,
  type GridRowParams,
  type GridSortModel,
} from '@mui/x-data-grid';
import { useEffect, useMemo, useState } from 'react';

import { DataTable } from '@/components/DataTable';
import { FeedbackSnackbar } from '@/components/FeedbackSnackbar';
import { BookFormDialog } from '@/features/books/components/BookFormDialog';
import { useBooks } from '@/features/books/hooks/useBooks';
import { BookArchiveFilter, BookSortField } from '@/features/books/types/book.types';
import type { Book, BookRequest } from '@/features/books/types/book.types';
import { useCategories } from '@/features/categories/hooks/useCategories';
import { CategorySortField } from '@/features/categories/types/category.types';
import { BookCopiesDialog } from '@/features/copies/components/BookCopiesDialog';
import { useBookCopyCounts } from '@/features/copies/hooks/useBookCopyCounts';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useTableQueryParams } from '@/hooks/useTableQueryParams';
import { SortDir } from '@/types/common';
import {
  containsOnlyOperators,
  equalsOnlyOperators,
  filtersFromFilterModel,
} from '@/utils/gridFilterOperators';

type Filters = Record<'title' | 'author' | 'category' | 'isbn' | 'status' | 'stock', string>;

const emptyFilters: Filters = {
  title: '',
  author: '',
  category: '',
  isbn: '',
  status: '',
  stock: '',
};

// No default filter: MUI Community's filter panel only supports one active
// filter at a time, so pre-setting Status would block filtering by anything else.
const defaultFilters: Filters = emptyFilters;

const STATUS_OPTIONS = ['Active', 'Archived', 'All'];
const STOCK_OPTIONS = ['In Stock', 'Out of Stock'];

function statusToArchiveFilter(status: string): BookArchiveFilter {
  if (status === 'Active') {
    return BookArchiveFilter.ACTIVE;
  }
  if (status === 'Archived') {
    return BookArchiveFilter.ARCHIVED;
  }
  return BookArchiveFilter.ALL;
}

function stockToInStock(stock: string): boolean | undefined {
  if (stock === 'In Stock') {
    return true;
  }
  if (stock === 'Out of Stock') {
    return false;
  }
  return undefined;
}

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

  const {
    filters,
    debouncedFilters,
    setFilters,
    page,
    pageSize,
    setPagination,
    sortField,
    sortDir,
    setSort,
  } = useTableQueryParams<Filters>({
    defaultFilters,
    defaultSortField: BookSortField.TITLE,
  });

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

  const fetchParams = {
    skip: page * pageSize,
    limit: pageSize,
    title: debouncedFilters.title || undefined,
    author: debouncedFilters.author || undefined,
    categoryId: debouncedFilters.category || undefined,
    isbn: debouncedFilters.isbn || undefined,
    archived: statusToArchiveFilter(debouncedFilters.status),
    inStock: stockToInStock(debouncedFilters.stock),
    sortBy: sortField as BookSortField,
    sortDir,
  };

  useEffect(() => {
    void fetchBooks(fetchParams);
    // fetchBooks is a stable dispatch wrapper; including it (or the object
    // literal above) would just add noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sortField, sortDir, debouncedFilters]);

  const refetch = () => void fetchBooks(fetchParams);

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

  // Local state, not derived from committed `filters` (which drops empty
  // values) — otherwise picking a new Column before typing a Value would
  // vanish on the next render as the controlled prop snaps back.
  const [filterModel, setFilterModel] = useState<GridFilterModel>(() => ({
    items: (Object.keys(filters) as (keyof Filters)[])
      .filter((key) => filters[key])
      .map((key) => ({
        field: key,
        operator: key === 'category' || key === 'status' || key === 'stock' ? 'is' : 'contains',
        value: filters[key],
      })),
  }));

  const handleFilterModelChange = (model: GridFilterModel) => {
    setFilterModel(model);
    setFilters(filtersFromFilterModel(model, emptyFilters));
  };

  const handleSortModelChange = (model: GridSortModel) => {
    const item = model[0];
    if (item?.sort) {
      setSort(item.field, item.sort === 'desc' ? SortDir.DESC : SortDir.ASC);
    }
  };

  // Memoized: DataGrid compares controlled paginationModel/sortModel by
  // reference, so a fresh literal every render causes it to re-sync to page 0.
  const paginationModel = useMemo(() => ({ page, pageSize }), [page, pageSize]);
  const sortModel: GridSortModel = useMemo(
    () => [{ field: sortField, sort: sortDir }],
    [sortField, sortDir],
  );

  // Not memoized: closes over render-scoped state (categories, copyCounts,
  // handleToggleArchive) that would all need to be deps anyway; recomputing
  // this small array each render is cheap and avoids stale-closure bugs.
  const columns: GridColDef<Book>[] = [
    { field: 'title', headerName: 'Title', flex: 1.2, filterOperators: containsOnlyOperators },
    { field: 'author', headerName: 'Author', flex: 1, filterOperators: containsOnlyOperators },
    {
      field: 'category',
      headerName: 'Category',
      flex: 1,
      type: 'singleSelect',
      valueOptions: categories.map((category) => ({
        value: category.category_id,
        label: category.name,
      })),
      valueGetter: (_value, row) => row.category?.category_id ?? '',
      renderCell: (params) => params.row.category?.name ?? '—',
      filterOperators: equalsOnlyOperators,
    },
    {
      field: 'published_year',
      headerName: 'Year',
      width: 100,
      filterable: false,
      valueGetter: (_value, row) => row.published_year ?? '—',
    },
    {
      field: 'isbn',
      headerName: 'ISBN',
      flex: 1,
      sortable: false,
      filterOperators: containsOnlyOperators,
      valueGetter: (_value, row) => row.isbn ?? '—',
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      sortable: false,
      type: 'singleSelect',
      valueOptions: STATUS_OPTIONS,
      filterOperators: equalsOnlyOperators,
      renderCell: (params) => (
        <Chip
          size="small"
          label={params.row.is_archived ? 'Archived' : 'Active'}
          color={params.row.is_archived ? 'default' : 'success'}
          variant="outlined"
        />
      ),
    },
    {
      field: 'stock',
      headerName: 'Stock',
      width: 130,
      sortable: false,
      type: 'singleSelect',
      valueOptions: STOCK_OPTIONS,
      filterOperators: equalsOnlyOperators,
      renderCell: (params) => {
        const counts = copyCounts[params.row.book_id];
        return counts ? `${counts.available} / ${counts.total}` : '…';
      },
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 140,
      getActions: (params: GridRowParams<Book>) => [
        // Tooltip overwrites the child's aria-label with its own `title`, so
        // both must carry the same text to keep the button properly named.
        <Tooltip key="view-copies" title={`View copies for ${params.row.title}`}>
          <GridActionsCellItem
            icon={<Inventory2OutlinedIcon fontSize="small" />}
            label={`View copies for ${params.row.title}`}
            onClick={() => setViewingCopiesBook(params.row)}
            showInMenu={false}
          />
        </Tooltip>,
        <Tooltip key="edit" title={`Edit ${params.row.title}`}>
          <GridActionsCellItem
            icon={<EditOutlinedIcon fontSize="small" />}
            label={`Edit ${params.row.title}`}
            onClick={() => openEditDialog(params.row)}
            showInMenu={false}
          />
        </Tooltip>,
        <Tooltip
          key="archive"
          title={
            params.row.is_archived ? `Unarchive ${params.row.title}` : `Archive ${params.row.title}`
          }
        >
          <GridActionsCellItem
            icon={
              params.row.is_archived ? (
                <UnarchiveOutlinedIcon fontSize="small" />
              ) : (
                <ArchiveOutlinedIcon fontSize="small" />
              )
            }
            label={
              params.row.is_archived
                ? `Unarchive ${params.row.title}`
                : `Archive ${params.row.title}`
            }
            onClick={() => void handleToggleArchive(params.row)}
            showInMenu={false}
          />
        </Tooltip>,
      ],
    },
  ];

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

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <DataTable
        columns={columns}
        rows={books}
        getRowId={(row: Book) => row.book_id}
        rowCount={total}
        loading={isLoading}
        autoHeight
        paginationModel={paginationModel}
        onPaginationModelChange={(model) => setPagination(model.page, model.pageSize)}
        sortModel={sortModel}
        onSortModelChange={handleSortModelChange}
        filterModel={filterModel}
        onFilterModelChange={handleFilterModelChange}
        onRowClick={(params) => setViewingCopiesBook(params.row as Book)}
        sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
      />

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
