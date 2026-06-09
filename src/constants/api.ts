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

export const LOG_LEVEL: string =
  envOr(import.meta.env.VITE_LOG_LEVEL as string | undefined, 'info');

export const APP_NAME: string =
  envOr(import.meta.env.VITE_APP_NAME as string | undefined, 'Pragna');

export const APP_VERSION: string =
  envOr(import.meta.env.VITE_APP_VERSION as string | undefined, '0.1.0');
