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

  fetchSocialConnections(): Promise<SocialConnection[]>;
  me(): Promise<User>;
  updateSettings(payload: UpdateSettingsPayload): Promise<User>;
}
