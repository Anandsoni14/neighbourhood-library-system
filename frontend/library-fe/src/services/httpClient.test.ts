import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '@/tests/server';

import {
  createAuthRequestInterceptor,
  createUnauthorizedResponseInterceptor,
  httpClient,
  isApiError,
} from './httpClient';

// Matches the jsdom `url` pinned in vite.config.ts's test.environmentOptions
// (see src/tests/handlers.ts for the same convention).
const API_ORIGIN = 'http://localhost:3000/api/v1';

function makeConfig(): InternalAxiosRequestConfig {
  return { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
}

describe('httpClient', () => {
  it('get() resolves with response.data, not the full axios response', async () => {
    server.use(http.get(`${API_ORIGIN}/ping`, () => HttpResponse.json({ pong: true })));

    const result = await httpClient.get<{ pong: boolean }>('/ping');

    expect(result).toEqual({ pong: true });
  });

  it('post() sends the body and unwraps the response', async () => {
    server.use(
      http.post(`${API_ORIGIN}/echo`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ received: body }, { status: 201 });
      }),
    );

    const result = await httpClient.post<{ received: unknown }>('/echo', { name: 'Ada' });

    expect(result).toEqual({ received: { name: 'Ada' } });
  });

  it('delete() unwraps a response with no body', async () => {
    server.use(http.delete(`${API_ORIGIN}/thing/1`, () => new HttpResponse(null, { status: 204 })));

    const result = await httpClient.delete('/thing/1');

    expect(result).toBeFalsy();
  });

  it('rejects with the axios error when the server responds with an error status', async () => {
    server.use(
      http.get(`${API_ORIGIN}/broken`, () =>
        HttpResponse.json({ detail: 'nope' }, { status: 500 }),
      ),
    );

    await expect(httpClient.get('/broken')).rejects.toMatchObject({
      response: { status: 500 },
    });
  });
});

describe('isApiError', () => {
  it('recognizes an AxiosError', () => {
    expect(isApiError(new AxiosError('boom', 'ERR_BAD_REQUEST'))).toBe(true);
  });

  it('rejects a plain Error', () => {
    expect(isApiError(new Error('boom'))).toBe(false);
  });
});

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
