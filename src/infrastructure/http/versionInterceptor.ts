import type { AxiosInstance } from 'axios';
import {
  CLIENT_APP_HEADER,
  CLIENT_APP_NAME,
  CLIENT_VERSION,
  CLIENT_VERSION_HEADER,
} from '@/constants/version';

/**
 * Attach the client-identity headers (X-Client-Version, X-Client-App) to every
 * backend request so the API can run the version-compatibility handshake.
 * Applies in both Tauri and browser-fallback modes (the request interceptor
 * runs regardless of the underlying axios adapter).
 * See pragna2-api/docs/architecture/version-compatibility.md (Guard #2).
 */
export function applyVersionInterceptor(client: AxiosInstance): void {
  client.interceptors.request.use((config) => {
    config.headers.set(CLIENT_VERSION_HEADER, CLIENT_VERSION);
    config.headers.set(CLIENT_APP_HEADER, CLIENT_APP_NAME);
    return config;
  });
}
