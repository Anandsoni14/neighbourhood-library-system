import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { server } from '@/tests/server';

import { useBookCopyCounts } from './useBookCopyCounts';

const API_ORIGIN = 'http://localhost:3000/api/v1';
const FIRST_BOOK_ID = '22222222-2222-2222-2222-222222222221';
const SECOND_BOOK_ID = '22222222-2222-2222-2222-222222222222';

describe('useBookCopyCounts', () => {
  it('resolves total/available counts per book from a single request', async () => {
    const { result } = renderHook(() => useBookCopyCounts([FIRST_BOOK_ID, SECOND_BOOK_ID]));

    await waitFor(() => {
      expect(result.current[FIRST_BOOK_ID]).toBeDefined();
      expect(result.current[SECOND_BOOK_ID]).toBeDefined();
    });
    expect(result.current[FIRST_BOOK_ID]).toEqual({ total: 1, available: 1 });
    expect(result.current[SECOND_BOOK_ID]).toEqual({ total: 1, available: 0 });
  });

  it('makes exactly one request to /book-copies regardless of how many books are visible', async () => {
    let requestCount = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.url.startsWith(`${API_ORIGIN}/book-copies`)) {
        requestCount += 1;
      }
    });

    const { result } = renderHook(() => useBookCopyCounts([FIRST_BOOK_ID, SECOND_BOOK_ID]));

    await waitFor(() => {
      expect(result.current[FIRST_BOOK_ID]).toBeDefined();
    });

    expect(requestCount).toBe(1);
  });

  it('returns an empty map when there are no book ids', () => {
    const { result } = renderHook(() => useBookCopyCounts([]));

    expect(result.current).toEqual({});
  });
});
