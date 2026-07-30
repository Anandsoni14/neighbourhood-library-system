import { describe, expect, it, vi } from 'vitest';

import { httpClient } from '@/services/httpClient';
import { MembershipStatus } from '@/types/api';
import { SortDir } from '@/types/common';

import { memberService } from './member.service';
import { MemberSortField } from '../types/member.types';

vi.mock('@/services/httpClient', () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

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

describe('memberService', () => {
  it('lists members, omitting blank filters and forwarding sort/pagination', async () => {
    vi.mocked(httpClient.get).mockResolvedValue({
      data: { items: [member], total: 1, skip: 0, limit: 25 },
    });

    const result = await memberService.list({
      skip: 0,
      limit: 25,
      name: 'Ada',
      email: '',
      sortBy: MemberSortField.LAST_NAME,
      sortDir: SortDir.ASC,
    });

    expect(httpClient.get).toHaveBeenCalledWith('/members', {
      params: {
        skip: 0,
        limit: 25,
        name: 'Ada',
        email: undefined,
        status: undefined,
        sort_by: 'last_name',
        sort_dir: 'asc',
      },
    });
    expect(result).toEqual({ items: [member], total: 1, skip: 0, limit: 25 });
  });

  it('fetches a single member by id', async () => {
    vi.mocked(httpClient.get).mockResolvedValue({ data: member });

    const result = await memberService.get('1');

    expect(httpClient.get).toHaveBeenCalledWith('/members/1');
    expect(result).toEqual(member);
  });

  it('creates a member', async () => {
    vi.mocked(httpClient.post).mockResolvedValue({ data: member });

    const payload = { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' };
    const result = await memberService.create(payload);

    expect(httpClient.post).toHaveBeenCalledWith('/members', payload);
    expect(result).toEqual(member);
  });

  it('updates a member', async () => {
    vi.mocked(httpClient.put).mockResolvedValue({ data: member });

    const payload = { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' };
    const result = await memberService.update('1', payload);

    expect(httpClient.put).toHaveBeenCalledWith('/members/1', payload);
    expect(result).toEqual(member);
  });

  it('deletes a member', async () => {
    vi.mocked(httpClient.delete).mockResolvedValue({ data: undefined });

    await memberService.remove('1');

    expect(httpClient.delete).toHaveBeenCalledWith('/members/1');
  });
});
