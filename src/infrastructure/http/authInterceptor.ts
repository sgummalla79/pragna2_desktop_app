import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import axios from 'axios';
import { tokenStorage } from '@/infrastructure/storage/tokenStorage';
import { logger } from '@/infrastructure/logging/logger';

const AUTH_HEADER = 'Authorization';

/**
 * Applies two interceptors to the Axios client:
 *
 * Request — attaches the session token as a Bearer header on every call.
 *
 * Response — on 401, the session has expired. Clear storage and redirect
 *   to the login page. No silent refresh — the user authenticates again.
 */
export function applyAuthInterceptor(
  client: AxiosInstance,
  onLogout: () => void
): void {
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = tokenStorage.getAccessToken();
    if (token) {
      config.headers.set(AUTH_HEADER, `Bearer ${token}`);
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        logger.warn('auth:session:expired');
        tokenStorage.clearAll();
        onLogout();
      }
      return Promise.reject(error);
    }
  );
}
