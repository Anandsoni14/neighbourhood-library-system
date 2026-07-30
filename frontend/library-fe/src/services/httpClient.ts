import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

export const httpClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

/**
 * Pure request-interceptor logic, factored out so it can be unit tested
 * without an axios instance or a Redux store in the loop.
 */
export function createAuthRequestInterceptor(getToken: () => string | null) {
  return (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const token = getToken();
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  };
}

/**
 * Pure response-error-interceptor logic; same testability rationale.
 *
 * Typed to accept `Error` rather than `unknown`: axios always rejects with
 * the AxiosError it constructed (or whatever the previous interceptor threw),
 * never an arbitrary non-Error value, so re-rejecting it as-is is valid.
 */
export function createUnauthorizedResponseInterceptor(onUnauthorized: () => void) {
  return (error: Error): Promise<never> => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      onUnauthorized();
    }
    return Promise.reject(error);
  };
}

/**
 * Wires the auth interceptors onto a client via injected callbacks rather
 * than importing the Redux store directly here. httpClient -> store ->
 * authSlice -> auth.service -> httpClient would otherwise be a circular
 * module import; the store instead calls this once, after it exists.
 */
export function attachAuthInterceptors(
  client: AxiosInstance,
  options: { getToken: () => string | null; onUnauthorized: () => void },
): void {
  client.interceptors.request.use(createAuthRequestInterceptor(options.getToken));
  client.interceptors.response.use(
    (response) => response,
    createUnauthorizedResponseInterceptor(options.onUnauthorized),
  );
}
