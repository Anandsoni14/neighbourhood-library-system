import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';
import Chip from '@mui/material/Chip';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';

import { DataTableActionButton } from '@/components/DataTableActionButton';
import type { useLoanEnrichment } from '@/features/loans/hooks/useLoanEnrichment';
import type { Loan } from '@/features/loans/types/loan.types';
import { LoanStatus } from '@/types/api';
import { containsOnlyOperators, equalsOnlyOperators } from '@/utils/gridFilterOperators';

const STATUS_OPTIONS = ['Active', 'Returned'];

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString();
}

interface GetLoansColumnsParams {
  members: ReturnType<typeof useLoanEnrichment>['members'];
  copies: ReturnType<typeof useLoanEnrichment>['copies'];
  books: ReturnType<typeof useLoanEnrichment>['books'];
  onReturn: (loan: Loan) => void;
}

export function getLoansColumns({
  members,
  copies,
  books,
  onReturn,
}: GetLoansColumnsParams): GridColDef<Loan>[] {
  return [
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
            onClick={() => onReturn(params.row)}
          />,
        ];
      },
    },
  ];
}
