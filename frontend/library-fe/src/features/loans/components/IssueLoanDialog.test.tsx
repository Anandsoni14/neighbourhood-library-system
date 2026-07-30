import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { copyService } from '@/features/copies/services/copy.service';
import { httpClient } from '@/services/httpClient';
import { render, screen, waitFor } from '@/tests/test-utils';
import { CopyCondition, CopyStatus } from '@/types/api';

import { IssueLoanDialog } from './IssueLoanDialog';

vi.mock('@/services/httpClient', () => ({
  httpClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  attachAuthInterceptors: vi.fn(),
}));

vi.mock('@/features/copies/services/copy.service', () => ({
  copyService: { list: vi.fn() },
}));

const book = {
  book_id: 'b1',
  title: 'Clean Code',
  author: 'Robert C. Martin',
  publisher: null,
  isbn: null,
  category: null,
  description: null,
  published_year: 2008,
};

const copy = {
  copy_id: 'c1',
  book_id: 'b1',
  barcode: 'BC-001',
  shelf_code: null,
  condition: CopyCondition.NEW,
  status: CopyStatus.AVAILABLE,
  max_borrow_days: 14,
  late_fee_per_day: 5,
};

const member = {
  member_id: 'm1',
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone_number: null,
  government_id_type: null,
  government_id_number: null,
  street: null,
  city: null,
  state: null,
  postal_code: null,
  country: null,
  membership_status: 'ACTIVE',
  remarks: null,
};

describe('IssueLoanDialog', () => {
  it('walks through book, copy, and member selection then submits', async () => {
    const user = userEvent.setup();
    vi.mocked(httpClient.get).mockImplementation((url: string) => {
      if (url === '/books') {
        return Promise.resolve({ data: { items: [book], total: 1, skip: 0, limit: 25 } });
      }
      if (url === '/members') {
        return Promise.resolve({ data: { items: [member], total: 1, skip: 0, limit: 25 } });
      }
      return Promise.resolve({ data: { items: [], total: 0, skip: 0, limit: 25 } });
    });
    vi.mocked(copyService.list).mockResolvedValue({ items: [copy], total: 1, skip: 0, limit: 50 });

    const onSubmit = vi.fn();
    render(
      <IssueLoanDialog open isSubmitting={false} error={null} onClose={vi.fn()} onSubmit={onSubmit} />,
    );

    const bookInput = screen.getByLabelText('Book');
    await user.type(bookInput, 'Clean');
    await waitFor(() => {
      expect(screen.getByText(/Clean Code — Robert C\. Martin/)).toBeVisible();
    });
    await user.click(screen.getByText(/Clean Code — Robert C\. Martin/));

    await waitFor(() => {
      expect(copyService.list).toHaveBeenCalledWith(
        expect.objectContaining({ bookId: 'b1', status: 'AVAILABLE' }),
      );
    });

    const copyInput = screen.getByLabelText('Copy');
    await user.click(copyInput);
    await waitFor(() => {
      expect(screen.getByText(/BC-001/)).toBeVisible();
    });
    await user.click(screen.getByText(/BC-001/));

    const memberInput = screen.getByLabelText('Member');
    await user.type(memberInput, 'Ada');
    await waitFor(() => {
      expect(screen.getByText(/Ada Lovelace/)).toBeVisible();
    });
    await user.click(screen.getByText(/Ada Lovelace/));

    await user.click(screen.getByRole('button', { name: 'Issue loan' }));

    expect(onSubmit).toHaveBeenCalledWith({
      copy_id: 'c1',
      member_id: 'm1',
      remarks: null,
    });
  });

  it('blocks submission until a copy and member are selected', async () => {
    const user = userEvent.setup();
    vi.mocked(httpClient.get).mockResolvedValue({ data: { items: [], total: 0, skip: 0, limit: 25 } });

    const onSubmit = vi.fn();
    render(
      <IssueLoanDialog open isSubmitting={false} error={null} onClose={vi.fn()} onSubmit={onSubmit} />,
    );

    await user.click(screen.getByRole('button', { name: 'Issue loan' }));

    expect(await screen.findByText(/a copy and a member are required/i)).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the server error passed in', () => {
    render(
      <IssueLoanDialog
        open
        isSubmitting={false}
        error="Member is not eligible to borrow."
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText('Member is not eligible to borrow.')).toBeVisible();
  });
});
