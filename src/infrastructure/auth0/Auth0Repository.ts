import type { AxiosInstance } from 'axios';
// Native (Rust) HTTP client — the direct Auth0 calls must not go through the
// webview's `fetch`, which the browser blocks with CORS (Auth0 doesn't send
// Access-Control-Allow-Origin for the app origin). tauri-plugin-http runs the
// request natively, so CORS never applies; works the same in dev and prod.
import { fetch as httpFetch } from '@tauri-apps/plugin-http';
import type { IAuthRepository } from '@/application/ports/IAuthRepository';
import type { IExternalAuthorizationFlow } from '@/application/ports/IExternalAuthorizationFlow';
import type {
  AuthTokens,
  LoginPayload,
  RegisterPayload,
  SocialConnection,
  UpdateSettingsPayload,
  User,
} from '@/domain/types/auth.types';
import { userFromIdToken } from '@/domain/utils/parseJwt';
import { tokenStorage } from '@/infrastructure/storage/tokenStorage';
import { ERRORS } from '@/constants/errors';
import { PragnaError } from '@/domain/errors/PragnaError';
import {
  AUTH0_AUDIENCE,
  AUTH0_CLIENT_ID,
  AUTH0_DB_CONNECTION,
  AUTH0_DOMAIN,
  AUTH0_SCOPE,
  SOCIAL_DISPLAY_NAMES,
  SOCIAL_STRATEGIES,
} from '@/constants/auth0';
import { generateCodeChallenge, generateCodeVerifier } from './auth0Pkce';

interface Auth0ClientConfig {
  strategies?: Array<{ name: string; connections: Array<{ name: string }> }>;
  connections?: Array<{ name: string; strategy?: string }>;
}

interface Auth0TokenResponse {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
}

export class Auth0Repository implements IAuthRepository {
  private readonly domain   = AUTH0_DOMAIN;
  private readonly clientId = AUTH0_CLIENT_ID;
  private readonly audience = AUTH0_AUDIENCE;
  private readonly dbConn   = AUTH0_DB_CONNECTION;

  /**
   * @param http      shared axios client (used for backend `/auth/*` calls).
   * @param authFlow  external-browser authorization flow (loopback on desktop).
   */
  constructor(
    private readonly http: AxiosInstance,
    private readonly authFlow: IExternalAuthorizationFlow,
  ) {}

  // ── Register ──────────────────────────────────────────────────────────────

  async register(payload: RegisterPayload): Promise<User> {
    const res = await httpFetch(`https://${this.domain}/dbconnections/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:  this.clientId,
        connection: this.dbConn,
        email:      payload.email,
        password:   payload.password,
        ...(payload.name ? { given_name: payload.name } : {}),
      }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error((b as { description?: string }).description ?? 'Registration failed');
    }
    return { id: '', email: payload.email, name: payload.name ?? null, identityProvider: 'auth0', settings: {} };
  }

  // ── Email / Password (ROPG) ───────────────────────────────────────────────

  async login(payload: LoginPayload): Promise<AuthTokens> {
    const res = await httpFetch(`https://${this.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'password',
        client_id:  this.clientId,
        username:   payload.email,
        password:   payload.password,
        audience:   this.audience,
        scope:      AUTH0_SCOPE,
      }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error((b as { error_description?: string }).error_description ?? 'Login failed');
    }
    const data = (await res.json()) as Auth0TokenResponse;
    return {
      accessToken: data.access_token,
      idToken: data.id_token,
      refreshToken: data.refresh_token,
    };
  }

  // ── Refresh — exchange a refresh token for a fresh access token ───────────
  // Public-client refresh (no secret). With rotation on, Auth0 returns a NEW
  // refresh token each time; we echo the old one back when it doesn't, so the
  // caller always has a token to persist.

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const res = await httpFetch(`https://${this.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) throw new PragnaError(ERRORS.AUTH_011);
    const data = (await res.json()) as Auth0TokenResponse;
    return {
      accessToken: data.access_token,
      idToken: data.id_token,
      refreshToken: data.refresh_token ?? refreshToken,
    };
  }

  // ── Social login — system browser + loopback redirect (RFC 8252) ──────────
  // Opens the system browser to Auth0's /authorize, captures the redirect on a
  // localhost loopback server, validates state (CSRF), then exchanges the code
  // for tokens with the PKCE verifier. One continuous flow — no SPA callback route.

  async loginWithSocial(connection: string): Promise<AuthTokens> {
    const codeVerifier = generateCodeVerifier();
    const state = crypto.randomUUID();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const { code, state: returnedState, redirectUri } = await this.authFlow.authorize(
      (uri) => this.buildAuthorizeUrl({ connection, redirectUri: uri, state, codeChallenge }),
    );

    if (returnedState !== state) {
      throw new PragnaError(ERRORS.AUTH_006);
    }

    return this.exchangeCodeForTokens(code, codeVerifier, redirectUri);
  }

  private buildAuthorizeUrl(args: {
    connection: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
  }): string {
    const params = new URLSearchParams({
      response_type:         'code',
      client_id:             this.clientId,
      connection:            args.connection,
      redirect_uri:          args.redirectUri,
      scope:                 AUTH0_SCOPE,
      audience:              this.audience,
      state:                 args.state,
      code_challenge:        args.codeChallenge,
      code_challenge_method: 'S256',
    });
    return `https://${this.domain}/authorize?${params.toString()}`;
  }

  private async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<AuthTokens> {
    const res = await httpFetch(`https://${this.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type:    'authorization_code',
        client_id:     this.clientId,
        code,
        code_verifier: codeVerifier,
        redirect_uri:  redirectUri,
      }),
    });
    if (!res.ok) throw new PragnaError(ERRORS.AUTH_010);
    const data = (await res.json()) as Auth0TokenResponse;
    return {
      accessToken: data.access_token,
      idToken: data.id_token,
      refreshToken: data.refresh_token,
    };
  }

  // ── Social connections — JSONP (no CORS issues) ───────────────────────────

  fetchSocialConnections(): Promise<SocialConnection[]> {
    return new Promise<SocialConnection[]>((resolve) => {
      const script = document.createElement('script');
      const prev = (window as unknown as Record<string, unknown>).Auth0;
      (window as unknown as Record<string, unknown>).Auth0 = {
        setClient: (config: Auth0ClientConfig) => {
          (window as unknown as Record<string, unknown>).Auth0 = prev;
          script.remove();
          resolve(this.parseSocialConnections(config));
        },
      };
      script.src = `https://${this.domain}/client/${this.clientId}.js`;
      script.onerror = () => { (window as unknown as Record<string, unknown>).Auth0 = prev; script.remove(); resolve([]); };
      document.head.appendChild(script);
    });
  }

  private parseSocialConnections(config: Auth0ClientConfig): SocialConnection[] {
    if (config.strategies?.length) {
      return config.strategies
        .filter((s) => SOCIAL_STRATEGIES.has(s.name))
        .flatMap((s) => s.connections.map((c) => ({
          name: c.name, strategy: s.name, displayName: SOCIAL_DISPLAY_NAMES[s.name] ?? s.name,
        })));
    }
    if (config.connections?.length) {
      return config.connections
        .filter((c) => SOCIAL_STRATEGIES.has(c.strategy ?? c.name))
        .map((c) => {
          const strategy = c.strategy ?? c.name;
          return { name: c.name, strategy, displayName: SOCIAL_DISPLAY_NAMES[strategy] ?? strategy };
        });
    }
    return [];
  }

  // ── User profile ──────────────────────────────────────────────────────────
  // Decode from the stored ID token (no network). Fall back to Auth0's
  // /userinfo endpoint using the access token — covers the case where the
  // token exchange did not include an id_token.

  async provisionOAuthUser(idToken: string): Promise<User> {
    // Provision (or fetch) the user in the BACKEND from the ID token's email.
    // The access token is attached by the http interceptor; the BE binds the two
    // by a matching `sub`. This creates the account on first login — the BE
    // cannot get an email from the access token alone.
    const { data } = await this.http.post<{
      id: string;
      email: string;
      name: string | null;
      identity_provider: string;
    }>('/auth/oauth-users', { id_token: idToken });
    return {
      id:               data.id,
      email:            data.email,
      name:             data.name,
      identityProvider: data.identity_provider,
      settings:         {},
    };
  }

  async me(): Promise<User> {
    const idToken = tokenStorage.getIdToken();
    if (idToken) {
      const user = userFromIdToken(idToken);
      if (user) return user;
    }
    const accessToken = tokenStorage.getAccessToken();
    if (!accessToken) throw new PragnaError(ERRORS.AUTH_001);
    return this.fetchUserInfo(accessToken);
  }

  private async fetchUserInfo(accessToken: string): Promise<User> {
    const res = await httpFetch(`https://${this.domain}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new PragnaError(ERRORS.AUTH_001);
    const d = await res.json() as Record<string, unknown>;
    const sub = (d.sub as string) ?? '';
    return {
      id:               sub,
      email:            (d.email as string | undefined) ?? '',
      name:             (d.name as string | undefined) ?? (d.nickname as string | undefined) ?? null,
      identityProvider: sub.split('|')[0],
      settings:         {},
    };
  }

  async updateSettings(payload: UpdateSettingsPayload): Promise<User> {
    await this.http.patch('/auth/me/settings', { settings: payload.settings });
    return this.me();
  }
}
