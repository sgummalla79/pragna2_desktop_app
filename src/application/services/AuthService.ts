import type { IAuthRepository } from '@/application/ports/IAuthRepository';
import type {
  AuthTokens,
  LoginPayload,
  RegisterPayload,
  SocialConnection,
  UpdateSettingsPayload,
  User,
} from '@/domain/types/auth.types';
import { tokenStorage } from '@/infrastructure/storage/tokenStorage';
import { secureStore } from '@/infrastructure/storage/secureStore';

export class AuthService {
  constructor(private readonly authRepository: IAuthRepository) {}

  async register(payload: RegisterPayload): Promise<User> {
    return this.authRepository.register(payload);
  }

  async login(payload: LoginPayload): Promise<{ user: User; tokens: AuthTokens }> {
    const tokens = await this.authRepository.login(payload);
    await this.storeTokens(tokens);
    const user = await this.authRepository.me();
    return { user, tokens };
  }

  /**
   * Runs the full social login through the system browser (loopback flow),
   * stores the session, and returns the authenticated user.
   */
  async loginWithSocial(connection: string): Promise<{ user: User; tokens: AuthTokens }> {
    const tokens = await this.authRepository.loginWithSocial(connection);
    await this.storeTokens(tokens);
    const user = await this.authRepository.me();
    return { user, tokens };
  }

  /**
   * Restores the session on app start. First tries the in-memory access token
   * (survives a same-session reload). If that's gone (a fresh launch — the token
   * lives in sessionStorage) it falls back to a refresh token persisted in the
   * OS keychain, silently exchanging it for a new access token (TD-009). Returns
   * `null` (sign-in required) when neither path yields a valid session.
   */
  async bootstrap(): Promise<{ user: User; accessToken: string } | null> {
    const accessToken = tokenStorage.getAccessToken();
    if (accessToken) {
      try {
        const user = await this.authRepository.me();
        return { user, accessToken };
      } catch {
        tokenStorage.clearAll();
        // Fall through to the refresh-token path below.
      }
    }

    const refreshToken = await secureStore.getRefreshToken();
    if (!refreshToken) return null;
    try {
      const tokens = await this.authRepository.refresh(refreshToken);
      await this.storeTokens(tokens);
      const user = await this.authRepository.me();
      return { user, accessToken: tokens.accessToken };
    } catch {
      // Refresh token rejected/expired — clear it so we don't retry every launch.
      await secureStore.clearRefreshToken();
      tokenStorage.clearAll();
      return null;
    }
  }

  async fetchSocialConnections(): Promise<SocialConnection[]> {
    return this.authRepository.fetchSocialConnections();
  }

  async me(): Promise<User> {
    return this.authRepository.me();
  }

  async updateSettings(payload: UpdateSettingsPayload): Promise<User> {
    return this.authRepository.updateSettings(payload);
  }

  logout(): void {
    tokenStorage.clearAll();
    // Drop the persisted refresh token so a relaunch doesn't silently re-auth.
    void secureStore.clearRefreshToken();
  }

  private async storeTokens(tokens: AuthTokens): Promise<void> {
    tokenStorage.setAccessToken(tokens.accessToken);
    if (tokens.idToken) tokenStorage.setIdToken(tokens.idToken);
    // Persist the refresh token to the OS keychain for cross-restart sessions.
    if (tokens.refreshToken) await secureStore.setRefreshToken(tokens.refreshToken);
  }
}
