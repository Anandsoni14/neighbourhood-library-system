import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { type FormEvent, useEffect, useState } from 'react';

import type { Book } from '@/features/books/types/book.types';
import { useBooks } from '@/features/books/hooks/useBooks';
import { copyService } from '@/features/copies/services/copy.service';
import type { BookCopy } from '@/features/copies/types/copy.types';
import { useMembers } from '@/features/members/hooks/useMembers';
import type { Member } from '@/features/members/types/member.types';
import { CopyStatus } from '@/types/api';
import { SortDir } from '@/types/common';

import type { LoanIssueRequest } from '../types/loan.types';

interface IssueLoanDialogProps {
  open: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: LoanIssueRequest) => void;
}

// Opened fresh each time (no "edit" mode) — the parent bumps a `key` prop on
// each open so all three Autocomplete selections reset, mirroring the other
// dialogs' key-remount reset trick applied to a blank-state reset instead of
// an entity re-seed.
export function IssueLoanDialog({
  open,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: IssueLoanDialogProps) {
  const { books, fetchBooks } = useBooks();
  const { members, fetchMembers } = useMembers();

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedCopy, setSelectedCopy] = useState<BookCopy | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [remarks, setRemarks] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const [availableCopies, setAvailableCopies] = useState<BookCopy[]>([]);
  const [copiesLoading, setCopiesLoading] = useState(false);

  const handleBookInputChange = (_event: unknown, value: string) => {
    void fetchBooks({ skip: 0, limit: 25, title: value, sortBy: 'title', sortDir: SortDir.ASC });
  };

  const handleMemberInputChange = (_event: unknown, value: string) => {
    void fetchMembers({
      skip: 0,
      limit: 25,
      name: value,
      sortBy: 'last_name',
      sortDir: SortDir.ASC,
    });
  };

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (!selectedBook) {
        setAvailableCopies([]);
        return;
      }

      setCopiesLoading(true);
      try {
        const page = await copyService.list({
          skip: 0,
          limit: 50,
          bookId: selectedBook.book_id,
          status: CopyStatus.AVAILABLE,
          sortBy: 'barcode',
          sortDir: SortDir.ASC,
        });
        if (!cancelled) {
          setAvailableCopies(page.items);
        }
      } catch {
        if (!cancelled) {
          setAvailableCopies([]);
        }
      } finally {
        if (!cancelled) {
          setCopiesLoading(false);
        }
      }
    }

    void resolve();

    return () => {
      cancelled = true;
    };
  }, [selectedBook]);

  const canSubmit = selectedCopy !== null && selectedMember !== null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedCopy || !selectedMember) {
      setFieldError('A copy and a member are required.');
      return;
    }

    setFieldError(null);
    onSubmit({
      copy_id: selectedCopy.copy_id,
      member_id: selectedMember.member_id,
      remarks: remarks.trim() || null,
    });
  };

  const displayedError = fieldError ?? error;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Issue loan</DialogTitle>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogContent>
          <Stack spacing={2}>
            {displayedError && <Alert severity="error">{displayedError}</Alert>}
            <Autocomplete
              options={books}
              getOptionLabel={(book) => `${book.title} — ${book.author}`}
              value={selectedBook}
              onChange={(_event, value) => {
                setSelectedBook(value);
                setSelectedCopy(null);
              }}
              onInputChange={handleBookInputChange}
              renderInput={(params) => <TextField {...params} label="Book" autoFocus />}
            />
            <Autocomplete
              options={availableCopies}
              getOptionLabel={(copy) => `${copy.barcode} (${copy.condition})`}
              value={selectedCopy}
              onChange={(_event, value) => setSelectedCopy(value)}
              disabled={!selectedBook}
              loading={copiesLoading}
              renderInput={(params) => <TextField {...params} label="Copy" />}
            />
            <Autocomplete
              options={members}
              getOptionLabel={(member) =>
                `${member.first_name} ${member.last_name} (${member.email})`
              }
              value={selectedMember}
              onChange={(_event, value) => setSelectedMember(value)}
              onInputChange={handleMemberInputChange}
              renderInput={(params) => <TextField {...params} label="Member" />}
            />
            <TextField
              label="Remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting || !canSubmit}>
            Issue loan
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
