import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
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

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable } from '@/components/DataTable';
import { FeedbackSnackbar } from '@/components/FeedbackSnackbar';
import { MemberLoanHistoryDialog } from '@/features/loans/components/MemberLoanHistoryDialog';
import { MemberFormDialog } from '@/features/members/components/MemberFormDialog';
import { useMembers } from '@/features/members/hooks/useMembers';
import { MemberSortField } from '@/features/members/types/member.types';
import type { Member, MemberRequest } from '@/features/members/types/member.types';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useTableQueryParams } from '@/hooks/useTableQueryParams';
import { MembershipStatus } from '@/types/api';
import { SortDir } from '@/types/common';
import {
  containsOnlyOperators,
  equalsOnlyOperators,
  filtersFromFilterModel,
} from '@/utils/gridFilterOperators';

type Filters = Record<'name' | 'email' | 'phone' | 'status', string>;

const emptyFilters: Filters = { name: '', email: '', phone: '', status: '' };

// No default filter: MUI Community's filter panel only supports one active
// filter at a time, so pre-setting Status would block filtering by anything else.
const defaultFilters: Filters = emptyFilters;

const STATUS_OPTIONS = ['Active', 'Blocked', 'Inactive'];

const statusColors: Record<MembershipStatus, 'success' | 'error' | 'default'> = {
  [MembershipStatus.ACTIVE]: 'success',
  [MembershipStatus.BLOCKED]: 'error',
  [MembershipStatus.INACTIVE]: 'default',
};

// The DataGrid shows one merged "Name" column (the backend's `name` filter
// already matches first-or-last), sorted by last name — these translate
// between that column's grid field and the backend's per-field sort params.
const SORT_FIELD_BY_GRID_FIELD: Record<string, MemberSortField> = {
  name: MemberSortField.LAST_NAME,
  email: MemberSortField.EMAIL,
  status: MemberSortField.MEMBERSHIP_STATUS,
};
const GRID_FIELD_BY_SORT_FIELD: Record<string, string> = {
  [MemberSortField.LAST_NAME]: 'name',
  [MemberSortField.FIRST_NAME]: 'name',
  [MemberSortField.EMAIL]: 'email',
  [MemberSortField.MEMBERSHIP_STATUS]: 'status',
};

function statusToMembershipStatus(status: string): MembershipStatus | undefined {
  if (status === 'Active') {
    return MembershipStatus.ACTIVE;
  }
  if (status === 'Blocked') {
    return MembershipStatus.BLOCKED;
  }
  if (status === 'Inactive') {
    return MembershipStatus.INACTIVE;
  }
  return undefined;
}

export function MembersPage() {
  useDocumentTitle('Members');

  const {
    members,
    total,
    error,
    mutationError,
    isLoading,
    isMutating,
    fetchMembers,
    createMember,
    updateMember,
    deleteMember,
    clearMutationError,
  } = useMembers();

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
    defaultSortField: MemberSortField.LAST_NAME,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [historyMember, setHistoryMember] = useState<Member | null>(null);
  const [formKey, setFormKey] = useState(0);

  const fetchParams = {
    skip: page * pageSize,
    limit: pageSize,
    name: debouncedFilters.name || undefined,
    email: debouncedFilters.email || undefined,
    phoneNumber: debouncedFilters.phone || undefined,
    status: statusToMembershipStatus(debouncedFilters.status),
    sortBy: sortField as MemberSortField,
    sortDir,
  };

  useEffect(() => {
    void fetchMembers(fetchParams);
    // fetchMembers is a stable dispatch wrapper; including it would just add noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sortField, sortDir, debouncedFilters]);

  const refetch = () => void fetchMembers(fetchParams);

  const openAddDialog = () => {
    setEditingMember(null);
    setFormOpen(true);
    setFormKey((key) => key + 1);
  };

  const openEditDialog = (member: Member) => {
    setEditingMember(member);
    setFormOpen(true);
    setFormKey((key) => key + 1);
  };

  const closeFormDialog = () => {
    setFormOpen(false);
    clearMutationError();
  };

  const handleFormSubmit = async (payload: MemberRequest) => {
    const action = editingMember
      ? await updateMember(editingMember.member_id, payload)
      : await createMember(payload);

    if (!action.type.endsWith('/rejected')) {
      setFormOpen(false);
      refetch();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingMember) {
      return;
    }
    const action = await deleteMember(deletingMember.member_id);
    setDeletingMember(null);
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
    const backendField = item?.field ? SORT_FIELD_BY_GRID_FIELD[item.field] : undefined;
    if (item?.sort && backendField) {
      setSort(backendField, item.sort === 'desc' ? SortDir.DESC : SortDir.ASC);
    }
  };

  const paginationModel = useMemo(() => ({ page, pageSize }), [page, pageSize]);
  const sortModel: GridSortModel = useMemo(
    () => [{ field: GRID_FIELD_BY_SORT_FIELD[sortField] ?? 'name', sort: sortDir }],
    [sortField, sortDir],
  );

  const columns: GridColDef<Member>[] = [
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
      getActions: (params: GridRowParams<Member>) => {
        const name = `${params.row.first_name} ${params.row.last_name}`;
        return [
          <Tooltip key="edit" title={`Edit ${name}`}>
            <GridActionsCellItem
              icon={<EditOutlinedIcon fontSize="small" />}
              label={`Edit ${name}`}
              onClick={() => openEditDialog(params.row)}
              showInMenu={false}
            />
          </Tooltip>,
          <Tooltip key="delete" title={`Delete ${name}`}>
            <GridActionsCellItem
              icon={<DeleteOutlineIcon fontSize="small" />}
              label={`Delete ${name}`}
              onClick={() => setDeletingMember(params.row)}
              showInMenu={false}
            />
          </Tooltip>,
        ];
      },
    },
  ];

  return (
    <Box>
      <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="h2" variant="h4">
          Members
        </Typography>
        <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openAddDialog}>
          Add member
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <DataTable
        columns={columns}
        rows={members}
        getRowId={(row: Member) => row.member_id}
        rowCount={total}
        loading={isLoading}
        autoHeight
        paginationModel={paginationModel}
        onPaginationModelChange={(model) => setPagination(model.page, model.pageSize)}
        sortModel={sortModel}
        onSortModelChange={handleSortModelChange}
        filterModel={filterModel}
        onFilterModelChange={handleFilterModelChange}
        onRowClick={(params) => setHistoryMember(params.row as Member)}
        sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
      />

      <MemberFormDialog
        key={formKey}
        open={formOpen}
        member={editingMember}
        isSubmitting={isMutating}
        error={mutationError}
        onClose={closeFormDialog}
        onSubmit={(payload) => void handleFormSubmit(payload)}
      />

      <ConfirmDialog
        open={deletingMember !== null}
        title="Delete member"
        description={`Delete "${deletingMember?.first_name ?? ''} ${deletingMember?.last_name ?? ''}"? This cannot be undone.`}
        isConfirming={isMutating}
        onCancel={() => setDeletingMember(null)}
        onConfirm={() => void handleConfirmDelete()}
      />

      <MemberLoanHistoryDialog
        open={historyMember !== null}
        member={historyMember}
        onClose={() => setHistoryMember(null)}
      />

      <FeedbackSnackbar
        open={mutationError !== null && !formOpen && deletingMember === null}
        message={mutationError}
        severity="error"
        onClose={clearMutationError}
      />
    </Box>
  );
}
