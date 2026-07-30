import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
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
import Typography from '@mui/material/Typography';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { FeedbackSnackbar } from '@/components/FeedbackSnackbar';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useDashboard } from '@/features/dashboard/hooks/useDashboard';
import { ReturnLoanDialog } from '@/features/loans/components/ReturnLoanDialog';
import { useLoanEnrichment } from '@/features/loans/hooks/useLoanEnrichment';
import { useLoans } from '@/features/loans/hooks/useLoans';
import { LoanSortField } from '@/features/loans/types/loan.types';
import type { LoanReturnRequest, OverdueLoan } from '@/features/loans/types/loan.types';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { SortDir } from '@/types/common';

interface SummaryCard {
  label: string;
  value: number;
  icon: ReactElement;
  to: string;
}

interface SortableColumn {
  field: LoanSortField;
  label: string;
}

const columns: SortableColumn[] = [
  { field: LoanSortField.DUE_AT, label: 'Due at' },
  { field: LoanSortField.BORROWED_AT, label: 'Borrowed at' },
];

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export function DashboardPage() {
  useDocumentTitle('Dashboard');

  const { staff } = useAuth();
  const { counts, overdueItems, overdueTotal, error, isLoading, fetchDashboard } = useDashboard();
  const { members, copies, books } = useLoanEnrichment(overdueItems);
  const { returnLoan, isMutating, mutationError, clearMutationError } = useLoans();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<LoanSortField>(LoanSortField.DUE_AT);
  const [sortDir, setSortDir] = useState<SortDir>(SortDir.ASC);

  const [returningLoan, setReturningLoan] = useState<OverdueLoan | null>(null);
  const [returnKey, setReturnKey] = useState(0);
  const [justReturnedFine, setJustReturnedFine] = useState<number | null>(null);

  useEffect(() => {
    void fetchDashboard({ skip: page * rowsPerPage, limit: rowsPerPage, sortBy, sortDir });
    // fetchDashboard is a stable dispatch wrapper; including it would just add noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, sortBy, sortDir]);

  const refetch = () => {
    void fetchDashboard({ skip: page * rowsPerPage, limit: rowsPerPage, sortBy, sortDir });
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

  const openReturnDialog = (loan: OverdueLoan) => {
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
      const fulfilled = action as { payload: { calculated_fine: number } };
      setJustReturnedFine(fulfilled.payload.calculated_fine);
      refetch();
    }
  };

  const summaryCards: SummaryCard[] = [
    { label: 'Books', value: counts?.books ?? 0, icon: <AutoStoriesOutlinedIcon />, to: '/books' },
    { label: 'Members', value: counts?.members ?? 0, icon: <GroupsOutlinedIcon />, to: '/members' },
    {
      label: 'Active loans',
      value: counts?.activeLoans ?? 0,
      icon: <SwapHorizOutlinedIcon />,
      to: '/loans',
    },
    {
      label: 'Overdue loans',
      value: counts?.overdueLoans ?? 0,
      icon: <WarningAmberOutlinedIcon color="warning" />,
      to: '/loans',
    },
  ];

  return (
    <Box>
      <Typography component="h2" variant="h4" sx={{ mb: 1 }}>
        Dashboard
      </Typography>
      {staff && (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Welcome back, {staff.first_name}.
        </Typography>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {summaryCards.map((card) => (
          <Grid key={card.label} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardActionArea component={RouterLink} to={card.to}>
                <CardContent>
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    {card.icon}
                    <Box>
                      <Typography variant="h5">{card.value}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {card.label}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Typography component="h3" variant="h6" sx={{ mb: 1 }}>
        Overdue loans
      </Typography>

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
                <TableCell>Days overdue</TableCell>
                <TableCell>Estimated fine</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {overdueItems.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={columns.length + 5} align="center">
                    No overdue loans.
                  </TableCell>
                </TableRow>
              )}
              {overdueItems.map((loan) => {
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
                    <TableCell>{formatDate(loan.due_at)}</TableCell>
                    <TableCell>{formatDate(loan.borrowed_at)}</TableCell>
                    <TableCell>{loan.days_overdue}</TableCell>
                    <TableCell>{loan.estimated_fine.toFixed(2)}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        aria-label={`Return loan ${loan.loan_id}`}
                        onClick={() => openReturnDialog(loan)}
                      >
                        <AssignmentReturnOutlinedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={overdueTotal}
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
        open={mutationError !== null && returningLoan === null}
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
