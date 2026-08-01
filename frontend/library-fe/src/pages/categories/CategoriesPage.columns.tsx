import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import Chip from '@mui/material/Chip';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';

import { DataTableActionButton } from '@/components/DataTableActionButton';
import type { Category } from '@/features/categories/types/category.types';
import { containsOnlyOperators, equalsOnlyOperators } from '@/utils/gridFilterOperators';

const STATUS_OPTIONS = ['Active', 'Archived', 'All'];

interface GetCategoriesColumnsParams {
  onEdit: (category: Category) => void;
  onToggleArchive: (category: Category) => Promise<void>;
}

export function getCategoriesColumns({
  onEdit,
  onToggleArchive,
}: GetCategoriesColumnsParams): GridColDef<Category>[] {
  return [
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
