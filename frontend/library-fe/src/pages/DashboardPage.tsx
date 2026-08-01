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
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  GridActionsCellItem,
  type GridCellParams,
  type GridColDef,
  type GridFilterModel,
  type GridRowParams,
  type GridSortModel,
} from '@mui/x-data-grid';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { DataTable } from '@/components/DataTable';
import { FeedbackSnackbar } from '@/components/FeedbackSnackbar';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { Book } from '@/features/books/types/book.types';
import { BookCopiesDialog } from '@/features/copies/components/BookCopiesDialog';
import { useDashboard } from '@/features/dashboard/hooks/useDashboard';
import { MemberLoanHistoryDialog } from '@/features/loans/components/MemberLoanHistoryDialog';
import { ReturnLoanDialog } from '@/features/loans/components/ReturnLoanDialog';
import { useLoanEnrichment } from '@/features/loans/hooks/useLoanEnrichment';
import { useLoans } from '@/features/loans/hooks/useLoans';
import { LoanSortField } from '@/features/loans/types/loan.types';
import type { LoanReturnRequest, OverdueLoan } from '@/features/loans/types/loan.types';
import type { Member } from '@/features/members/types/member.types';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useTableQueryParams } from '@/hooks/useTableQueryParams';
import { SortDir } from '@/types/common';
import { containsOnlyOperators, filtersFromFilterModel } from '@/utils/gridFilterOperators';

interface SummaryCard {
  label: string;
  value: number;
  icon: ReactElement;
  to: string;
}

type Filters = Record<'member' | 'book', string>;

const emptyFilters: Filters = { member: '', book: '' };

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export function DashboardPage() {
  useDocumentTitle('Dashboard');

  const { staff } = useAuth();
  const { counts, error, isLoading, fetchDashboard } = useDashboard();
  const {
    overdueItems,
    overdueTotal,
    overdueError,
    isOverdueLoading,
    fetchOverdueLoans,
    returnLoan,
    isMutating,
    mutationError,
    clearMutationError,
  } = useLoans();
  const { members, copies, books } = useLoanEnrichment(overdueItems);

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
    defaultFilters: emptyFilters,
    defaultSortField: LoanSortField.DUE_AT,
  });

  const [returningLoan, setReturningLoan] = useState<OverdueLoan | null>(null);
  const [returnKey, setReturnKey] = useState(0);
  const [justReturnedFine, setJustReturnedFine] = useState<number | null>(null);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);
  const [viewingBook, setViewingBook] = useState<Book | null>(null);

  const overdueParams = {
    skip: page * pageSize,
    limit: pageSize,
    memberName: debouncedFilters.member || undefined,
    bookTitle: debouncedFilters.book || undefined,
    sortBy: sortField as LoanSortField,
    sortDir,
  };

  useEffect(() => {
    void fetchDashboard();
    // Fetched once on mount; the overdue-loans count here is independent of
    // whatever the widget below is currently filtered/paged to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchOverdueLoans(overdueParams);
    // fetchOverdueLoans is a stable dispatch wrapper; including it would just add noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sortField, sortDir, debouncedFilters]);

  const refetch = () => {
    void fetchOverdueLoans(overdueParams);
    void fetchDashboard();
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

  const [filterModel, setFilterModel] = useState<GridFilterModel>(() => ({
    items: (Object.keys(filters) as (keyof Filters)[])
      .filter((key) => filters[key])
      .map((key) => ({ field: key, operator: 'contains', value: filters[key] })),
  }));

  const handleFilterModelChange = (model: GridFilterModel) => {
    setFilterModel(model);
    setFilters(filtersFromFilterModel(model, emptyFilters));
  };

  const handleSortModelChange = (model: GridSortModel) => {
    const item = model[0];
    if (item?.sort) {
      setSort(item.field, item.sort === 'desc' ? SortDir.DESC : SortDir.ASC);
    }
  };

  const handleCellClick = (params: GridCellParams<OverdueLoan>) => {
    if (params.field === 'member') {
      const member = members[params.row.member_id];
      if (member) {
        setViewingMember(member);
      }
      return;
    }
    if (params.field === 'book') {
      const copy = copies[params.row.copy_id];
      const book = copy ? books[copy.book_id] : undefined;
      if (book) {
        setViewingBook(book);
      }
    }
  };

  const paginationModel = useMemo(() => ({ page, pageSize }), [page, pageSize]);
  const sortModel: GridSortModel = useMemo(
    () => [{ field: sortField, sort: sortDir }],
    [sortField, sortDir],
  );

  // Not memoized: closes over render-scoped state (members, copies, books)
  // that would all need to be deps anyway; recomputing this small array each
  // render is cheap and avoids stale-closure bugs.
  const columns: GridColDef<OverdueLoan>[] = [
    {
      field: 'member',
      headerName: 'Member',
      flex: 1,
      sortable: false,
      filterOperators: containsOnlyOperators,
      valueGetter: (_value, row) => {
        const member = members[row.member_id];
        return member ? `${member.first_name} ${member.last_name}` : '…';
      },
    },
    {
      field: 'book',
      headerName: 'Book',
      flex: 1,
      sortable: false,
      filterOperators: containsOnlyOperators,
      valueGetter: (_value, row) => {
        const copy = copies[row.copy_id];
        const book = copy ? books[copy.book_id] : undefined;
        return copy ? `${book ? book.title : '…'} (${copy.barcode})` : '…';
      },
    },
    {
      field: 'due_at',
      headerName: 'Due at',
      flex: 1,
      filterable: false,
      valueGetter: (_value, row) => formatDate(row.due_at),
    },
    {
      field: 'borrowed_at',
      headerName: 'Borrowed at',
      flex: 1,
      filterable: false,
      valueGetter: (_value, row) => formatDate(row.borrowed_at),
    },
    {
      field: 'days_overdue',
      headerName: 'Days overdue',
      width: 130,
      sortable: false,
      filterable: false,
    },
    {
      field: 'estimated_fine',
      headerName: 'Estimated fine',
      width: 130,
      sortable: false,
      filterable: false,
      valueGetter: (_value, row) => Number(row.estimated_fine).toFixed(2),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 80,
      getActions: (params: GridRowParams<OverdueLoan>) => [
        <Tooltip key="return" title={`Return loan ${params.row.loan_id}`}>
          <GridActionsCellItem
            icon={<AssignmentReturnOutlinedIcon fontSize="small" />}
            label={`Return loan ${params.row.loan_id}`}
            onClick={() => openReturnDialog(params.row)}
            showInMenu={false}
          />
        </Tooltip>,
      ],
    },
  ];

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

      {(error ?? overdueError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error ?? overdueError}
        </Alert>
      )}

      <DataTable
        columns={columns}
        rows={overdueItems}
        getRowId={(row: OverdueLoan) => row.loan_id}
        rowCount={overdueTotal}
        loading={isLoading || isOverdueLoading}
        autoHeight
        paginationModel={paginationModel}
        onPaginationModelChange={(model) => setPagination(model.page, model.pageSize)}
        sortModel={sortModel}
        onSortModelChange={handleSortModelChange}
        filterModel={filterModel}
        onFilterModelChange={handleFilterModelChange}
        onCellClick={handleCellClick}
        sx={{
          '& [data-field="member"], & [data-field="book"]': { cursor: 'pointer' },
          '& [data-field="member"]:hover, & [data-field="book"]:hover': {
            textDecoration: 'underline',
          },
        }}
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

      <MemberLoanHistoryDialog
        open={viewingMember !== null}
        member={viewingMember}
        onClose={() => setViewingMember(null)}
      />

      <BookCopiesDialog
        open={viewingBook !== null}
        book={viewingBook}
        onClose={() => setViewingBook(null)}
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
