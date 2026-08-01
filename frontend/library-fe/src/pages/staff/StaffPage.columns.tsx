import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Chip from '@mui/material/Chip';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';

import { DataTableActionButton } from '@/components/DataTableActionButton';
import type { Staff } from '@/features/staff/types/staff.types';
import { StaffRole, StaffStatus } from '@/types/api';
import { containsOnlyOperators, equalsOnlyOperators } from '@/utils/gridFilterOperators';

const ROLE_OPTIONS = ['Admin', 'Librarian'];
const STATUS_OPTIONS = ['Active', 'Inactive'];

interface GetStaffColumnsParams {
  onEdit: (staff: Staff) => void;
  onToggleStatus: (staff: Staff) => Promise<void>;
}

export function getStaffColumns({
  onEdit,
  onToggleStatus,
}: GetStaffColumnsParams): GridColDef<Staff>[] {
  return [
    {
      field: 'employeeCode',
      headerName: 'Employee code',
      flex: 0.8,
      filterOperators: containsOnlyOperators,
      valueGetter: (_value, row) => row.employee_code,
    },
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
      flex: 0.8,
      sortable: false,
      filterOperators: containsOnlyOperators,
      valueGetter: (_value, row) => row.phone_number ?? '—',
    },
    {
      field: 'role',
      headerName: 'Role',
      width: 130,
      type: 'singleSelect',
      valueOptions: ROLE_OPTIONS,
      filterOperators: equalsOnlyOperators,
      renderCell: (params) => (
        <Chip
          size="small"
          label={params.row.role}
          color={params.row.role === StaffRole.ADMIN ? 'info' : 'default'}
          variant="outlined"
        />
      ),
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
          label={params.row.status}
          color={params.row.status === StaffStatus.ACTIVE ? 'success' : 'default'}
          variant="outlined"
        />
      ),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 100,
      getActions: (params: GridRowParams<Staff>) => {
        const isActive = params.row.status === StaffStatus.ACTIVE;
        return [
          <DataTableActionButton
            key="edit"
            label="Edit"
            icon={<EditOutlinedIcon fontSize="small" />}
            onClick={() => onEdit(params.row)}
          />,
          <DataTableActionButton
            key="toggle"
            label={isActive ? 'Deactivate' : 'Activate'}
            icon={
              isActive ? (
                <BlockOutlinedIcon fontSize="small" />
              ) : (
                <CheckCircleOutlineOutlinedIcon fontSize="small" />
              )
            }
            onClick={() => void onToggleStatus(params.row)}
          />,
        ];
      },
    },
  ];
}
