import { useEffect, useState } from 'react';

import { bookService } from '@/features/books/services/book.service';
import type { Book } from '@/features/books/types/book.types';
import { copyService } from '@/features/copies/services/copy.service';
import type { BookCopy } from '@/features/copies/types/copy.types';
import { memberService } from '@/features/members/services/member.service';
import type { Member } from '@/features/members/types/member.types';

import type { Loan } from '../types/loan.types';

interface LoanEnrichment {
  members: Record<string, Member>;
  copies: Record<string, BookCopy>;
  books: Record<string, Book>;
}

/**
 * `LoanResponse` only carries raw `member_id`/`copy_id` UUIDs — the backend
 * doesn't join member/book data into the loan list. This batch-resolves the
 * unique IDs on the current page via single-record lookups and holds them in
 * local state (not Redux — this is page-scoped derived data, not shared app
 * state). Individual lookup failures are swallowed so one bad ID doesn't blank
 * out the rest of the table.
 */
export function useLoanEnrichment(loans: Loan[]): LoanEnrichment {
  const [members, setMembers] = useState<Record<string, Member>>({});
  const [copies, setCopies] = useState<Record<string, BookCopy>>({});
  const [books, setBooks] = useState<Record<string, Book>>({});

  const memberIdsKey = [...new Set(loans.map((loan) => loan.member_id))].sort().join(',');
  const copyIdsKey = [...new Set(loans.map((loan) => loan.copy_id))].sort().join(',');

  useEffect(() => {
    const memberIds = memberIdsKey ? memberIdsKey.split(',') : [];
    const copyIds = copyIdsKey ? copyIdsKey.split(',') : [];

    let cancelled = false;

    async function resolve() {
      const resolvedMembers = await Promise.all(
        memberIds.map(async (id) => {
          try {
            return await memberService.get(id);
          } catch {
            return null;
          }
        }),
      );
      const resolvedCopies = await Promise.all(
        copyIds.map(async (id) => {
          try {
            return await copyService.get(id);
          } catch {
            return null;
          }
        }),
      );
      const bookIds = [...new Set(resolvedCopies.filter((copy) => copy !== null).map((copy) => copy.book_id))];
      const resolvedBooks = await Promise.all(
        bookIds.map(async (id) => {
          try {
            return await bookService.get(id);
          } catch {
            return null;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      setMembers((prev) => {
        const next = { ...prev };
        for (const member of resolvedMembers) {
          if (member) {
            next[member.member_id] = member;
          }
        }
        return next;
      });
      setCopies((prev) => {
        const next = { ...prev };
        for (const copy of resolvedCopies) {
          if (copy) {
            next[copy.copy_id] = copy;
          }
        }
        return next;
      });
      setBooks((prev) => {
        const next = { ...prev };
        for (const book of resolvedBooks) {
          if (book) {
            next[book.book_id] = book;
          }
        }
        return next;
      });
    }

    void resolve();

    return () => {
      cancelled = true;
    };
    // memberIdsKey/copyIdsKey are stable, deduped string encodings of the IDs
    // that actually drive re-resolution; re-running per `loans` reference
    // would refetch on every render.
  }, [memberIdsKey, copyIdsKey]);

  return { members, copies, books };
}
