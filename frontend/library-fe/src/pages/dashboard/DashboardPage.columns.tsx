import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';

import { DataTableActionButton } from '@/components/DataTableActionButton';
import type { useLoanEnrichment } from '@/features/loans/hooks/useLoanEnrichment';
import type { OverdueLoan } from '@/features/loans/types/loan.types';
import { containsOnlyOperators } from '@/utils/gridFilterOperators';

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

interface GetDashboardColumnsParams {
  members: ReturnType<typeof useLoanEnrichment>['members'];
  copies: ReturnType<typeof useLoanEnrichment>['copies'];
  books: ReturnType<typeof useLoanEnrichment>['books'];
  onReturn: (loan: OverdueLoan) => void;
}

export function getDashboardColumns({
  members,
  copies,
  books,
  onReturn,
}: GetDashboardColumnsParams): GridColDef<OverdueLoan>[] {
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
        <DataTableActionButton
          key="return"
          label="Return"
          icon={<AssignmentReturnOutlinedIcon fontSize="small" />}
          onClick={() => onReturn(params.row)}
        />,
      ],
    },
  ];
}
