import { httpClient } from '@/services/httpClient';
import { ENDPOINTS } from '@/services/endpoints';
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
  list(params: ListMembersParams): Promise<Page<Member>> {
    return httpClient.get<Page<Member>>(ENDPOINTS.members.list, {
      params: {
        skip: params.skip,
        limit: params.limit,
        name: nonEmpty(params.name),
        email: nonEmpty(params.email),
        phone_number: nonEmpty(params.phoneNumber),
        status: params.status,
        sort_by: params.sortBy,
        sort_dir: params.sortDir,
      },
    });
  },

  get(memberId: string): Promise<Member> {
    return httpClient.get<Member>(ENDPOINTS.members.byId(memberId));
  },

  create(payload: MemberRequest): Promise<Member> {
    return httpClient.post<Member>(ENDPOINTS.members.list, payload);
  },

  update(memberId: string, payload: MemberRequest): Promise<Member> {
    return httpClient.put<Member>(ENDPOINTS.members.byId(memberId), payload);
  },

  remove(memberId: string): Promise<void> {
    return httpClient.delete<void>(ENDPOINTS.members.byId(memberId));
  },
};
