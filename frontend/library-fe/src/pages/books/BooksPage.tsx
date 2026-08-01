import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import { type GridFilterModel, type GridSortModel } from '@mui/x-data-grid';
import { useEffect, useMemo, useState } from 'react';

import { DataTable } from '@/components/DataTable';
import { FeedbackSnackbar } from '@/components/FeedbackSnackbar';
import { PageHeader } from '@/components/PageHeader';
import { BookFormDialog } from '@/features/books/components/BookFormDialog';
import { useBooks } from '@/features/books/hooks/useBooks';
import { BookArchiveFilter, BookSortField } from '@/features/books/types/book.types';
import type { Book, BookRequest } from '@/features/books/types/book.types';
import { useCategories } from '@/features/categories/hooks/useCategories';
import {
  CategoryArchiveFilter,
  CategorySortField,
} from '@/features/categories/types/category.types';
import { BookCopiesDialog } from '@/features/copies/components/BookCopiesDialog';
import { useBookCopyCounts } from '@/features/copies/hooks/useBookCopyCounts';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useTableQueryParams } from '@/hooks/useTableQueryParams';
import { SortDir } from '@/types/common';
import { filtersFromFilterModel } from '@/utils/gridFilterOperators';

import { getBooksColumns } from './BooksPage.columns';

type Filters = Record<'title' | 'author' | 'category' | 'isbn' | 'status' | 'stock', string>;

const emptyFilters: Filters = {
  title: '',
  author: '',
  category: '',
  isbn: '',
  status: '',
  stock: '',
};
const defaultFilters: Filters = emptyFilters;

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
  const [formKey, setFormKey] = useState(0);
  const [viewingCopiesBook, setViewingCopiesBook] = useState<Book | null>(null);

  useEffect(() => {
    void fetchCategories({
      skip: 0,
      limit: 200,
      archived: CategoryArchiveFilter.ACTIVE,
      sortBy: CategorySortField.NAME,
      sortDir: SortDir.ASC,
    });
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

  const paginationModel = useMemo(() => ({ page, pageSize }), [page, pageSize]);
  const sortModel: GridSortModel = useMemo(
    () => [{ field: sortField, sort: sortDir }],
    [sortField, sortDir],
  );

  const columns = getBooksColumns({
    categories,
    copyCounts,
    onViewCopies: setViewingCopiesBook,
    onEdit: openEditDialog,
    onToggleArchive: handleToggleArchive,
  });

  return (
    <Box>
      <PageHeader title="Books" actionLabel="Add book" onAction={openAddDialog} />

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
