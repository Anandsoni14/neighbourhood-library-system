import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import { type GridFilterModel, type GridSortModel } from '@mui/x-data-grid';
import { useEffect, useMemo, useState } from 'react';

import { DataTable } from '@/components/DataTable';
import { FeedbackSnackbar } from '@/components/FeedbackSnackbar';
import { PageHeader } from '@/components/PageHeader';
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
import { filtersFromFilterModel } from '@/utils/gridFilterOperators';

import { getStaffColumns } from './StaffPage.columns';

type Filters = Record<'employeeCode' | 'name' | 'email' | 'phone' | 'role' | 'status', string>;

const emptyFilters: Filters = {
  employeeCode: '',
  name: '',
  email: '',
  phone: '',
  role: '',
  status: '',
};

const defaultFilters: Filters = emptyFilters;

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
        <PageHeader title="Staff" />
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

  const columns = getStaffColumns({ onEdit: openEditDialog, onToggleStatus: handleToggleStatus });

  return (
    <Box>
      <PageHeader title="Staff" actionLabel="Add staff member" onAction={openAddDialog} />

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
