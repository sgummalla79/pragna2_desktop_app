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
  /**
   * In-flight `bootstrap()` promise, shared by concurrent callers (single-flight).
   * StrictMode double-invokes the bootstrap effect in dev, and refresh-token
   * rotation makes two parallel `refresh()` calls fatal: the second reuses the
   * already-rotated token, Auth0's reuse-detection rejects it, and the loser's
   * `catch` clears the access token the winner just stored — producing a 401
   * burst. Collapsing concurrent calls onto one promise guarantees a single
   * refresh + single provision regardless of how many callers race.
   */
  private bootstrapInFlight: Promise<{ user: User; accessToken: string } | null> | null = null;

  constructor(private readonly authRepository: IAuthRepository) {}

  async register(payload: RegisterPayload): Promise<User> {
    return this.authRepository.register(payload);
  }

  async login(payload: LoginPayload): Promise<{ user: User; tokens: AuthTokens }> {
    const tokens = await this.authRepository.login(payload);
    await this.storeTokens(tokens);
    const user = await this.establishUser();
    return { user, tokens };
  }

  /**
   * Runs the full social login through the system browser (loopback flow),
   * stores the session, and returns the authenticated user.
   */
  async loginWithSocial(connection: string): Promise<{ user: User; tokens: AuthTokens }> {
    const tokens = await this.authRepository.loginWithSocial(connection);
    await this.storeTokens(tokens);
    const user = await this.establishUser();
    return { user, tokens };
  }

  /**
   * Restores the session on app start. First tries the in-memory access token
   * (survives a same-session reload). If that's gone (a fresh launch — the token
   * lives in sessionStorage) it falls back to a refresh token persisted in the
   * OS keychain, silently exchanging it for a new access token (pragna2-tracker TD-009). Returns
   * `null` (sign-in required) when neither path yields a valid session.
   *
   * Single-flight: concurrent calls (StrictMode's dev double-invoke, or any
   * future re-trigger) share one in-flight run so the refresh + provision happen
   * exactly once. See {@link bootstrapInFlight}.
   */
  bootstrap(): Promise<{ user: User; accessToken: string } | null> {
    if (this.bootstrapInFlight) return this.bootstrapInFlight;
    this.bootstrapInFlight = this.runBootstrap().finally(() => {
      this.bootstrapInFlight = null;
    });
    return this.bootstrapInFlight;
  }

  private async runBootstrap(): Promise<{ user: User; accessToken: string } | null> {
    const accessToken = tokenStorage.getAccessToken();
    if (accessToken) {
      try {
        const user = await this.establishUser();
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
      const user = await this.establishUser();
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

  /**
   * Resolve the current user, provisioning the account in the backend first when
   * an OIDC ID token is present. The ID token carries the email the BE needs to
   * CREATE the account on first login (the access token does not). Idempotent.
   * Falls back to a plain profile read for non-OIDC (local) sessions.
   */
  private async establishUser(): Promise<User> {
    const idToken = tokenStorage.getIdToken();
    if (idToken) return this.authRepository.provisionOAuthUser(idToken);
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
