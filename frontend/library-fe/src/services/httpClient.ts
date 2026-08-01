import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10_000,
});

/** The only file that imports axios directly; unwraps `response.data` for callers. */
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

/** Factored out so it can be unit tested without an axios instance or Redux store. */
export function createAuthRequestInterceptor(getToken: () => string | null) {
  return (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const token = getToken();
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  };
}

/** Same testability rationale as above. Typed to `Error`, not `unknown`, since
 * axios always rejects with an Error-derived value. */
export function createUnauthorizedResponseInterceptor(onUnauthorized: () => void) {
  return (error: Error): Promise<never> => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      onUnauthorized();
    }
    return Promise.reject(error);
  };
}

/** Injected callbacks avoid importing the store here, which would create a
 * circular import: httpClient -> store -> authSlice -> auth.service -> httpClient. */
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
