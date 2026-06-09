export const ROUTES = {
  // ── Auth ─────────────────────────────────────────────────────────────────
  // Social login uses the system browser + a localhost loopback server (RFC 8252),
  // so there is no in-app OAuth callback route — the loopback server is the callback.
  LOGIN:          '/login',
  REGISTER:       '/register',

  // ── Main ─────────────────────────────────────────────────────────────────
  // Post-login landing. The full chat surface is not yet ported into the
  // desktop app — this currently resolves to a minimal "signed in" placeholder.
  CHAT:           '/chat',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
