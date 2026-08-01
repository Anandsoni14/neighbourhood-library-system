import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';
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
import { IssueLoanDialog } from '@/features/loans/components/IssueLoanDialog';
import { ReturnLoanDialog } from '@/features/loans/components/ReturnLoanDialog';
import { useLoanEnrichment } from '@/features/loans/hooks/useLoanEnrichment';
import { useLoans } from '@/features/loans/hooks/useLoans';
import { LoanSortField } from '@/features/loans/types/loan.types';
import type { Loan, LoanIssueRequest, LoanReturnRequest } from '@/features/loans/types/loan.types';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useTableQueryParams } from '@/hooks/useTableQueryParams';
import { LoanStatus } from '@/types/api';
import { SortDir } from '@/types/common';
import {
  containsOnlyOperators,
  equalsOnlyOperators,
  filtersFromFilterModel,
} from '@/utils/gridFilterOperators';

type Filters = Record<'member' | 'book' | 'barcode' | 'status', string>;

const emptyFilters: Filters = { member: '', book: '', barcode: '', status: '' };

const defaultFilters: Filters = emptyFilters;

const STATUS_OPTIONS = ['Active', 'Returned'];

function statusToLoanStatus(status: string): LoanStatus | undefined {
  if (status === 'Active') {
    return LoanStatus.ACTIVE;
  }
  if (status === 'Returned') {
    return LoanStatus.RETURNED;
  }
  return undefined;
}

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
    defaultSortField: LoanSortField.BORROWED_AT,
    defaultSortDir: SortDir.DESC,
  });

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueKey, setIssueKey] = useState(0);
  const [returningLoan, setReturningLoan] = useState<Loan | null>(null);
  const [returnKey, setReturnKey] = useState(0);
  const [justReturnedFine, setJustReturnedFine] = useState<number | null>(null);

  const fetchParams = {
    skip: page * pageSize,
    limit: pageSize,
    memberName: debouncedFilters.member || undefined,
    bookTitle: debouncedFilters.book || undefined,
    copyBarcode: debouncedFilters.barcode || undefined,
    status: statusToLoanStatus(debouncedFilters.status),
    sortBy: sortField as LoanSortField,
    sortDir,
  };

  useEffect(() => {
    void fetchLoans(fetchParams);
    // fetchLoans is a stable dispatch wrapper; including it would just add noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sortField, sortDir, debouncedFilters]);

  const refetch = () => void fetchLoans(fetchParams);

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
    if (item?.sort) {
      setSort(item.field, item.sort === 'desc' ? SortDir.DESC : SortDir.ASC);
    }
  };

  const paginationModel = useMemo(() => ({ page, pageSize }), [page, pageSize]);
  const sortModel: GridSortModel = useMemo(
    () => [{ field: sortField, sort: sortDir }],
    [sortField, sortDir],
  );

  const columns: GridColDef<Loan>[] = [
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
        return book ? book.title : '…';
      },
    },
    {
      field: 'barcode',
      headerName: 'Copy barcode',
      flex: 0.8,
      sortable: false,
      filterOperators: containsOnlyOperators,
      valueGetter: (_value, row) => copies[row.copy_id]?.barcode ?? '…',
    },
    {
      field: 'borrowed_at',
      headerName: 'Borrowed at',
      flex: 1,
      filterable: false,
      valueGetter: (_value, row) => formatDate(row.borrowed_at),
    },
    {
      field: 'due_at',
      headerName: 'Due at',
      flex: 1,
      filterable: false,
      valueGetter: (_value, row) => formatDate(row.due_at),
    },
    {
      field: 'returned_at',
      headerName: 'Returned at',
      flex: 1,
      filterable: false,
      valueGetter: (_value, row) => formatDate(row.returned_at),
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
          color={params.row.status === LoanStatus.ACTIVE ? 'info' : 'success'}
          variant="outlined"
        />
      ),
    },
    {
      field: 'calculated_fine',
      headerName: 'Fine',
      width: 100,
      filterable: false,
      renderCell: (params) =>
        params.row.status === LoanStatus.RETURNED
          ? Number(params.row.calculated_fine).toFixed(2)
          : '—',
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 80,
      getActions: (params: GridRowParams<Loan>) => {
        if (params.row.status !== LoanStatus.ACTIVE) {
          return [];
        }
        return [
          <DataTableActionButton
            key="return"
            label="Return"
            icon={<AssignmentReturnOutlinedIcon fontSize="small" />}
            onClick={() => openReturnDialog(params.row)}
          />,
        ];
      },
    },
  ];

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

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <DataTable
        columns={columns}
        rows={loans}
        getRowId={(row: Loan) => row.loan_id}
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
