import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';

import { getApiErrorMessage } from './apiError';

function makeAxiosError(status: number, data: unknown): AxiosError {
  const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST');
  error.response = {
    status,
    statusText: 'Error',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data,
  };
  return error;
}

describe('getApiErrorMessage', () => {
  it('returns a domain error string as-is', () => {
    const error = makeAxiosError(404, { detail: 'Book not found' });
    expect(getApiErrorMessage(error)).toBe('Book not found');
  });

  it('joins FastAPI validation issues into a readable message', () => {
    const error = makeAxiosError(422, {
      detail: [
        { loc: ['body', 'title'], msg: 'Field required', type: 'missing' },
        { loc: ['body', 'author'], msg: 'Field required', type: 'missing' },
      ],
    });
    expect(getApiErrorMessage(error)).toBe('Field required Field required');
  });

  it('falls back to a network-specific message when there is no response', () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK');
    expect(getApiErrorMessage(error)).toMatch(/reach the server/i);
  });

  it('falls back to the provided default when detail is missing', () => {
    const error = makeAxiosError(500, {});
    expect(getApiErrorMessage(error, 'Custom fallback')).toBe('Custom fallback');
  });

  it('handles a plain Error for non-axios failures', () => {
    expect(getApiErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('falls back for a completely unknown thrown value', () => {
    expect(getApiErrorMessage('not an error', 'Custom fallback')).toBe('Custom fallback');
  });
});
