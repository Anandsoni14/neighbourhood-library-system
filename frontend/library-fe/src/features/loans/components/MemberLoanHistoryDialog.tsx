import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import LinearProgress from '@mui/material/LinearProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { useEffect, useState } from 'react';

import type { Member } from '@/features/members/types/member.types';
import { LoanStatus } from '@/types/api';
import { SortDir } from '@/types/common';

import { useLoanEnrichment } from '../hooks/useLoanEnrichment';
import { useLoans } from '../hooks/useLoans';
import { LoanSortField } from '../types/loan.types';

interface MemberLoanHistoryDialogProps {
  open: boolean;
  member: Member | null;
  onClose: () => void;
}

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString();
}

/** Read-only borrow history for one member — reached from MembersPage's "View history" action. */
export function MemberLoanHistoryDialog({ open, member, onClose }: MemberLoanHistoryDialogProps) {
  const { loans, total, isLoading, fetchLoans } = useLoans();
  const { copies, books } = useLoanEnrichment(loans);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const memberId = member?.member_id;

  useEffect(() => {
    if (!open || !memberId) {
      return;
    }
    void fetchLoans({
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      memberId,
      sortBy: LoanSortField.BORROWED_AT,
      sortDir: SortDir.DESC,
    });
    // fetchLoans is a stable dispatch wrapper; including it would just add noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, memberId, page, rowsPerPage]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Borrow history — {member ? `${member.first_name} ${member.last_name}` : ''}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ position: 'relative' }}>
          {isLoading && <LinearProgress />}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Book</TableCell>
                  <TableCell>Borrowed at</TableCell>
                  <TableCell>Due at</TableCell>
                  <TableCell>Returned at</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Fine</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loans.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No loans for this member yet.
                    </TableCell>
                  </TableRow>
                )}
                {loans.map((loan) => {
                  const copy = copies[loan.copy_id];
                  const book = copy ? books[copy.book_id] : undefined;
                  return (
                    <TableRow key={loan.loan_id} hover>
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
            rowsPerPageOptions={[5, 10, 25]}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
}
