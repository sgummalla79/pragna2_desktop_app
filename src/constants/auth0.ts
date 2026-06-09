// All import.meta.env reads for Auth0 are centralised here — no other file may access them.

export const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN ?? '';
export const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID ?? '';
export const AUTH0_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE ?? '';

export const AUTH0_SCOPE = 'openid profile email offline_access';

// Auth0's fixed name for the built-in email/password database connection.
// This is a well-known Auth0 constant, not a deployment variable.
export const AUTH0_DB_CONNECTION = 'Username-Password-Authentication';

// ── Loopback OAuth (RFC 8252) — production-grade social login ────────────────
// Social login opens the SYSTEM browser and Auth0 redirects back to a temporary
// localhost HTTP server (tauri-plugin-oauth). Works identically in dev and a
// packaged build because it never depends on the webview origin.
//
// Auth0 matches the redirect URI EXACTLY (including port), so we can't use a
// random port. Instead we register a small POOL of ports as Allowed Callback
// URLs and bind the first one that's free — this survives the case where
// another app already holds the preferred port. EVERY port in this list must be
// registered in Auth0. Override the pool with VITE_OAUTH_LOOPBACK_PORTS
// (comma-separated) if these collide on a given machine.
const DEFAULT_LOOPBACK_PORTS = [8788, 8789, 8790, 8791];

export const AUTH0_LOOPBACK_PORTS: number[] = (() => {
  const raw = import.meta.env.VITE_OAUTH_LOOPBACK_PORTS as string | undefined;
  if (!raw || raw.trim() === '') return DEFAULT_LOOPBACK_PORTS;
  const parsed = raw
    .split(',')
    .map((p) => Number(p.trim()))
    .filter((p) => Number.isInteger(p) && p > 0 && p < 65536);
  return parsed.length > 0 ? parsed : DEFAULT_LOOPBACK_PORTS;
})();

export const AUTH0_LOOPBACK_PATH = '/callback';

/** Builds the exact redirect URI for a bound loopback port (must match Auth0). */
export const loopbackRedirectUri = (port: number): string =>
  `http://localhost:${port}${AUTH0_LOOPBACK_PATH}`;

// Strategies that identify a social or enterprise connection (not a local database connection).
export const SOCIAL_STRATEGIES = new Set([
  'google-oauth2',
  'github',
  'twitter',
  'facebook',
  'apple',
  'microsoft',
  'linkedin',
  'windowslive',
  'yahoo',
  'salesforce',
  'salesforce-sandbox',
  'waad',  // Azure AD
  'adfs',
  'oauth2',
  'samlp',
  'oidc',
]);

export const SOCIAL_DISPLAY_NAMES: Record<string, string> = {
  'google-oauth2': 'Google',
  'github': 'GitHub',
  'twitter': 'Twitter / X',
  'facebook': 'Facebook',
  'apple': 'Apple',
  'microsoft': 'Microsoft',
  'linkedin': 'LinkedIn',
  'windowslive': 'Microsoft',
  'yahoo': 'Yahoo',
  'salesforce': 'Salesforce',
  'salesforce-sandbox': 'Salesforce Sandbox',
  'waad': 'Azure AD',
  'adfs': 'ADFS',
};
