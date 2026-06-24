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
// API. Three routes hang off it: `POST {CHAT_API_BASE_URL}/chat` (default chat
// agent), `POST {CHAT_API_BASE_URL}/flows/{name}` (slash-exposed flow, deferred),
// and `GET {CHAT_API_BASE_URL}/flows` (slash discovery, deferred).
//
// Unlike the web app — which uses a RELATIVE `/api/pragna` so the Vite dev proxy
// avoids CORS — the desktop webview has no proxy and a non-HTTP origin, so this
// MUST be an ABSOLUTE URL. The chat route prefix is brand-specific (e.g. the
// `pragna2-api` BE serves `/api/pragna`, the `nexus-kit` BE serves
// `/api/nexus-kit`), so the WHOLE base is configurable rather than baked.
//
// Precedence (first non-blank wins):
//   1. `VITE_CHAT_API_BASE_URL` — brand-neutral override (preferred).
//   2. `VITE_PRAGNA_BASE_URL`   — legacy alias, kept for back-compat.
//   3. `${API_BASE_URL}/pragna` — committed default for the pragna2-api BE.
export const CHAT_API_BASE_URL: string = envOr(
  import.meta.env.VITE_CHAT_API_BASE_URL as string | undefined,
  envOr(
    import.meta.env.VITE_PRAGNA_BASE_URL as string | undefined,
    `${API_BASE_URL}/pragna`,
  ),
);

// The chat surface's path segment RELATIVE to API_BASE_URL (e.g. `/pragna` or
// `/nexus-kit`). The streaming transport (TauriHttpAgent) uses the absolute
// CHAT_API_BASE_URL, but the axios-backed slash-discovery repository is
// resource-relative to the `/api` baseURL, so it needs just the trailing
// segment. Derived from CHAT_API_BASE_URL so a SINGLE env var
// (VITE_CHAT_API_BASE_URL) configures BOTH surfaces — no second source to drift.
// CHAT_API_BASE_URL is `${API_BASE_URL}<segment>` by construction, so the prefix
// strips cleanly; the pathname fallback covers a fully-custom absolute override.
export const CHAT_API_PATH: string = CHAT_API_BASE_URL.startsWith(API_BASE_URL)
  ? CHAT_API_BASE_URL.slice(API_BASE_URL.length)
  : new URL(CHAT_API_BASE_URL).pathname.replace(/^\/api/, '');

export const LOG_LEVEL: string =
  envOr(import.meta.env.VITE_LOG_LEVEL as string | undefined, 'info');

// Build-time white-label brand name. Precedence: the `branding/brand.config.json`
// `name` (injected as `__BRAND_NAME__` by Vite) wins, else an explicit
// `VITE_APP_NAME` (shell / .env), else the committed default 'Pragna'. The
// overlay is authoritative because the repo's own .env ships VITE_APP_NAME=Pragna
// as the default — env must not shadow a brander's overlay.
export const APP_NAME: string =
  envOr(__BRAND_NAME__, '') ||
  envOr(import.meta.env.VITE_APP_NAME as string | undefined, 'Pragna');

// Key selecting which thinking-indicator animation the agent uses, resolved
// against the animation registry (src/presentation/components/agent-animation).
// Precedence mirrors APP_NAME: the `brand.config.json` `agentAnimation`
// (`__BRAND_AGENT_ANIMATION__`) wins, else `VITE_AGENT_ANIMATION` env, else empty
// — and an empty/unknown key falls back to the registry default. Kept as the raw
// key (not the resolved strategy) so this module stays free of presentation deps.
export const AGENT_ANIMATION_KEY: string =
  envOr(__BRAND_AGENT_ANIMATION__, '') ||
  envOr(import.meta.env.VITE_AGENT_ANIMATION as string | undefined, '');

// Single source of truth: package.json, injected at build by Vite as
// __APP_VERSION__ (see vite.config.ts / vitest.config.ts). Deliberately NOT read
// from VITE_APP_VERSION — a stale env value must not be able to shadow the real
// release version that drives the compatibility handshake.
export const APP_VERSION: string = __APP_VERSION__;

// Capability the desktop declares on run-start requests so the backend binds
// client-delegated (stdio) tools and the capability gate passes (Phase F). The
// web app omits this header and is rejected (409) if a run needs stdio tools.
export const CLIENT_CAPABILITIES_HEADER = 'X-Client-Capabilities';
export const CLIENT_CAPABILITY_STDIO_DELEGATION = 'stdio_delegation';

