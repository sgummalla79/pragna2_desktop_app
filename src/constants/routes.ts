export const ROUTES = {
  // ── Auth ─────────────────────────────────────────────────────────────────
  // Social login uses the system browser + a localhost loopback server (RFC 8252),
  // so there is no in-app OAuth callback route — the loopback server is the callback.
  LOGIN:          '/login',
  REGISTER:       '/register',

  // ── Main ─────────────────────────────────────────────────────────────────
  // Post-login landing. Index → ChatLandingView; `/chat/:id` → ChatSessionView.
  CHAT:           '/chat',
  // Full-width conversation history browser (search + infinite scroll).
  CHAT_HISTORY:   '/chat/history',

  // ── Settings ─────────────────────────────────────────────────────────────
  SETTINGS:               '/settings',
  SETTINGS_CONFIGURATION: '/settings/configuration',
  SETTINGS_PROVIDERS:     '/settings/providers',
  SETTINGS_CONNECTORS:    '/settings/connectors',
  SETTINGS_LOCAL_SERVERS: '/settings/local-servers',
  SETTINGS_KNOWLEDGE:     '/settings/knowledge',
  SETTINGS_AGENTS:        '/settings/agents',
  SETTINGS_FLOWS:         '/settings/flows',
  SETTINGS_FLOW_DETAIL:   '/settings/flows/:flowId',
  SETTINGS_APPEARANCE:    '/settings/appearance',
  SETTINGS_PROFILE:       '/settings/profile',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
