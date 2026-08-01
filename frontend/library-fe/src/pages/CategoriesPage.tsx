import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import {
  type GridColDef,
  type GridFilterModel,
  type GridRowParams,
  type GridSortModel,
} from '@mui/x-data-grid';
import { useEffect, useMemo, useState } from 'react';

import { DataTable } from '@/components/DataTable';
import { DataTableActionButton } from '@/components/DataTableActionButton';
import { FeedbackSnackbar } from '@/components/FeedbackSnackbar';
import { PageHeader } from '@/components/PageHeader';
import { CategoryFormDialog } from '@/features/categories/components/CategoryFormDialog';
import { useCategories } from '@/features/categories/hooks/useCategories';
import {
  CategoryArchiveFilter,
  CategorySortField,
} from '@/features/categories/types/category.types';
import type { Category, CategoryRequest } from '@/features/categories/types/category.types';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useTableQueryParams } from '@/hooks/useTableQueryParams';
import {
  containsOnlyOperators,
  equalsOnlyOperators,
  filtersFromFilterModel,
} from '@/utils/gridFilterOperators';

type Filters = Record<'name' | 'status', string>;

const emptyFilters: Filters = { name: '', status: '' };

// No default filter: MUI Community's filter panel only supports one active
// filter at a time, so pre-setting Status would block filtering by anything else.
const defaultFilters: Filters = emptyFilters;

const STATUS_OPTIONS = ['Active', 'Archived', 'All'];

function statusToArchiveFilter(status: string): CategoryArchiveFilter {
  if (status === 'Active') {
    return CategoryArchiveFilter.ACTIVE;
  }
  if (status === 'Archived') {
    return CategoryArchiveFilter.ARCHIVED;
  }
  return CategoryArchiveFilter.ALL;
}

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

  const {
    filters,
    debouncedFilters,
    setFilters,
    page,
    pageSize,
    setPagination,
    sortDir,
    setSort,
  } = useTableQueryParams<Filters>({
    defaultFilters,
    defaultSortField: CategorySortField.NAME,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formKey, setFormKey] = useState(0);

  const fetchParams = {
    skip: page * pageSize,
    limit: pageSize,
    name: debouncedFilters.name || undefined,
    archived: statusToArchiveFilter(debouncedFilters.status),
    sortBy: CategorySortField.NAME,
    sortDir,
  };

  useEffect(() => {
    void fetchCategories(fetchParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sortDir, debouncedFilters]);

  const refetch = () => void fetchCategories(fetchParams);

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

  const [filterModel, setFilterModel] = useState<GridFilterModel>(() => ({
    items: (Object.keys(filters) as (keyof Filters)[])
      .filter((key) => filters[key])
      .map((key) => ({
        field: key,
        operator: key === 'status' ? 'is' : 'contains',
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
      setSort(CategorySortField.NAME, item.sort);
    }
  };

  const paginationModel = useMemo(() => ({ page, pageSize }), [page, pageSize]);
  const sortModel: GridSortModel = useMemo(
    () => [{ field: 'name', sort: sortDir }],
    [sortDir],
  );

  const columns: GridColDef<Category>[] = [
    { field: 'name', headerName: 'Name', flex: 1, filterOperators: containsOnlyOperators },
    {
      field: 'description',
      headerName: 'Description',
      flex: 1.5,
      filterable: false,
      sortable: false,
      valueGetter: (_value, row) => row.description ?? '—',
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
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 100,
      getActions: (params: GridRowParams<Category>) => [
        <DataTableActionButton
          key="edit"
          label="Edit"
          icon={<EditOutlinedIcon fontSize="small" />}
          onClick={() => openEditDialog(params.row)}
        />,
        <DataTableActionButton
          key="archive"
          label={params.row.is_archived ? 'Unarchive' : 'Archive'}
          icon={
            params.row.is_archived ? (
              <UnarchiveOutlinedIcon fontSize="small" />
            ) : (
              <ArchiveOutlinedIcon fontSize="small" />
            )
          }
          onClick={() => void handleToggleArchive(params.row)}
        />,
      ],
    },
  ];

  return (
    <Box>
      <PageHeader title="Categories" actionLabel="Add category" onAction={openAddDialog} />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <DataTable
        columns={columns}
        rows={categories}
        getRowId={(row: Category) => row.category_id}
        rowCount={total}
        loading={isLoading}
        autoHeight
        paginationModel={paginationModel}
        onPaginationModelChange={(model) => setPagination(model.page, model.pageSize)}
        sortModel={sortModel}
        onSortModelChange={handleSortModelChange}
        filterModel={filterModel}
        onFilterModelChange={handleFilterModelChange}
      />

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
