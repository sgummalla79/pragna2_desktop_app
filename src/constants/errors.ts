/**
 * Centralised error catalog.
 *
 * Every user-facing error and every loggable error condition in the application
 * is defined here. Use the code for log correlation, the message for UI display.
 *
 * Prefixes
 *   AUTH  – authentication / session
 *   NET   – network / HTTP layer
 */

export const ERRORS = {
  // ── Authentication ────────────────────────────────────────────────────────
  AUTH_001: { code: 'AUTH_001', message: 'No active session. Please sign in.', severity: 'warn' },
  AUTH_002: { code: 'AUTH_002', message: 'Unable to read your profile from the sign-in token.', severity: 'error' },
  AUTH_003: { code: 'AUTH_003', message: 'Session refresh failed. Please sign in again.', severity: 'warn' },
  AUTH_004: { code: 'AUTH_004', message: 'Popup blocked. Allow popups for this site and try again.', severity: 'warn' },
  AUTH_005: { code: 'AUTH_005', message: 'Sign-in was cancelled.', severity: 'info' },
  AUTH_006: { code: 'AUTH_006', message: 'Social sign-in failed. Please try again.', severity: 'error' },
  AUTH_007: { code: 'AUTH_007', message: 'Invalid email or password.', severity: 'warn' },
  AUTH_008: { code: 'AUTH_008', message: 'Registration failed. This email may already be in use.', severity: 'warn' },
  AUTH_009: { code: 'AUTH_009', message: 'Sign-in timed out. Please try again.', severity: 'warn' },
  AUTH_010: { code: 'AUTH_010', message: 'Token exchange failed. Please try again.', severity: 'error' },

  // ── Network / HTTP ────────────────────────────────────────────────────────
  NET_401: { code: 'NET_401', message: 'Your session has expired. Please sign in again.', severity: 'warn' },
  NET_403: { code: 'NET_403', message: 'You do not have permission to perform this action.', severity: 'warn' },
  NET_404: { code: 'NET_404', message: 'The requested resource was not found.', severity: 'warn' },
  NET_409: { code: 'NET_409', message: 'This resource already exists.', severity: 'warn' },
  NET_500: { code: 'NET_500', message: 'A server error occurred. Please try again later.', severity: 'error' },
} as const;

export type ErrorCode = keyof typeof ERRORS;
export type ErrorEntry = typeof ERRORS[ErrorCode];
