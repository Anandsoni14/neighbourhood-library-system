import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Chip from '@mui/material/Chip';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';

import { DataTableActionButton } from '@/components/DataTableActionButton';
import type { Member } from '@/features/members/types/member.types';
import { MembershipStatus } from '@/types/api';
import { containsOnlyOperators, equalsOnlyOperators } from '@/utils/gridFilterOperators';

const STATUS_OPTIONS = ['Active', 'Blocked', 'Inactive'];

const statusColors: Record<MembershipStatus, 'success' | 'error' | 'default'> = {
  [MembershipStatus.ACTIVE]: 'success',
  [MembershipStatus.BLOCKED]: 'error',
  [MembershipStatus.INACTIVE]: 'default',
};

interface GetMembersColumnsParams {
  onEdit: (member: Member) => void;
  onDelete: (member: Member) => void;
}

export function getMembersColumns({
  onEdit,
  onDelete,
}: GetMembersColumnsParams): GridColDef<Member>[] {
  return [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      filterOperators: containsOnlyOperators,
      valueGetter: (_value, row) => `${row.first_name} ${row.last_name}`,
    },
    { field: 'email', headerName: 'Email', flex: 1, filterOperators: containsOnlyOperators },
    {
      field: 'phone',
      headerName: 'Phone',
      flex: 1,
      sortable: false,
      filterOperators: containsOnlyOperators,
      valueGetter: (_value, row) => row.phone_number ?? '—',
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      type: 'singleSelect',
      valueOptions: STATUS_OPTIONS,
      filterOperators: equalsOnlyOperators,
      renderCell: (params) => (
        <Chip
          size="small"
          label={params.row.membership_status}
          color={statusColors[params.row.membership_status]}
          variant="outlined"
        />
      ),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 100,
      getActions: (params: GridRowParams<Member>) => [
        <DataTableActionButton
          key="edit"
          label="Edit"
          icon={<EditOutlinedIcon fontSize="small" />}
          onClick={() => onEdit(params.row)}
        />,
        <DataTableActionButton
          key="delete"
          label="Delete"
          icon={<DeleteOutlineIcon fontSize="small" />}
          onClick={() => onDelete(params.row)}
        />,
      ],
    },
  ];
}
