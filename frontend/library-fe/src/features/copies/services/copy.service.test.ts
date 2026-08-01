import { describe, expect, it, vi } from 'vitest';

import { httpClient } from '@/services/httpClient';
import type * as httpClientModule from '@/services/httpClient';
import { CopyCondition, CopyStatus } from '@/types/api';
import { SortDir } from '@/types/common';

import { copyService } from './copy.service';
import { BookCopySortField } from '../types/copy.types';

vi.mock('@/services/httpClient', async (importOriginal) => {
  const actual = await importOriginal<typeof httpClientModule>();
  return {
    ...actual,
    httpClient: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
});

const copy = {
  copy_id: '1',
  book_id: 'b1',
  barcode: 'BC-001',
  shelf_code: 'A1',
  condition: CopyCondition.NEW,
  status: CopyStatus.AVAILABLE,
  max_borrow_days: 14,
  late_fee_per_day: 5,
};

describe('copyService', () => {
  it('lists copies, omitting blank filters and forwarding sort/pagination', async () => {
    vi.mocked(httpClient.get).mockResolvedValue({ items: [copy], total: 1, skip: 0, limit: 25 });

    const result = await copyService.list({
      skip: 0,
      limit: 25,
      bookId: 'b1',
      barcode: '',
      sortBy: BookCopySortField.BARCODE,
      sortDir: SortDir.ASC,
    });

    expect(httpClient.get).toHaveBeenCalledWith('/book-copies', {
      params: {
        skip: 0,
        limit: 25,
        book_id: 'b1',
        status: undefined,
        condition: undefined,
        barcode: undefined,
        sort_by: 'barcode',
        sort_dir: 'asc',
      },
    });
    expect(result).toEqual({ items: [copy], total: 1, skip: 0, limit: 25 });
  });

  it('fetches a single copy by id', async () => {
    vi.mocked(httpClient.get).mockResolvedValue(copy);

    const result = await copyService.get('1');

    expect(httpClient.get).toHaveBeenCalledWith('/book-copies/1');
    expect(result).toEqual(copy);
  });

  it('creates a copy', async () => {
    vi.mocked(httpClient.post).mockResolvedValue(copy);

    const payload = { book_id: 'b1', barcode: 'BC-001' };
    const result = await copyService.create(payload);

    expect(httpClient.post).toHaveBeenCalledWith('/book-copies', payload);
    expect(result).toEqual(copy);
  });

  it('updates a copy', async () => {
    vi.mocked(httpClient.put).mockResolvedValue(copy);

    const payload = { barcode: 'BC-002' };
    const result = await copyService.update('1', payload);

    expect(httpClient.put).toHaveBeenCalledWith('/book-copies/1', payload);
    expect(result).toEqual(copy);
  });

  it('deletes a copy', async () => {
    vi.mocked(httpClient.delete).mockResolvedValue(undefined);

    await copyService.remove('1');

    expect(httpClient.delete).toHaveBeenCalledWith('/book-copies/1');
  });
});
