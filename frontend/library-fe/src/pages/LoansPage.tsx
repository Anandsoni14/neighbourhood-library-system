import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';
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

import { FeedbackSnackbar } from '@/components/FeedbackSnackbar';
import { IssueLoanDialog } from '@/features/loans/components/IssueLoanDialog';
import { ReturnLoanDialog } from '@/features/loans/components/ReturnLoanDialog';
import { useLoanEnrichment } from '@/features/loans/hooks/useLoanEnrichment';
import { useLoans } from '@/features/loans/hooks/useLoans';
import { LoanSortField } from '@/features/loans/types/loan.types';
import type { Loan, LoanIssueRequest, LoanReturnRequest } from '@/features/loans/types/loan.types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { LoanStatus } from '@/types/api';
import { SortDir } from '@/types/common';

/** How long a filter text field must sit idle before it triggers a fetch. */
const FILTER_DEBOUNCE_MS = 300;

interface SortableColumn {
  field: LoanSortField;
  label: string;
}

const columns: SortableColumn[] = [
  { field: LoanSortField.BORROWED_AT, label: 'Borrowed at' },
  { field: LoanSortField.DUE_AT, label: 'Due at' },
  { field: LoanSortField.RETURNED_AT, label: 'Returned at' },
  { field: LoanSortField.STATUS, label: 'Status' },
  { field: LoanSortField.CALCULATED_FINE, label: 'Fine' },
];

interface Filters {
  memberId: string;
  copyId: string;
  status: LoanStatus | '';
}

const emptyFilters: Filters = { memberId: '', copyId: '', status: '' };

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString();
}

export function LoansPage() {
  useDocumentTitle('Loans');

  const {
    loans,
    total,
    error,
    mutationError,
    isLoading,
    isMutating,
    fetchLoans,
    issueLoan,
    returnLoan,
    clearMutationError,
  } = useLoans();
  const { members, copies, books } = useLoanEnrichment(loans);

  const [filters, setFilters] = useState<Filters>(emptyFilters);
  // Only the free-text fields are debounced — `status` is a discrete Select
  // choice, not a per-keystroke value, so it should filter immediately.
  const debouncedMemberId = useDebouncedValue(filters.memberId, FILTER_DEBOUNCE_MS);
  const debouncedCopyId = useDebouncedValue(filters.copyId, FILTER_DEBOUNCE_MS);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortBy, setSortBy] = useState<LoanSortField>(LoanSortField.BORROWED_AT);
  const [sortDir, setSortDir] = useState<SortDir>(SortDir.DESC);

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueKey, setIssueKey] = useState(0);
  const [returningLoan, setReturningLoan] = useState<Loan | null>(null);
  const [returnKey, setReturnKey] = useState(0);
  const [justReturnedFine, setJustReturnedFine] = useState<number | null>(null);

  useEffect(() => {
    void fetchLoans({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      memberId: debouncedMemberId,
      copyId: debouncedCopyId,
      status: filters.status || undefined,
      sortBy,
      sortDir,
    });
    // fetchLoans is a stable dispatch wrapper; including it would just add noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, sortBy, sortDir, debouncedMemberId, debouncedCopyId, filters.status]);

  const handleTextFilterChange =
    (field: 'memberId' | 'copyId') => (event: ChangeEvent<HTMLInputElement>) => {
      setFilters((prev) => ({ ...prev, [field]: event.target.value }));
      setPage(0);
    };

  const handleStatusFilterChange = (event: SelectChangeEvent<LoanStatus | ''>) => {
    setFilters((prev) => ({ ...prev, status: event.target.value }));
    setPage(0);
  };

  const handleSort = (field: LoanSortField) => {
    if (field === sortBy) {
      setSortDir(sortDir === SortDir.ASC ? SortDir.DESC : SortDir.ASC);
    } else {
      setSortBy(field);
      setSortDir(SortDir.ASC);
    }
    setPage(0);
  };

  const refetch = () => {
    void fetchLoans({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      memberId: filters.memberId,
      copyId: filters.copyId,
      status: filters.status || undefined,
      sortBy,
      sortDir,
    });
  };

  const openIssueDialog = () => {
    setIssueOpen(true);
    setIssueKey((key) => key + 1);
  };

  const closeIssueDialog = () => {
    setIssueOpen(false);
    clearMutationError();
  };

  const handleIssueSubmit = async (payload: LoanIssueRequest) => {
    const action = await issueLoan(payload);
    if (!action.type.endsWith('/rejected')) {
      setIssueOpen(false);
      refetch();
    }
  };

  const openReturnDialog = (loan: Loan) => {
    setReturningLoan(loan);
    setReturnKey((key) => key + 1);
  };

  const closeReturnDialog = () => {
    setReturningLoan(null);
    clearMutationError();
  };

  const handleReturnSubmit = async (payload: LoanReturnRequest) => {
    if (!returningLoan) {
      return;
    }
    const action = await returnLoan(returningLoan.loan_id, payload);
    setReturningLoan(null);
    if (!action.type.endsWith('/rejected')) {
      const fulfilled = action as { payload: Loan };
      setJustReturnedFine(fulfilled.payload.calculated_fine);
      refetch();
    }
  };

  return (
    <Box>
      <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="h2" variant="h4">
          Loans
        </Typography>
        <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openIssueDialog}>
          Issue loan
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <TextField
            label="Member ID"
            value={filters.memberId}
            onChange={handleTextFilterChange('memberId')}
            sx={{ minWidth: 220 }}
          />
          <TextField
            label="Copy ID"
            value={filters.copyId}
            onChange={handleTextFilterChange('copyId')}
            sx={{ minWidth: 220 }}
          />
          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel id="loan-status-filter-label">Status</InputLabel>
            <Select
              labelId="loan-status-filter-label"
              label="Status"
              value={filters.status}
              onChange={handleStatusFilterChange}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value={LoanStatus.ACTIVE}>Active</MenuItem>
              <MenuItem value={LoanStatus.RETURNED}>Returned</MenuItem>
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
                <TableCell>Member</TableCell>
                <TableCell>Book</TableCell>
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
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loans.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={columns.length + 3} align="center">
                    No loans found.
                  </TableCell>
                </TableRow>
              )}
              {loans.map((loan) => {
                const member = members[loan.member_id];
                const copy = copies[loan.copy_id];
                const book = copy ? books[copy.book_id] : undefined;
                return (
                  <TableRow key={loan.loan_id} hover>
                    <TableCell>
                      {member ? `${member.first_name} ${member.last_name}` : '…'}
                    </TableCell>
                    <TableCell>
                      {copy ? `${book ? book.title : '…'} (${copy.barcode})` : '…'}
                    </TableCell>
                    <TableCell>{formatDate(loan.borrowed_at)}</TableCell>
                    <TableCell>{formatDate(loan.due_at)}</TableCell>
                    <TableCell>{formatDate(loan.returned_at)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={loan.status}
                        color={loan.status === LoanStatus.ACTIVE ? 'info' : 'success'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {loan.status === LoanStatus.RETURNED
                        ? Number(loan.calculated_fine).toFixed(2)
                        : '—'}
                    </TableCell>
                    <TableCell align="right">
                      {loan.status === LoanStatus.ACTIVE && (
                        <IconButton
                          size="small"
                          aria-label={`Return loan ${loan.loan_id}`}
                          onClick={() => openReturnDialog(loan)}
                        >
                          <AssignmentReturnOutlinedIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
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

      <IssueLoanDialog
        key={`issue-${issueKey}`}
        open={issueOpen}
        isSubmitting={isMutating}
        error={mutationError}
        onClose={closeIssueDialog}
        onSubmit={(payload) => void handleIssueSubmit(payload)}
      />

      <ReturnLoanDialog
        key={`return-${returnKey}`}
        open={returningLoan !== null}
        loan={returningLoan}
        isSubmitting={isMutating}
        error={mutationError}
        onClose={closeReturnDialog}
        onSubmit={(payload) => void handleReturnSubmit(payload)}
      />

      <FeedbackSnackbar
        open={mutationError !== null && !issueOpen && returningLoan === null}
        message={mutationError}
        severity="error"
        onClose={clearMutationError}
      />

      <FeedbackSnackbar
        open={justReturnedFine !== null}
        message={`Loan returned. Fine: $${(justReturnedFine ?? 0).toFixed(2)}`}
        severity="success"
        onClose={() => setJustReturnedFine(null)}
      />
    </Box>
  );
}
