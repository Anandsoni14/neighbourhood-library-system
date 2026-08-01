import { useEffect, useState } from 'react';

import { CopyStatus } from '@/types/api';
import { SortDir } from '@/types/common';

import { copyService } from '../services/copy.service';
import { BookCopySortField } from '../types/copy.types';

interface CopyCounts {
  total: number;
  available: number;
}

// The backend caps `limit` at 1000 (see api/pagination.py); a catalogue with
// more copies than that would need real server-side aggregation instead.
const MAX_COPIES_PER_FETCH = 1000;

/** Resolves "N available / M total" copy counts per book in a single
 * unfiltered request, rather than two requests per visible book. */
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
      try {
        const page = await copyService.list({
          skip: 0,
          limit: MAX_COPIES_PER_FETCH,
          sortBy: BookCopySortField.BARCODE,
          sortDir: SortDir.ASC,
        });

        if (cancelled) {
          return;
        }

        const next: Record<string, CopyCounts> = {};
        for (const bookId of ids) {
          next[bookId] = { total: 0, available: 0 };
        }
        for (const copy of page.items) {
          const entry = next[copy.book_id];
          if (!entry) {
            continue;
          }
          entry.total += 1;
          if (copy.status === CopyStatus.AVAILABLE) {
            entry.available += 1;
          }
        }

        setCounts((prev) => ({ ...prev, ...next }));
      } catch {
        // Leave existing counts as-is — affected cells just keep showing "…".
      }
    }

    void resolve();

    return () => {
      cancelled = true;
    };
  }, [idsKey, reloadToken]);

  return counts;
}
