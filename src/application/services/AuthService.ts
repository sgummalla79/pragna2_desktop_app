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

export class AuthService {
  constructor(private readonly authRepository: IAuthRepository) {}

  async register(payload: RegisterPayload): Promise<User> {
    return this.authRepository.register(payload);
  }

  async login(payload: LoginPayload): Promise<{ user: User; tokens: AuthTokens }> {
    const tokens = await this.authRepository.login(payload);
    this.storeTokens(tokens);
    const user = await this.authRepository.me();
    return { user, tokens };
  }

  /**
   * Runs the full social login through the system browser (loopback flow),
   * stores the session, and returns the authenticated user.
   */
  async loginWithSocial(connection: string): Promise<{ user: User; tokens: AuthTokens }> {
    const tokens = await this.authRepository.loginWithSocial(connection);
    this.storeTokens(tokens);
    const user = await this.authRepository.me();
    return { user, tokens };
  }

  /**
   * Restores the session from the stored access token on page load.
   * No network call to Auth0 — the session token in sessionStorage is the source of truth.
   */
  async bootstrap(): Promise<{ user: User; accessToken: string } | null> {
    const accessToken = tokenStorage.getAccessToken();
    if (!accessToken) return null;

    try {
      const user = await this.authRepository.me();
      return { user, accessToken };
    } catch {
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
  }

  private storeTokens(tokens: AuthTokens): void {
    tokenStorage.setAccessToken(tokens.accessToken);
    if (tokens.idToken) tokenStorage.setIdToken(tokens.idToken);
  }
}
