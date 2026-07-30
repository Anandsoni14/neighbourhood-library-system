export interface PaginationParams {
  skip: number;
  limit: number;
}

export const SortDir = {
  ASC: 'asc',
  DESC: 'desc',
} as const;
export type SortDir = (typeof SortDir)[keyof typeof SortDir];

export const RequestStatus = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
} as const;
export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];
