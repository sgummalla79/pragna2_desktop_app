import axios, { type AxiosInstance } from 'axios';
import {
  CLIENT_APP_HEADER,
  CLIENT_APP_NAME,
  CLIENT_VERSION,
  CLIENT_VERSION_HEADER,
} from '@/constants/version';
import { useVersionStore } from '@/presentation/store/versionStore';

// HTTP status the API returns when this client is older than it will serve.
const HTTP_UPGRADE_REQUIRED = 426;

const DEFAULT_UPGRADE_MESSAGE =
  'A newer version of this app is required to continue. Please update.';

/**
 * Wire the version-compatibility handshake into the axios client:
 *
 * Request — attach the client-identity headers (X-Client-Version, X-Client-App)
 *   so the API can identify and gate this client (Guard #2). Applies in both
 *   Tauri and browser-fallback modes (the interceptor runs regardless of the
 *   underlying axios adapter).
 *
 * Response — on 426 Upgrade Required (the API actively rejecting a too-old
 *   client once MIN_CLIENT_COMPAT is raised), flip the version store into its
 *   blocked state so a non-dismissible "update required" screen takes over
 *   (Phase 3 enforcement). Dormant until the API enforces.
 *
 * See nexus-kit-api/docs/architecture/version-compatibility.md.
 */
export function applyVersionInterceptor(client: AxiosInstance): void {
  client.interceptors.request.use((config) => {
    config.headers.set(CLIENT_VERSION_HEADER, CLIENT_VERSION);
    config.headers.set(CLIENT_APP_HEADER, CLIENT_APP_NAME);
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (
        axios.isAxiosError(error) &&
        error.response?.status === HTTP_UPGRADE_REQUIRED
      ) {
        const detail = (error.response.data as { detail?: { message?: string } })
          ?.detail;
        useVersionStore.getState().setBlocked(detail?.message ?? DEFAULT_UPGRADE_MESSAGE);
      }
      return Promise.reject(error);
    },
  );
}
