import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10_000,
});

/**
 * The only file in the project that imports axios — every service goes
 * through this instead, so swapping the HTTP library only ever touches
 * this file. Unwraps `response.data` so callers work with plain payloads.
 */
export const httpClient = {
  get: <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    axiosInstance.get<T>(url, config).then((response) => response.data),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    axiosInstance.post<T>(url, data, config).then((response) => response.data),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    axiosInstance.put<T>(url, data, config).then((response) => response.data),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    axiosInstance.patch<T>(url, data, config).then((response) => response.data),
  delete: <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    axiosInstance.delete<T>(url, config).then((response) => response.data),
};

/** Lets callers (e.g. apiError.ts) recognize axios failures without importing axios themselves. */
export function isApiError(error: unknown): error is AxiosError {
  return axios.isAxiosError(error);
}

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
 * Wires the auth interceptors onto the shared instance via injected
 * callbacks rather than importing the Redux store directly here.
 * httpClient -> store -> authSlice -> auth.service -> httpClient would
 * otherwise be a circular module import; the store instead calls this
 * once, after it exists.
 */
export function attachAuthInterceptors(options: {
  getToken: () => string | null;
  onUnauthorized: () => void;
}): void {
  axiosInstance.interceptors.request.use(createAuthRequestInterceptor(options.getToken));
  axiosInstance.interceptors.response.use(
    (response) => response,
    createUnauthorizedResponseInterceptor(options.onUnauthorized),
  );
}
