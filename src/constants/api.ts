// Read a Vite build-time env var, falling back when it is unset OR an empty/blank
// string. The `??` operator does NOT fall back on `""`, so treat blank as missing
// here so every default below is honoured regardless of how Vite supplies the value.
export const envOr = (value: string | undefined, fallback: string): string =>
  value !== undefined && value.trim() !== '' ? value : fallback;

// The API ROOT, including the `/api` prefix — e.g. http://localhost:8000/api.
// The axios client uses this as its baseURL, so repository call sites are
// resource-relative (`/auth/me`), NOT prefixed with `/api`.
export const API_BASE_URL: string =
  envOr(import.meta.env.VITE_API_BASE_URL as string | undefined, 'http://localhost:8000/api');

// Base for the AG-UI native chat surface, nested under `/api` alongside the REST
// API. Three routes hang off it: `POST {PRAGNA_BASE_URL}/chat` (default chat
// agent), `POST {PRAGNA_BASE_URL}/flows/{name}` (slash-exposed flow, deferred),
// and `GET {PRAGNA_BASE_URL}/flows` (slash discovery, deferred).
//
// Unlike the web app — which uses a RELATIVE `/api/pragna` so the Vite dev proxy
// avoids CORS — the desktop webview has no proxy and a non-HTTP origin, so this
// MUST be an ABSOLUTE URL. We derive it from `API_BASE_URL` (which already
// carries the `/api` prefix) so a single env var configures both surfaces;
// `VITE_PRAGNA_BASE_URL` can override it independently when needed.
export const PRAGNA_BASE_URL: string = envOr(
  import.meta.env.VITE_PRAGNA_BASE_URL as string | undefined,
  `${API_BASE_URL}/pragna`,
);

export const LOG_LEVEL: string =
  envOr(import.meta.env.VITE_LOG_LEVEL as string | undefined, 'info');

export const APP_NAME: string =
  envOr(import.meta.env.VITE_APP_NAME as string | undefined, 'Pragna');

export const APP_VERSION: string =
  envOr(import.meta.env.VITE_APP_VERSION as string | undefined, '0.1.0');

// Capability the desktop declares on run-start requests so the backend binds
// client-delegated (stdio) tools and the capability gate passes (Phase F). The
// web app omits this header and is rejected (409) if a run needs stdio tools.
export const CLIENT_CAPABILITIES_HEADER = 'X-Client-Capabilities';
export const CLIENT_CAPABILITY_STDIO_DELEGATION = 'stdio_delegation';

