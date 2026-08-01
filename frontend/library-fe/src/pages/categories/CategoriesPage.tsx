import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import { type GridFilterModel, type GridSortModel } from '@mui/x-data-grid';
import { useEffect, useMemo, useState } from 'react';

import { DataTable } from '@/components/DataTable';
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
import { filtersFromFilterModel } from '@/utils/gridFilterOperators';

import { getCategoriesColumns } from './CategoriesPage.columns';

type Filters = Record<'name' | 'status', string>;

const emptyFilters: Filters = { name: '', status: '' };

const defaultFilters: Filters = emptyFilters;

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

  const columns = getCategoriesColumns({
    onEdit: openEditDialog,
    onToggleArchive: handleToggleArchive,
  });

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
