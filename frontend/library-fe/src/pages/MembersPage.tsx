import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type ChangeEvent, useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FeedbackSnackbar } from '@/components/FeedbackSnackbar';
import { MemberFormDialog } from '@/features/members/components/MemberFormDialog';
import { useMembers } from '@/features/members/hooks/useMembers';
import { MemberSortField } from '@/features/members/types/member.types';
import type { Member, MemberRequest } from '@/features/members/types/member.types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { MembershipStatus } from '@/types/api';
import { SortDir } from '@/types/common';

/** How long a filter text field must sit idle before it triggers a fetch. */
const FILTER_DEBOUNCE_MS = 300;

interface SortableColumn {
  field: MemberSortField;
  label: string;
}

const columns: SortableColumn[] = [
  { field: MemberSortField.FIRST_NAME, label: 'First name' },
  { field: MemberSortField.LAST_NAME, label: 'Last name' },
  { field: MemberSortField.EMAIL, label: 'Email' },
  { field: MemberSortField.MEMBERSHIP_STATUS, label: 'Status' },
];

const statusColors: Record<MembershipStatus, 'success' | 'error' | 'default'> = {
  [MembershipStatus.ACTIVE]: 'success',
  [MembershipStatus.BLOCKED]: 'error',
  [MembershipStatus.INACTIVE]: 'default',
};

interface Filters {
  name: string;
  email: string;
  status: MembershipStatus | '';
}

const emptyFilters: Filters = { name: '', email: '', status: '' };

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

  const [filters, setFilters] = useState<Filters>(emptyFilters);
  // Only the free-text fields are debounced — `status` is a discrete Select
  // choice, not a per-keystroke value, so it should filter immediately.
  const debouncedName = useDebouncedValue(filters.name, FILTER_DEBOUNCE_MS);
  const debouncedEmail = useDebouncedValue(filters.email, FILTER_DEBOUNCE_MS);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortBy, setSortBy] = useState<MemberSortField>(MemberSortField.LAST_NAME);
  const [sortDir, setSortDir] = useState<SortDir>(SortDir.ASC);

  const [formOpen, setFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  // Bumped on every open so MemberFormDialog remounts (and re-seeds its fields
  // from `editingMember`) instead of needing an effect to reset its state.
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    void fetchMembers({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      name: debouncedName,
      email: debouncedEmail,
      status: filters.status || undefined,
      sortBy,
      sortDir,
    });
    // fetchMembers is a stable dispatch wrapper; including it would just add noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, sortBy, sortDir, debouncedName, debouncedEmail, filters.status]);

  const handleFilterChange =
    (field: 'name' | 'email') => (event: ChangeEvent<HTMLInputElement>) => {
      setFilters((prev) => ({ ...prev, [field]: event.target.value }));
      setPage(0);
    };

  const handleStatusFilterChange = (event: SelectChangeEvent<MembershipStatus | ''>) => {
    setFilters((prev) => ({ ...prev, status: event.target.value }));
    setPage(0);
  };

  const handleSort = (field: MemberSortField) => {
    if (field === sortBy) {
      setSortDir(sortDir === SortDir.ASC ? SortDir.DESC : SortDir.ASC);
    } else {
      setSortBy(field);
      setSortDir(SortDir.ASC);
    }
    setPage(0);
  };

  const refetch = () => {
    void fetchMembers({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      name: filters.name,
      email: filters.email,
      status: filters.status || undefined,
      sortBy,
      sortDir,
    });
  };

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

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <TextField
            label="Name"
            value={filters.name}
            onChange={handleFilterChange('name')}
            sx={{ minWidth: 180 }}
          />
          <TextField
            label="Email"
            value={filters.email}
            onChange={handleFilterChange('email')}
            sx={{ minWidth: 180 }}
          />
          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel id="status-filter-label">Status</InputLabel>
            <Select
              labelId="status-filter-label"
              label="Status"
              value={filters.status}
              onChange={handleStatusFilterChange}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value={MembershipStatus.ACTIVE}>Active</MenuItem>
              <MenuItem value={MembershipStatus.BLOCKED}>Blocked</MenuItem>
              <MenuItem value={MembershipStatus.INACTIVE}>Inactive</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper>
        {isLoading && <LinearProgress />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell key={column.field}>
                    <TableSortLabel
                      active={sortBy === column.field}
                      direction={sortBy === column.field ? sortDir : SortDir.ASC}
                      onClick={() => handleSort(column.field)}
                    >
                      {column.label}
                    </TableSortLabel>
                  </TableCell>
                ))}
                <TableCell>Phone</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {members.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={columns.length + 2} align="center">
                    No members found.
                  </TableCell>
                </TableRow>
              )}
              {members.map((member) => (
                <TableRow key={member.member_id} hover>
                  <TableCell>{member.first_name}</TableCell>
                  <TableCell>{member.last_name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={member.membership_status}
                      color={statusColors[member.membership_status]}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{member.phone_number ?? '—'}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={`Edit ${member.first_name} ${member.last_name}`}
                      onClick={() => openEditDialog(member)}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={`Delete ${member.first_name} ${member.last_name}`}
                      onClick={() => setDeletingMember(member)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_event, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>

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

      <FeedbackSnackbar
        open={mutationError !== null && !formOpen && deletingMember === null}
        message={mutationError}
        severity="error"
        onClose={clearMutationError}
      />
    </Box>
  );
}
