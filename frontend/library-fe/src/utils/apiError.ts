import { isApiError } from '@/services/httpClient';
import type { ApiErrorBody } from '@/types/api';

/** Normalizes both ApiErrorBody shapes (string detail vs validation issue
 * list) into a single displayable message instead of `[object Object]`. */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (!isApiError(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  if (!error.response) {
    return 'Unable to reach the server. Check your connection and try again.';
  }

  const body = error.response.data as ApiErrorBody | undefined;
  const detail = body?.detail;

  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((issue) => issue.msg).join(' ');
  }

  return fallback;
}
