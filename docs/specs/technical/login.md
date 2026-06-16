# Technical Spec: Login / Authentication

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Overview

Authentication is implemented in the frontend (React + TypeScript) following Clean Architecture, with a small amount of Tauri/Rust configuration to enable the native flows. The application layer defines two ports — `IAuthRepository` (the auth use cases the UI depends on) and `IExternalAuthorizationFlow` (an abstract OAuth-in-external-browser flow) — and a thin `AuthService` facade. The infrastructure layer provides `Auth0Repository` (the concrete Auth0 integration) and `TauriLoopbackAuthFlow` (the RFC 8252 loopback implementation injected into the repository). Email/password sign-in uses Auth0's **Resource Owner Password Grant** (ROPG); social/enterprise sign-in uses **authorization code + PKCE** through the **system browser**, with the redirect captured on a temporary localhost server started by `tauri-plugin-oauth`. All direct Auth0 HTTP calls (signup, ROPG, token exchange, `/userinfo`) and all Pragna-backend calls run through Tauri's **native HTTP** plugin, so the webview's CORS policy never applies. Session state lives in a Zustand store (`authStore`), is bootstrapped on app start from a `sessionStorage` token — or, on a fresh launch, from a refresh token kept in the OS keychain (macOS Keychain / Windows Credential Manager via the Rust `keyring` crate + `secure_store_*` Tauri commands, wrapped by `secureStore.ts`) exchanged through `Auth0Repository.refresh()` (pragna2-tracker TD-009) — and gates routing through `ProtectedRoute` / `GuestOnlyRoute`.

## 2. Architecture & Layer Placement

- **Domain**: Type-only models in `src/domain/types/auth.types.ts` (`User`, `UserSettings`, `AuthTokens`, `LoginPayload`, `RegisterPayload`, `UpdateSettingsPayload`, `SocialConnection`). Error catalog entry type `PragnaError` (`src/domain/errors/PragnaError.ts`) carries an `AUTH_*` code. JWT helper `userFromIdToken` / `decodeJwtPayload` in `src/domain/utils/parseJwt.ts`. No domain behavior beyond pure functions.
- **Application**: Ports `IAuthRepository` (`src/application/ports/IAuthRepository.ts`) and `IExternalAuthorizationFlow` (`src/application/ports/IExternalAuthorizationFlow.ts`, with `AuthorizationResult`). Facade `AuthService` (`src/application/services/AuthService.ts`) orchestrates repository calls + token storage + profile fetch. Depends only on domain types and ports.
- **Adapters (infrastructure + presentation)**:
  - Infrastructure: `Auth0Repository` (implements `IAuthRepository`), `TauriLoopbackAuthFlow` (implements `IExternalAuthorizationFlow`), `auth0Pkce.ts` (PKCE verifier/challenge), `tokenStorage` (sessionStorage), the axios client + `tauriHttpAdapter` + `applyAuthInterceptor` + `applyCorrelationInterceptor`.
  - Presentation: `LoginView` / `RegisterView` / `SocialLoginButton` / `LoginForm`; hooks `useAuth`, `useBootstrap`, `useAuth0Connections`; store `authStore`; guards `ProtectedRoute` / `GuestOnlyRoute`; routing in `AppRoutes`. DI wiring in `ServiceProvider` (`new TauriLoopbackAuthFlow()` → `new Auth0Repository(axiosClient, authFlow)` → `new AuthService(authRepo)`), exposed via `ServiceContext`.
  - Rust/Tauri: `src-tauri/src/lib.rs` registers `tauri_plugin_opener`, `tauri_plugin_oauth`, `tauri_plugin_http`; capabilities in `src-tauri/capabilities/default.json`.

## 3. Data Flow

```
Email/password sign-in:
LoginForm.handleSubmit -> useAuth.login(LoginPayload)
  -> AuthService.login -> Auth0Repository.login: POST https://{domain}/oauth/token (grant_type=password)
  -> AuthService stores tokens (sessionStorage) -> Auth0Repository.me() (decode id_token or GET /userinfo)
  -> authStore.setAccessToken + setUser -> GuestOnlyRoute redirects to /settings

Social sign-in (RFC 8252 loopback + PKCE):
SocialLoginButton.onClick -> useAuth.loginWithSocial(connection)
  -> AuthService.loginWithSocial -> Auth0Repository.loginWithSocial:
       generate verifier + state + challenge
    -> IExternalAuthorizationFlow.authorize(buildAuthorizeUrl)
         [TauriLoopbackAuthFlow] start({ports, response: SUCCESS_HTML}) -> bind free port
           -> openUrl(/authorize) in SYSTEM browser
           -> onUrl captures redirect -> resolve {code, state, redirectUri}
    -> validate state === returnedState (else AUTH_006)
    -> exchangeCodeForTokens: POST /oauth/token (grant_type=authorization_code, code_verifier, redirect_uri)
  -> AuthService stores tokens -> me() -> authStore flips -> guard redirects to /settings

Registration:
RegisterView.handleSubmit -> AuthService.register -> Auth0Repository.register: POST /dbconnections/signup
  -> then useAuth.login({email,password}) (ROPG) -> same as email/password flow

Bootstrap (app start):
useBootstrap (effect) -> AuthService.bootstrap()
  -> tokenStorage.getAccessToken(); if none -> null
  -> Auth0Repository.me(); on success -> {user, accessToken}; on error -> clearAll() + null
  -> authStore.setAccessToken/setUser + setBootstrapped(true)

Backend calls (authenticated):
axiosClient (adapter: tauriHttpAdapter)
  request: applyCorrelationInterceptor (X-Correlation-ID) + applyAuthInterceptor (Bearer access token)
  response: on 401 -> tokenStorage.clearAll() + onLogout() -> /login
```

## 4. Module & File Layout

```
src/
  domain/
    types/auth.types.ts                         User, AuthTokens, *Payload, SocialConnection
    errors/PragnaError.ts                        coded error wrapper + isPragnaError
    utils/parseJwt.ts                            decodeJwtPayload, userFromIdToken, isTokenExpired
  application/
    ports/IAuthRepository.ts                     auth use-case port
    ports/IExternalAuthorizationFlow.ts          external-browser OAuth port + AuthorizationResult
    services/AuthService.ts                      facade orchestrating repo + token storage + profile
  infrastructure/
    auth0/Auth0Repository.ts                     Auth0 integration (ROPG, signup, code exchange, userinfo, connections)
    auth0/tauriLoopbackAuthFlow.ts               RFC 8252 loopback flow + branded SUCCESS_HTML
    auth0/auth0Pkce.ts                           generateCodeVerifier / generateCodeChallenge
    storage/tokenStorage.ts                      sessionStorage access/id token
    http/axiosClient.ts                          axios instance; native adapter when in Tauri
    http/tauriHttpAdapter.ts                     AxiosAdapter over @tauri-apps/plugin-http
    http/authInterceptor.ts                      Bearer request + 401 response handling
    http/correlationInterceptor.ts               X-Correlation-ID request header
  presentation/
    views/auth/LoginView.tsx                     login shell
    views/auth/RegisterView.tsx                  register page
    views/auth/SocialLoginButton.tsx             provider button + brand icons
    components/auth/LoginForm.tsx                login card (form + social + register link)
    hooks/auth/useAuth.ts                         login / loginWithSocial / logout + store reads
    hooks/auth/useBootstrap.ts                    one-shot session restore on app start
    hooks/auth/useAuth0Connections.ts             TanStack Query for enabled social connections
    store/authStore.ts                           Zustand auth state
    router/AppRoutes.tsx                          route table (guest-only vs protected)
    router/ProtectedRoute.tsx                     redirect unauth -> /login
    router/GuestOnlyRoute.tsx                     redirect auth -> /settings
    providers/ServiceProvider.tsx                DI wiring of the auth stack
  constants/
    auth0.ts                                     Auth0 env + scope + loopback pool + social maps
    errors.ts                                    AUTH_001..AUTH_010 catalog
    routes.ts                                    ROUTES (LOGIN, REGISTER, SETTINGS, ...)
src-tauri/
  src/lib.rs                                     registers oauth/http/opener plugins
  capabilities/default.json                      oauth + http permissions / allow-list
```

## 5. Method Specifications

### `AuthService`

#### `login(payload: LoginPayload) -> Promise<{ user: User; tokens: AuthTokens }>`

| Field | Detail |
|-------|--------|
| **Purpose** | Email/password sign-in: obtain tokens via ROPG, persist them, resolve the profile. |
| **Inputs** | `payload: LoginPayload` — `{ email, password }`. |
| **Output** | `{ user, tokens }` — resolved profile and `{ accessToken, idToken? }`. |
| **Errors** | Propagates `Error` from `Auth0Repository.login` (rejected ROPG); `AUTH_001` from `me()` if profile unresolved. |
| **Side Effects** | Writes access + (optional) id token to `sessionStorage`. |
| **Invariants** | Tokens stored before `me()` is called (so `/userinfo` can authenticate). |

#### `loginWithSocial(connection: string) -> Promise<{ user: User; tokens: AuthTokens }>`

| Field | Detail |
|-------|--------|
| **Purpose** | Run the full system-browser loopback social login, persist tokens, resolve the profile. |
| **Inputs** | `connection: string` — Auth0 connection name (e.g. `google-oauth2`). |
| **Output** | `{ user, tokens }`. |
| **Errors** | Propagates `AUTH_006` / `AUTH_009` / `AUTH_010` from the repository/flow. |
| **Side Effects** | Opens the system browser; starts/stops a loopback server; writes tokens to `sessionStorage`. |
| **Invariants** | `state` is validated before token exchange. |

#### `register(payload: RegisterPayload) -> Promise<User>`

| Field | Detail |
|-------|--------|
| **Purpose** | Create an account in the Auth0 database connection. |
| **Inputs** | `payload: RegisterPayload` — `{ email, password, name? }`. |
| **Output** | `User` (note: `id` is empty until a subsequent sign-in resolves the profile). |
| **Errors** | Propagates `Error` from `Auth0Repository.register` (non-OK signup). |
| **Side Effects** | None (does not store tokens; caller follows with `login`). |
| **Invariants** | No session is established by this call alone. |

#### `bootstrap() -> Promise<{ user: User; accessToken: string } | null>`

| Field | Detail |
|-------|--------|
| **Purpose** | Restore a session on app start. (1) If a `sessionStorage` access token exists, resolve `me()`. (2) Else fall back to a keychain-stored **refresh token** — `authRepository.refresh()` for a fresh access token, persist, resolve `me()` (pragna2-tracker TD-009). |
| **Inputs** | None. |
| **Output** | `{ user, accessToken }` if a valid session is restored (via token or refresh); `null` otherwise. |
| **Errors** | Swallows `me()`/`refresh()` failures: clears storage (and the keychain refresh token when refresh fails) and returns `null` (no throw). |
| **Side Effects** | On token failure, `tokenStorage.clearAll()` then attempts refresh; on refresh failure, also `secureStore.clearRefreshToken()`. On success, persists the (possibly rotated) tokens. |
| **Invariants** | Returns `null` (never throws) so the bootstrap effect always completes. |

#### `refresh(refreshToken) -> Promise<AuthTokens>` (`IAuthRepository`/`Auth0Repository`)

| Field | Detail |
|-------|--------|
| **Purpose** | Exchange a refresh token for fresh tokens (Auth0 `grant_type=refresh_token`, public client). |
| **Output** | New `AuthTokens`; `refreshToken` is the rotated one when rotation is on, else the input echoed back. |
| **Errors** | Throws `PragnaError(AUTH_011)` on non-2xx (invalid/expired refresh token). |

#### `fetchSocialConnections() -> Promise<SocialConnection[]>`

| Field | Detail |
|-------|--------|
| **Purpose** | List the tenant's enabled social/enterprise connections for the UI. |
| **Inputs** | None. |
| **Output** | `SocialConnection[]` (possibly empty). |
| **Errors** | None surfaced — repository resolves `[]` on script load failure. |
| **Side Effects** | Delegates to the repository's JSONP client-config load. |
| **Invariants** | Never rejects. |

#### `me() -> Promise<User>` / `updateSettings(payload: UpdateSettingsPayload) -> Promise<User>`

| Field | Detail |
|-------|--------|
| **Purpose** | Resolve the current profile; persist user settings then re-resolve. |
| **Inputs** | `updateSettings`: `{ settings: UserSettings }`. |
| **Output** | `User`. |
| **Errors** | `me()` → `AUTH_001` when no token / `/userinfo` fails; `updateSettings` → axios error (incl. `401` handling) from `PATCH /auth/me/settings`. |
| **Side Effects** | `updateSettings` issues a backend `PATCH`. |
| **Invariants** | `updateSettings` reflects the persisted settings by calling `me()` afterward. |

#### `logout() -> void`

| Field | Detail |
|-------|--------|
| **Purpose** | End the local session. |
| **Inputs** / **Output** | None / `void`. |
| **Side Effects** | `tokenStorage.clearAll()`. No network call (no Auth0 logout round-trip). |

### `Auth0Repository` (implements `IAuthRepository`)

#### `login(payload) -> Promise<AuthTokens>`

| Field | Detail |
|-------|--------|
| **Purpose** | ROPG sign-in. |
| **Inputs** | `LoginPayload`. |
| **Output** | `AuthTokens` from `access_token` / `id_token`. |
| **Errors** | Throws `Error(error_description)` when `POST /oauth/token` (grant_type=password) is non-OK. |
| **Side Effects** | Native HTTP `POST https://{domain}/oauth/token` with `audience` + `scope`. |
| **Invariants** | Sends `client_id` (public SPA id), no client secret. |

#### `loginWithSocial(connection) -> Promise<AuthTokens>`

| Field | Detail |
|-------|--------|
| **Purpose** | Authorization-code + PKCE social login via the injected external flow. |
| **Inputs** | `connection: string`. |
| **Output** | `AuthTokens`. |
| **Errors** | `AUTH_006` on `state` mismatch; `AUTH_010` on token-exchange failure; `AUTH_006` / `AUTH_009` propagate from the flow. |
| **Side Effects** | Drives `authFlow.authorize`; performs the token exchange. |
| **Invariants** | A fresh `code_verifier` and random `state` per attempt; `state` validated before exchange. |

#### `buildAuthorizeUrl(args) -> string` (private)

| Field | Detail |
|-------|--------|
| **Purpose** | Build the Auth0 `/authorize` URL for the loopback redirect URI. |
| **Inputs** | `{ connection, redirectUri, state, codeChallenge }`. |
| **Output** | URL string with `response_type=code`, `code_challenge_method=S256`, `audience`, `scope`. |
| **Invariants** | `redirect_uri` is the exact loopback URI bound by the flow. |

#### `exchangeCodeForTokens(code, codeVerifier, redirectUri) -> Promise<AuthTokens>` (private)

| Field | Detail |
|-------|--------|
| **Purpose** | Exchange the authorization code for tokens. |
| **Inputs** | `code`, `codeVerifier`, `redirectUri` (must match the authorize step). |
| **Output** | `AuthTokens`. |
| **Errors** | `AUTH_010` when `POST /oauth/token` (grant_type=authorization_code) is non-OK. |
| **Side Effects** | Native HTTP `POST`. |
| **Invariants** | Sends `code_verifier` (PKCE) and the same `redirect_uri` used to authorize. |

#### `register(payload) -> Promise<User>`

| Field | Detail |
|-------|--------|
| **Purpose** | Auth0 database-connection signup. |
| **Inputs** | `RegisterPayload`. |
| **Output** | `User` with `id: ''`, `identityProvider: 'auth0'` (placeholder until sign-in). |
| **Errors** | Throws `Error(description)` when `POST /dbconnections/signup` is non-OK. |
| **Side Effects** | Native HTTP `POST`. |

#### `fetchSocialConnections() -> Promise<SocialConnection[]>`

| Field | Detail |
|-------|--------|
| **Purpose** | Load the public Auth0 client config script (`/client/{clientId}.js`) and parse enabled social strategies. |
| **Inputs** | None. |
| **Output** | `SocialConnection[]` filtered to `SOCIAL_STRATEGIES`, labelled via `SOCIAL_DISPLAY_NAMES`. |
| **Errors** | None — resolves `[]` on `script.onerror`. |
| **Side Effects** | Injects (and removes) a `<script>`; temporarily sets `window.Auth0`. Uses JSONP because the config endpoint is not CORS-enabled. |
| **Invariants** | Restores any pre-existing `window.Auth0` after parsing. |

#### `me() -> Promise<User>` / `fetchUserInfo(accessToken) -> Promise<User>` (private)

| Field | Detail |
|-------|--------|
| **Purpose** | Resolve the profile from the stored ID token if present; otherwise fall back to Auth0 `/userinfo`. |
| **Inputs** | `me()`: none; `fetchUserInfo`: `accessToken`. |
| **Output** | `User` (`identityProvider` derived from the `sub` prefix). |
| **Errors** | `AUTH_001` when no access token and no usable ID token, or `/userinfo` non-OK. |
| **Side Effects** | `/userinfo` only when no usable ID token. |

#### `updateSettings(payload) -> Promise<User>`

| Field | Detail |
|-------|--------|
| **Purpose** | Persist user settings to the backend then re-resolve the profile. |
| **Inputs** | `{ settings }`. |
| **Output** | `User`. |
| **Errors** | Axios error from `PATCH /auth/me/settings` (subject to the `401` interceptor). |
| **Side Effects** | Backend `PATCH` through the shared axios client. |

### `TauriLoopbackAuthFlow` (implements `IExternalAuthorizationFlow`)

#### `authorize(buildAuthorizeUrl: (redirectUri: string) => string) -> Promise<AuthorizationResult>`

| Field | Detail |
|-------|--------|
| **Purpose** | RFC 8252 native-app flow: bind a loopback port, open the system browser at `/authorize`, capture the redirect, return `{code, state, redirectUri}`. |
| **Inputs** | `buildAuthorizeUrl(redirectUri)` — builds the provider URL once the port (hence redirect URI) is known. |
| **Output** | `AuthorizationResult` — `{ code, state, redirectUri }`. |
| **Errors** | `AUTH_006` when not in the Tauri runtime, no free port, browser-open failure, or a provider `error` param; `AUTH_009` on the 180 s timeout. |
| **Side Effects** | `start({ ports, response: SUCCESS_HTML })` (binds a free port from `AUTH0_LOOPBACK_PORTS` and serves the branded page); `openUrl(...)`; `cancel(port)` in `finally`. |
| **Invariants** | Ignores stray requests lacking `code`+`state`; only the bound port's redirect resolves; server is always torn down. |

### `authStore` (Zustand `useAuthStore`)

| Member | Detail |
|--------|--------|
| `user / accessToken / bootstrapped / isAuthenticated` | State. `isAuthenticated` is derived: set `true` iff `setUser(user)` receives a non-null user. |
| `setUser(user)` | Sets `user` and `isAuthenticated = user !== null`. |
| `setAccessToken(token)` | Sets the in-memory access token (the source of truth for storage is `tokenStorage`). |
| `setBootstrapped(value)` | Marks bootstrap complete so guards stop rendering `null`. |
| `reset()` | Clears user/token, sets `isAuthenticated=false`, keeps `bootstrapped=true` (used on logout). |

### `useAuth()` (hook)

| Member | Detail |
|--------|--------|
| `login(payload)` | Calls `AuthService.login`, then `setAccessToken` + `setUser`. |
| `loginWithSocial(connection)` | Calls `AuthService.loginWithSocial`, then `setAccessToken` + `setUser`. |
| `logout()` | Calls `AuthService.logout()`, `tokenStorage.clearAll()`, and `authStore.reset()`. |
| `user / isAuthenticated / bootstrapped` | Re-exposed store reads for components. |

### `useBootstrap()` / `useAuth0Connections()`

| Hook | Detail |
|------|--------|
| `useBootstrap()` | One-shot effect: if not already `bootstrapped`, calls `AuthService.bootstrap()`, applies the result to the store, and always sets `bootstrapped=true` in `finally`. |
| `useAuth0Connections()` | TanStack Query `['auth0-connections']` → `AuthService.fetchSocialConnections()`; `staleTime: Infinity`, `retry: false`. |

### Routing guards

| Guard | Detail |
|-------|--------|
| `ProtectedRoute` | Renders `null` until `bootstrapped`; redirects to `ROUTES.LOGIN` when `!isAuthenticated`; else renders children. |
| `GuestOnlyRoute` | Renders `null` until `bootstrapped`; redirects to `ROUTES.CHAT` (post-login landing) when `isAuthenticated`; else renders children. |

### HTTP interceptors & adapter

| Unit | Detail |
|------|--------|
| `applyAuthInterceptor(client, onLogout)` | Request: attach `Authorization: Bearer <accessToken>` from `tokenStorage`. Response: on a `401` AxiosError, `tokenStorage.clearAll()` + `onLogout()` (→ `/login`). No silent refresh. |
| `applyCorrelationInterceptor(client)` | Request: set `X-Correlation-ID` from `correlationStore` for log correlation. |
| `tauriHttpAdapter` (AxiosAdapter) | Performs requests through `@tauri-apps/plugin-http` (native Rust HTTP) so the webview CORS/same-origin policy never applies. Preserves axios interceptors/transforms; maps non-2xx (per `validateStatus`) to `AxiosError` with `.response` so the `401` handling still fires; drops caller `Content-Type` for multipart so the transport sets the boundary. |
| `axiosClient` | `baseURL = API_BASE_URL`, 15 s timeout; uses `tauriHttpAdapter` when in the Tauri runtime, else the default XHR/fetch adapter (plain `pnpm dev`). |

## 6. Error Handling Strategy

Errors are raised as `PragnaError` carrying an `AUTH_*` catalog code (`code`, `message`, `severity`); UI components map a caught failure to a catalog message for display. Direct Auth0 ROPG/signup failures surface the provider's `error_description`/`description` as a plain `Error` (the UI substitutes the catalog message). Backend `401`s are intercepted globally and converted into a forced re-login rather than thrown to call sites.

| Error | Layer | When it occurs / Propagation |
|-------|-------|------------------------------|
| `AUTH_001` | Infrastructure (`Auth0Repository.me`/`fetchUserInfo`) | No active session / `/userinfo` failed. Surfaces to `bootstrap()` (→ clears storage, returns `null`) or to the caller. |
| `AUTH_006` | Infrastructure (`Auth0Repository.loginWithSocial`, `TauriLoopbackAuthFlow.authorize`) | Social sign-in failure: `state` mismatch, not-in-Tauri, no free port, browser-open failure, or provider `error`. Shown by `LoginForm`/`RegisterView`. |
| `AUTH_007` | Presentation (`LoginForm`) | Mapped from a rejected ROPG login (invalid credentials). |
| `AUTH_008` | Presentation (`RegisterView`) | Mapped from a rejected signup (e.g. email in use). |
| `AUTH_009` | Infrastructure (`TauriLoopbackAuthFlow`) | 180 s loopback timeout — user never completed browser auth. |
| `AUTH_010` | Infrastructure (`Auth0Repository.exchangeCodeForTokens`) | Authorization-code token exchange failed. |
| `AUTH_002`, `AUTH_003`, `AUTH_004`, `AUTH_005` | (defined, not currently thrown) | Reserved in the catalog; see Open Questions. |
| `401` (no AUTH code) | Infrastructure (`applyAuthInterceptor`) | Expired/invalid session → `tokenStorage.clearAll()` + redirect to `/login`. |

## 7. Configuration & Constants

All Auth0 env reads are centralised in `src/constants/auth0.ts` (no other file touches `import.meta.env` for Auth0). The Auth0 app is a **SPA** type, so there is **no client secret** anywhere in the app; the SPA `clientId` is public by design (PKCE protects the code exchange). Nothing secret is hardcoded or shipped.

| Constant | Source | Description |
|----------|--------|-------------|
| `AUTH0_DOMAIN` | `VITE_AUTH0_DOMAIN` | Auth0 tenant domain (no scheme). |
| `AUTH0_CLIENT_ID` | `VITE_AUTH0_CLIENT_ID` | Public SPA Client ID (no secret). |
| `AUTH0_AUDIENCE` | `VITE_AUTH0_AUDIENCE` | API audience requested in ROPG and `/authorize`. |
| `AUTH0_SCOPE` | code constant (`'openid profile email offline_access'`) | Requested scopes. |
| `AUTH0_DB_CONNECTION` | code constant (`'Username-Password-Authentication'`) | Well-known Auth0 DB connection name (not a deployment var). |
| `AUTH0_LOOPBACK_PORTS` | `VITE_OAUTH_LOOPBACK_PORTS` (default `[8788,8789,8790,8791]`) | Loopback port pool; every port must be a registered Auth0 Allowed Callback URL. |
| `AUTH0_LOOPBACK_PATH` | code constant (`'/callback'`) | Loopback redirect path; `loopbackRedirectUri(port)` builds `http://localhost:{port}/callback`. |
| `AUTH_TIMEOUT_MS` | code constant (`180_000`) in `tauriLoopbackAuthFlow.ts` | Loopback wait before `AUTH_009`. |
| `SOCIAL_STRATEGIES` / `SOCIAL_DISPLAY_NAMES` | code constants | Strategy allow-list + human labels for connection discovery. |
| `API_BASE_URL` | `VITE_API_BASE_URL` (default `http://localhost:8000/api`) | Backend root for `/auth/*` calls. |
| `ERRORS.AUTH_001..AUTH_010` | `src/constants/errors.ts` | Auth error catalog (code/message/severity). |
| `ROUTES.LOGIN/REGISTER/SETTINGS/CHAT` | `src/constants/routes.ts` | Route paths; post-login landing is `/chat`. |

## 8. Testing Plan

> No automated tests for this feature exist in the repo at time of writing; the table below is the intended coverage (all network/Tauri I/O mocked).

| Test | Type | What It Verifies |
|------|------|-----------------|
| `auth_service_login_stores_tokens_then_resolves_user` | unit | `login` stores tokens before calling `me()`. |
| `auth_service_bootstrap_no_token_returns_null` | unit | `bootstrap` returns `null` with no stored token. |
| `auth_service_bootstrap_me_failure_clears_storage` | unit | Failed `me()` clears storage and returns `null`. |
| `repo_login_maps_ropg_failure` | unit | Non-OK `/oauth/token` (password) throws with description. |
| `repo_social_state_mismatch_throws_auth_006` | unit | `state` mismatch rejects with `AUTH_006`, no exchange. |
| `repo_exchange_failure_throws_auth_010` | unit | Non-OK code exchange throws `AUTH_010`. |
| `loopback_timeout_rejects_auth_009` | unit | No redirect within timeout rejects with `AUTH_009`. |
| `loopback_ignores_stray_requests` | unit | Requests without `code`+`state` are ignored. |
| `loopback_not_tauri_rejects_auth_006` | unit | Non-Tauri runtime rejects with `AUTH_006`. |
| `auth_interceptor_401_clears_and_logs_out` | unit | `401` triggers `clearAll()` + `onLogout`. |
| `tauri_adapter_maps_non_2xx_to_axioserror_with_response` | unit | Adapter preserves `.response` so `401` handling fires. |
| `protected_route_redirects_when_unauth` / `guest_only_redirects_when_auth` | unit | Guard redirect behavior post-bootstrap. |

## 9. Dependencies & External Integrations

- **External service**: Auth0 (tenant domain), endpoints `/dbconnections/signup`, `/oauth/token` (ROPG + authorization_code), `/authorize`, `/userinfo`, and the public client-config script `/client/{clientId}.js`. App type: **SPA** (PKCE; no client secret).
- **Tauri plugins (Rust, `src-tauri/src/lib.rs` + `Cargo.toml`)**: `tauri-plugin-oauth` "2" (loopback server for the social redirect), `tauri-plugin-http` "2" (native HTTP for all direct Auth0 + backend calls, bypassing webview CORS), `tauri-plugin-opener` "2" (open the system browser).
- **JS plugins (`package.json`)**: `@fabianlars/tauri-plugin-oauth` "^2.0.0" (`start`/`cancel`/`onUrl`/`onInvalidUrl`), `@tauri-apps/plugin-http` (`fetch`), `@tauri-apps/plugin-opener` (`openUrl`).
- **Frontend libs**: React, React Router (`AppRoutes`, guards), Zustand (`authStore`), TanStack Query (`useAuth0Connections`), axios (client + adapter + interceptors).
- **Tauri capabilities** (`src-tauri/capabilities/default.json`): `oauth:allow-start`, `oauth:allow-cancel` (loopback lifecycle), `opener:default` (open browser), and a scoped `http:default` allow-list — `https://*.auth0.com/*`, `https://*.us.auth0.com/*`, the `*.sgummallaworks.com` API hosts, and `localhost:8000` / `127.0.0.1:8000`. The allow-list is why native HTTP can reach Auth0 and the backend while everything else stays blocked.

## 10. Open Questions / Risks

- [ ] **Unused `AUTH_002`/`AUTH_003`/`AUTH_004`/`AUTH_005`.** Defined in the catalog but never thrown — reserve for planned refresh/popup/cancel handling or prune.
- [x] **Refresh-token usage** *(done — pragna2-tracker TD-009).* The refresh token is now stored
  (OS keychain) and exchanged at bootstrap. **Startup** refresh only — a
  mid-session `401` still logs out (no transparent refresh-and-retry in the axios
  interceptor). **Depends on Auth0 config:** the app/API must issue refresh tokens
  (Native app + Refresh Token grant + API "Allow Offline Access"); otherwise it
  degrades to sign-in-each-launch. Not yet verified against the live tenant.
- [x] **Session persistence** *(done — pragna2-tracker TD-009).* Cross-restart persistence via the
  keychain refresh token (`keyring` → macOS Keychain / Windows Credential Manager).
- [ ] **Loopback port registration.** Every port in the pool (default `8788–8791`, or any `VITE_OAUTH_LOOPBACK_PORTS` override) must be registered as an Auth0 Allowed Callback URL; mismatch causes a silent Auth0-side rejection (surfaced only as `AUTH_006`).
- [ ] **Social login requires the desktop runtime.** Loopback social login cannot work in a plain browser (`pnpm dev`) — it throws `AUTH_006` there; only ROPG works outside Tauri.
- [ ] **No automated tests yet** for the auth stack (see §8).

---

_Link to Feature Spec: [features/login.md](../features/login.md)_
