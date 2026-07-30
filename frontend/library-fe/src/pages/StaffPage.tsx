import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
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
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { StaffRole, StaffStatus } from '@/types/api';
import { SortDir } from '@/types/common';

const FILTER_DEBOUNCE_MS = 300;

interface SortableColumn {
  field: StaffSortField;
  label: string;
}

const columns: SortableColumn[] = [
  { field: StaffSortField.EMPLOYEE_CODE, label: 'Employee code' },
  { field: StaffSortField.FIRST_NAME, label: 'First name' },
  { field: StaffSortField.LAST_NAME, label: 'Last name' },
  { field: StaffSortField.EMAIL, label: 'Email' },
];

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

  const [name, setName] = useState('');
  const debouncedName = useDebouncedValue(name, FILTER_DEBOUNCE_MS);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortBy, setSortBy] = useState<StaffSortField>(StaffSortField.EMPLOYEE_CODE);
  const [sortDir, setSortDir] = useState<SortDir>(SortDir.ASC);

  const [formOpen, setFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [formKey, setFormKey] = useState(0);

  const isAdmin = currentStaff?.role === StaffRole.ADMIN;

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    void fetchStaff({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      name: debouncedName,
      sortBy,
      sortDir,
    });
    // fetchStaff is a stable dispatch wrapper; including it would just add noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, page, rowsPerPage, sortBy, sortDir, debouncedName]);

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

  const refetch = () => {
    void fetchStaff({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      name,
      sortBy,
      sortDir,
    });
  };

  const handleSort = (field: StaffSortField) => {
    if (field === sortBy) {
      setSortDir(sortDir === SortDir.ASC ? SortDir.DESC : SortDir.ASC);
    } else {
      setSortBy(field);
      setSortDir(SortDir.ASC);
    }
    setPage(0);
  };

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

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          label="Name"
          value={name}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setName(event.target.value);
            setPage(0);
          }}
          sx={{ minWidth: 220 }}
        />
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
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {staff.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={columns.length + 3} align="center">
                    No staff found.
                  </TableCell>
                </TableRow>
              )}
              {staff.map((member) => (
                <TableRow key={member.staff_id} hover>
                  <TableCell>{member.employee_code}</TableCell>
                  <TableCell>{member.first_name}</TableCell>
                  <TableCell>{member.last_name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={member.role}
                      color={member.role === StaffRole.ADMIN ? 'info' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={member.status}
                      color={member.status === StaffStatus.ACTIVE ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
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
                      aria-label={
                        member.status === StaffStatus.ACTIVE
                          ? `Deactivate ${member.first_name} ${member.last_name}`
                          : `Activate ${member.first_name} ${member.last_name}`
                      }
                      onClick={() => void handleToggleStatus(member)}
                    >
                      {member.status === StaffStatus.ACTIVE ? (
                        <BlockOutlinedIcon fontSize="small" />
                      ) : (
                        <CheckCircleOutlineOutlinedIcon fontSize="small" />
                      )}
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
