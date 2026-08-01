import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
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
import { useAuth } from '@/features/auth/hooks/useAuth';
import { StaffFormDialog } from '@/features/staff/components/StaffFormDialog';
import { useStaff } from '@/features/staff/hooks/useStaff';
import { StaffSortField } from '@/features/staff/types/staff.types';
import type {
  Staff,
  StaffCreateRequest,
  StaffUpdateRequest,
} from '@/features/staff/types/staff.types';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useTableQueryParams } from '@/hooks/useTableQueryParams';
import { StaffRole, StaffStatus } from '@/types/api';
import { SortDir } from '@/types/common';
import {
  containsOnlyOperators,
  equalsOnlyOperators,
  filtersFromFilterModel,
} from '@/utils/gridFilterOperators';

type Filters = Record<'employeeCode' | 'name' | 'email' | 'phone' | 'role' | 'status', string>;

const emptyFilters: Filters = {
  employeeCode: '',
  name: '',
  email: '',
  phone: '',
  role: '',
  status: '',
};

// No default filter: MUI Community's filter panel only supports one active
// filter at a time, so pre-setting Status would block filtering by anything else.
const defaultFilters: Filters = emptyFilters;

const ROLE_OPTIONS = ['Admin', 'Librarian'];
const STATUS_OPTIONS = ['Active', 'Inactive'];

function roleToStaffRole(role: string): StaffRole | undefined {
  if (role === 'Admin') {
    return StaffRole.ADMIN;
  }
  if (role === 'Librarian') {
    return StaffRole.LIBRARIAN;
  }
  return undefined;
}

function statusToStaffStatus(status: string): StaffStatus | undefined {
  if (status === 'Active') {
    return StaffStatus.ACTIVE;
  }
  if (status === 'Inactive') {
    return StaffStatus.INACTIVE;
  }
  return undefined;
}

// The DataGrid shows one merged "Name" column (the backend's `name` filter
// already matches first-or-last), sorted by last name.
function toBackendSortField(gridField: string): StaffSortField {
  return gridField === 'name' ? StaffSortField.LAST_NAME : (gridField as StaffSortField);
}

function toGridField(backendField: string): string {
  return backendField === StaffSortField.LAST_NAME || backendField === StaffSortField.FIRST_NAME
    ? 'name'
    : backendField;
}

export function StaffPage() {
  useDocumentTitle('Staff');
  const { staff: currentStaff } = useAuth();

  const {
    staff,
    total,
    error,
    mutationError,
    isLoading,
    isMutating,
    fetchStaff,
    createStaff,
    updateStaff,
    activateStaff,
    deactivateStaff,
    clearMutationError,
  } = useStaff();

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
    defaultSortField: StaffSortField.EMPLOYEE_CODE,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [formKey, setFormKey] = useState(0);

  const isAdmin = currentStaff?.role === StaffRole.ADMIN;

  const fetchParams = {
    skip: page * pageSize,
    limit: pageSize,
    name: debouncedFilters.name || undefined,
    employeeCode: debouncedFilters.employeeCode || undefined,
    email: debouncedFilters.email || undefined,
    phoneNumber: debouncedFilters.phone || undefined,
    role: roleToStaffRole(debouncedFilters.role),
    status: statusToStaffStatus(debouncedFilters.status),
    sortBy: sortField as StaffSortField,
    sortDir,
  };

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    void fetchStaff(fetchParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, page, pageSize, sortField, sortDir, debouncedFilters]);

  const [filterModel, setFilterModel] = useState<GridFilterModel>(() => ({
    items: (Object.keys(filters) as (keyof Filters)[])
      .filter((key) => filters[key])
      .map((key) => ({
        field: key,
        operator: key === 'role' || key === 'status' ? 'is' : 'contains',
        value: filters[key],
      })),
  }));
  const paginationModel = useMemo(() => ({ page, pageSize }), [page, pageSize]);
  const sortModel: GridSortModel = useMemo(
    () => [{ field: toGridField(sortField), sort: sortDir }],
    [sortField, sortDir],
  );

  if (!isAdmin) {
    return (
      <Box>
        <Typography component="h2" variant="h4" sx={{ mb: 2 }}>
          Staff
        </Typography>
        <Alert severity="warning">Only admins can manage staff accounts.</Alert>
      </Box>
    );
  }

  const refetch = () => void fetchStaff(fetchParams);

  const openAddDialog = () => {
    setEditingStaff(null);
    setFormOpen(true);
    setFormKey((key) => key + 1);
  };

  const openEditDialog = (member: Staff) => {
    setEditingStaff(member);
    setFormOpen(true);
    setFormKey((key) => key + 1);
  };

  const closeFormDialog = () => {
    setFormOpen(false);
    clearMutationError();
  };

  const handleFormSubmit = async (payload: StaffCreateRequest | StaffUpdateRequest) => {
    const action = editingStaff
      ? await updateStaff(editingStaff.staff_id, payload)
      : await createStaff(payload as StaffCreateRequest);

    if (!action.type.endsWith('/rejected')) {
      setFormOpen(false);
      refetch();
    }
  };

  const handleToggleStatus = async (member: Staff) => {
    const action =
      member.status === StaffStatus.ACTIVE
        ? await deactivateStaff(member.staff_id)
        : await activateStaff(member.staff_id);

    if (!action.type.endsWith('/rejected')) {
      refetch();
    }
  };

  const handleFilterModelChange = (model: GridFilterModel) => {
    setFilterModel(model);
    setFilters(filtersFromFilterModel(model, emptyFilters));
  };

  const handleSortModelChange = (model: GridSortModel) => {
    const item = model[0];
    if (item?.sort) {
      setSort(toBackendSortField(item.field), item.sort === 'desc' ? SortDir.DESC : SortDir.ASC);
    }
  };

  const columns: GridColDef<Staff>[] = [
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
            onClick={() => openEditDialog(params.row)}
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
            onClick={() => void handleToggleStatus(params.row)}
          />,
        ];
      },
    },
  ];

  return (
    <Box>
      <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="h2" variant="h4">
          Staff
        </Typography>
        <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openAddDialog}>
          Add staff member
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <DataTable
        columns={columns}
        rows={staff}
        getRowId={(row: Staff) => row.staff_id}
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

      <StaffFormDialog
        key={formKey}
        open={formOpen}
        staff={editingStaff}
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
