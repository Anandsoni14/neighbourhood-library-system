import { useEffect, useState } from 'react';

import { CopyStatus } from '@/types/api';
import { SortDir } from '@/types/common';

import { copyService } from '../services/copy.service';
import { BookCopySortField } from '../types/copy.types';

interface CopyCounts {
  total: number;
  available: number;
}

/**
 * Resolves "N available / M total" copy counts per book for BooksPage.
 * Not Redux — this is page-scoped derived data, like useLoanEnrichment.
 * Each book costs two `limit: 1` list calls (total count, available count) —
 * cheap since only `total` from the response envelope is read.
 */
export function useBookCopyCounts(bookIds: string[], reloadToken = 0): Record<string, CopyCounts> {
  const [counts, setCounts] = useState<Record<string, CopyCounts>>({});

  const idsKey = [...new Set(bookIds)].sort().join(',');

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : [];
    if (ids.length === 0) {
      return;
    }

    let cancelled = false;

    async function resolve() {
      const resolved = await Promise.all(
        ids.map(async (bookId) => {
          try {
            const [totalPage, availablePage] = await Promise.all([
              copyService.list({
                skip: 0,
                limit: 1,
                bookId,
                sortBy: BookCopySortField.BARCODE,
                sortDir: SortDir.ASC,
              }),
              copyService.list({
                skip: 0,
                limit: 1,
                bookId,
                status: CopyStatus.AVAILABLE,
                sortBy: BookCopySortField.BARCODE,
                sortDir: SortDir.ASC,
              }),
            ]);
            return [bookId, { total: totalPage.total, available: availablePage.total }] as const;
          } catch {
            return [bookId, null] as const;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      setCounts((prev) => {
        const next = { ...prev };
        for (const [bookId, value] of resolved) {
          if (value) {
            next[bookId] = value;
          }
        }
        return next;
      });
    }

    void resolve();

    return () => {
      cancelled = true;
    };
  }, [idsKey, reloadToken]);

  return counts;
}
