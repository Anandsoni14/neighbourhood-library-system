import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it, vi } from 'vitest';

import { createAuthRequestInterceptor, createUnauthorizedResponseInterceptor } from './httpClient';

function makeConfig(): InternalAxiosRequestConfig {
  return { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
}

describe('createAuthRequestInterceptor', () => {
  it('attaches a Bearer header when a token is present', () => {
    const interceptor = createAuthRequestInterceptor(() => 'abc123');

    const config = interceptor(makeConfig());

    expect(config.headers.get('Authorization')).toBe('Bearer abc123');
  });

  it('leaves the request unmodified when there is no token', () => {
    const interceptor = createAuthRequestInterceptor(() => null);

    const config = interceptor(makeConfig());

    expect(config.headers.get('Authorization')).toBeUndefined();
  });
});

describe('createUnauthorizedResponseInterceptor', () => {
  it('invokes the callback on a 401 response', async () => {
    const onUnauthorized = vi.fn();
    const interceptor = createUnauthorizedResponseInterceptor(onUnauthorized);
    const error = new AxiosError('Unauthorized', 'ERR_BAD_REQUEST');
    error.response = {
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { detail: 'Invalid or expired token' },
    };

    await expect(interceptor(error)).rejects.toBe(error);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('does not invoke the callback for a non-401 error', async () => {
    const onUnauthorized = vi.fn();
    const interceptor = createUnauthorizedResponseInterceptor(onUnauthorized);
    const error = new AxiosError('Not Found', 'ERR_BAD_REQUEST');
    error.response = {
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { detail: 'Book not found' },
    };

    await expect(interceptor(error)).rejects.toBe(error);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not invoke the callback for a non-axios error', async () => {
    const onUnauthorized = vi.fn();
    const interceptor = createUnauthorizedResponseInterceptor(onUnauthorized);

    await expect(interceptor(new Error('boom'))).rejects.toThrow('boom');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
