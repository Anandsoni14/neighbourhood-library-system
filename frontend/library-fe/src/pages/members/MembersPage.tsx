import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import { type GridFilterModel, type GridSortModel } from '@mui/x-data-grid';
import { useEffect, useMemo, useState } from 'react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable } from '@/components/DataTable';
import { FeedbackSnackbar } from '@/components/FeedbackSnackbar';
import { PageHeader } from '@/components/PageHeader';
import { MemberLoanHistoryDialog } from '@/features/loans/components/MemberLoanHistoryDialog';
import { MemberFormDialog } from '@/features/members/components/MemberFormDialog';
import { useMembers } from '@/features/members/hooks/useMembers';
import { MemberSortField } from '@/features/members/types/member.types';
import type { Member, MemberRequest } from '@/features/members/types/member.types';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useTableQueryParams } from '@/hooks/useTableQueryParams';
import { MembershipStatus } from '@/types/api';
import { SortDir } from '@/types/common';
import { filtersFromFilterModel } from '@/utils/gridFilterOperators';

import { getMembersColumns } from './MembersPage.columns';

type Filters = Record<'name' | 'email' | 'phone' | 'status', string>;

const emptyFilters: Filters = { name: '', email: '', phone: '', status: '' };

const defaultFilters: Filters = emptyFilters;

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

  const columns = getMembersColumns({ onEdit: openEditDialog, onDelete: setDeletingMember });

  return (
    <Box>
      <PageHeader title="Members" actionLabel="Add member" onAction={openAddDialog} />

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
