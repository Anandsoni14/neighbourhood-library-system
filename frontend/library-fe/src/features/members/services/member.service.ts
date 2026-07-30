import { httpClient } from '@/services/httpClient';
import type { Page } from '@/types/api';

import type { ListMembersParams, Member, MemberRequest } from '../types/member.types';

/** An empty filter string means "no filter" to the API, so send `undefined` instead. */
function nonEmpty(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value;
}

export const memberService = {
  async list(params: ListMembersParams): Promise<Page<Member>> {
    const { data } = await httpClient.get<Page<Member>>('/members', {
      params: {
        skip: params.skip,
        limit: params.limit,
        name: nonEmpty(params.name),
        email: nonEmpty(params.email),
        status: params.status,
        sort_by: params.sortBy,
        sort_dir: params.sortDir,
      },
    });
    return data;
  },

  async create(payload: MemberRequest): Promise<Member> {
    const { data } = await httpClient.post<Member>('/members', payload);
    return data;
  },

  async update(memberId: string, payload: MemberRequest): Promise<Member> {
    const { data } = await httpClient.put<Member>(`/members/${memberId}`, payload);
    return data;
  },

  async remove(memberId: string): Promise<void> {
    await httpClient.delete(`/members/${memberId}`);
  },
};
