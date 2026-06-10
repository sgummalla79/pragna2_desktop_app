import type {
  AuthTokens,
  LoginPayload,
  RegisterPayload,
  SocialConnection,
  UpdateSettingsPayload,
  User,
} from '@/domain/types/auth.types';

export interface IAuthRepository {
  register(payload: RegisterPayload): Promise<User>;
  login(payload: LoginPayload): Promise<AuthTokens>;

  /**
   * Runs the full social (OAuth) login through the system browser using the
   * loopback redirect flow, and resolves with the session tokens. Replaces the
   * old initiate-redirect + separate-callback-route pair (RFC 8252 native flow).
   */
  loginWithSocial(connection: string): Promise<AuthTokens>;

  /**
   * Exchange a stored refresh token for a fresh access token (Auth0
   * `grant_type=refresh_token`). Returns the new tokens, including a rotated
   * refresh token when rotation is enabled (else the same one is echoed back).
   * Rejects when the refresh token is invalid/expired.
   */
  refresh(refreshToken: string): Promise<AuthTokens>;

  fetchSocialConnections(): Promise<SocialConnection[]>;
  me(): Promise<User>;
  updateSettings(payload: UpdateSettingsPayload): Promise<User>;
}
