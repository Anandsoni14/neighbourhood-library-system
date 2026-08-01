import { renderHook, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setupStore } from '@/redux/store';
import { httpClient } from '@/services/httpClient';
import type * as httpClientModule from '@/services/httpClient';
import { MembershipStatus } from '@/types/api';

import { useMembers } from './useMembers';
import { MemberSortField } from '../types/member.types';

vi.mock('@/services/httpClient', async (importOriginal) => {
  const actual = await importOriginal<typeof httpClientModule>();
  return {
    ...actual,
    httpClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
    attachAuthInterceptors: vi.fn(),
  };
});

const member = {
  member_id: '1',
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
  membership_status: MembershipStatus.ACTIVE,
  remarks: null,
};

function wrapperFor(store: ReturnType<typeof setupStore>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe('useMembers', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches members and exposes the resulting list and total', async () => {
    vi.mocked(httpClient.get).mockResolvedValue({ items: [member], total: 1 });

    const store = setupStore();
    const { result } = renderHook(() => useMembers(), { wrapper: wrapperFor(store) });

    await result.current.fetchMembers({
      skip: 0,
      limit: 25,
      sortBy: MemberSortField.LAST_NAME,
      sortDir: 'asc',
    });

    await waitFor(() => {
      expect(result.current.members).toEqual([member]);
    });
    expect(result.current.total).toBe(1);
  });

  it('creates a member and reports the mutation as no longer in flight', async () => {
    vi.mocked(httpClient.post).mockResolvedValue(member);

    const store = setupStore();
    const { result } = renderHook(() => useMembers(), { wrapper: wrapperFor(store) });

    await result.current.createMember({
      first_name: member.first_name,
      last_name: member.last_name,
      email: member.email,
    });

    await waitFor(() => {
      expect(result.current.isMutating).toBe(false);
    });
    expect(result.current.mutationError).toBeNull();
  });

  it('surfaces a mutation error and clears it on demand', async () => {
    const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST');
    error.response = {
      status: 409,
      statusText: 'Conflict',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { detail: 'Cannot delete member: it has associated loan or transaction records' },
    };
    vi.mocked(httpClient.delete).mockRejectedValue(error);

    const store = setupStore();
    const { result } = renderHook(() => useMembers(), { wrapper: wrapperFor(store) });

    await result.current.deleteMember('1');

    await waitFor(() => {
      expect(result.current.mutationError).toBe(
        'Cannot delete member: it has associated loan or transaction records',
      );
    });

    result.current.clearMutationError();

    await waitFor(() => {
      expect(result.current.mutationError).toBeNull();
    });
  });
});
