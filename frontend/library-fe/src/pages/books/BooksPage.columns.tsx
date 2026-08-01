import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import Chip from '@mui/material/Chip';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';

import { DataTableActionButton } from '@/components/DataTableActionButton';
import type { Book } from '@/features/books/types/book.types';
import type { Category } from '@/features/categories/types/category.types';
import type { useBookCopyCounts } from '@/features/copies/hooks/useBookCopyCounts';
import { containsOnlyOperators, equalsOnlyOperators } from '@/utils/gridFilterOperators';

const STATUS_OPTIONS = ['Active', 'Archived', 'All'];
const STOCK_OPTIONS = ['In Stock', 'Out of Stock'];

interface GetBooksColumnsParams {
  categories: Category[];
  copyCounts: ReturnType<typeof useBookCopyCounts>;
  onViewCopies: (book: Book) => void;
  onEdit: (book: Book) => void;
  onToggleArchive: (book: Book) => Promise<void>;
}

export function getBooksColumns({
  categories,
  copyCounts,
  onViewCopies,
  onEdit,
  onToggleArchive,
}: GetBooksColumnsParams): GridColDef<Book>[] {
  return [
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
        <DataTableActionButton
          key="view-copies"
          label="Copies"
          icon={<Inventory2OutlinedIcon fontSize="small" />}
          onClick={() => onViewCopies(params.row)}
        />,
        <DataTableActionButton
          key="edit"
          label="Edit"
          icon={<EditOutlinedIcon fontSize="small" />}
          onClick={() => onEdit(params.row)}
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
          onClick={() => void onToggleArchive(params.row)}
        />,
      ],
    },
  ];
}
