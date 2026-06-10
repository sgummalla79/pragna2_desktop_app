export interface User {
  id: string;
  email: string;
  name: string | null;
  identityProvider: string;
  settings: UserSettings;
}

export interface UserSettings {
  theme?: string;
  defaultFlowId?: string;
  [key: string]: unknown;
}

export interface AuthTokens {
  accessToken: string;
  idToken?: string;
  /** Long-lived refresh token (present when Auth0 issues one for `offline_access`).
   *  Persisted to the OS keychain to restore the session across restarts. */
  refreshToken?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name?: string;
}

export interface UpdateSettingsPayload {
  settings: UserSettings;
}

export interface SocialConnection {
  name: string;       // Auth0 connection name, e.g. "google-oauth2"
  strategy: string;   // Auth0 strategy key, e.g. "google-oauth2"
  displayName: string; // Human label, e.g. "Google"
}
