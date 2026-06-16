# Feature Spec: Login / Authentication

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Overview

The Login / Authentication feature lets a user sign in to the Pragna desktop app and obtain a session that gates access to the rest of the application. It supports two sign-in methods backed by Auth0: email/password (Auth0 Resource Owner Password Grant, ROPG) and social/enterprise sign-in conducted in the user's **system browser** with the redirect captured on a temporary **localhost loopback** server (RFC 8252 native-app flow). It also covers self-service registration, automatic session bootstrap/persistence across reloads, route gating (protected vs guest-only), and sign-out. On successful authentication the user lands on `/chat` (the post-login landing).

## 2. Goals & Non-Goals

**Goals**
- [x] Email/password sign-in via Auth0 ROPG.
- [x] Social/enterprise sign-in via the system browser + localhost loopback redirect (RFC 8252), with a branded "Signed in" callback page.
- [x] Dynamic discovery of which social connections are enabled on the tenant (no hardcoded provider list in UI).
- [x] Self-service registration (Auth0 database connection signup), followed by an automatic sign-in.
- [x] Session bootstrap on app start, persistence across in-tab reloads, and across full app restarts via a keychain-stored refresh token (pragna2-tracker TD-009).
- [x] Protected routes (require auth) and guest-only routes (redirect away when authed); post-login landing is `/chat`.
- [x] Sign-out that clears the session locally.
- [x] Typed, catalogued error handling (`AUTH_001`..`AUTH_010`).

**Non-Goals**
- **Mid-session** silent refresh: on a `401` during use the user re-authenticates. (Refresh runs at **app start** — see below — but the axios interceptor doesn't transparently refresh-and-retry a failed call.)
- An in-app webview OAuth flow or an in-app OAuth callback route. Social sign-in always uses the external system browser + loopback server.
- Password reset / forgot-password, email verification, and MFA enrollment UI (handled by Auth0 directly; no in-app screens).
- Server-side session management or cookies.

**Cross-restart session (pragna2-tracker TD-009, implemented):** when Auth0 issues a refresh
token (`offline_access`), it is stored in the **OS keychain** (macOS Keychain /
Windows Credential Manager via the `keyring` crate). On app start, if no
in-memory access token exists, `bootstrap()` exchanges the stored refresh token
for a fresh access token — so the user stays signed in across restarts. Requires
the Auth0 app/API to be configured to issue refresh tokens; absent that, it
degrades to sign-in-each-launch.

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| user | sign in with my email and password | I can access the app without a social account |
| user | sign in with Google / GitHub / Microsoft / etc. in my normal browser | my existing SSO sessions and account chooser are available |
| new user | create an account with email + password | I can start using the app |
| returning user | stay signed in after reloading the window | I don't have to log in on every refresh |
| signed-in user | be sent straight to `/chat` instead of the login page | I don't see the login screen when I'm already authenticated |
| signed-out user | be redirected to `/login` when I open a protected page | I can't reach app screens without a session |
| user | sign out | I can end my session on a shared machine |

## 4. Acceptance Criteria

- [x] Given valid credentials on `/login`, when the user submits, then ROPG returns tokens, the profile is resolved, the auth store flips to authenticated, and the guard redirects to `/chat`.
- [x] Given invalid credentials, when the user submits, then the form shows the `AUTH_007` message ("Invalid email or password.") and remains on `/login`.
- [x] Given the tenant has social connections enabled, when `/login` (or `/register`) loads, then one "Continue with <Provider>" button is rendered per enabled connection (discovered at runtime via the Auth0 client config script).
- [x] Given the user clicks a social button, when the flow starts, then the system browser opens Auth0's `/authorize` and a loopback server listens on a registered port; on redirect the branded success page is shown and the app exchanges the code (PKCE) for tokens.
- [x] Given the social redirect returns, when the `state` does not match the value sent, then the flow fails with `AUTH_006` and no tokens are stored (CSRF protection).
- [x] Given a new user on `/register` with email + password (≥ 8 chars), when they submit, then the account is created in the Auth0 database connection and they are immediately signed in via ROPG.
- [x] Given a stored access token exists, when the app starts, then `bootstrap()` resolves the profile and the user is treated as authenticated without re-entering credentials.
- [x] Given no stored token, when the app starts, then `bootstrap()` resolves to "not authenticated" and protected routes redirect to `/login`.
- [x] Given an authenticated user, when they visit `/login` or `/register`, then they are redirected to `/chat` (guest-only guard).
- [x] Given any authenticated backend call returns `401`, when the response interceptor sees it, then the session is cleared and the user is sent back to `/login`.
- [x] Given a signed-in user, when they sign out, then the access + ID tokens are cleared from storage and the auth store resets to unauthenticated.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Invalid email/password (ROPG) | `LoginForm` shows `AUTH_007` ("Invalid email or password."); stays on `/login`. |
| Empty email or password | Client-side guard shows "Email and password are required." before any network call. |
| Registration with password < 8 chars | `RegisterView` shows "Password must be at least 8 characters." before any network call. |
| Registration fails (e.g. email already in use) | `RegisterView` shows `AUTH_008` ("Registration failed. This email may already be in use."). |
| Social login outside the Tauri runtime (e.g. plain `pnpm dev` browser) | Loopback flow throws `AUTH_006`; the UI shows the social-login-failed message (loopback requires the desktop runtime). |
| All loopback ports in the pool busy | `start()` fails; throws `AUTH_006` (logged with the attempted ports) — surfaced rather than silently failing. |
| Provider returns an `error` on the redirect (e.g. user denies consent) | Loopback handler rejects with `AUTH_006`. |
| Social login times out (user never finishes in browser) | After 180 s the loopback server tears down and the flow rejects with `AUTH_009` ("Sign-in timed out."). |
| `state` mismatch on the social redirect | Rejected with `AUTH_006` (CSRF guard); no token exchange. |
| Token exchange (authorization_code) fails | `exchangeCodeForTokens` throws `AUTH_010` ("Token exchange failed."). |
| Stray/probe requests hit the loopback server (favicon, etc.) | Ignored (no `code`/`state` → keep waiting); only an explicit provider `error` or timeout fails the flow. |
| Stored token present but profile cannot be resolved at bootstrap | `bootstrap()` clears storage and resolves to "not authenticated" (no crash). |
| `me()` has no usable ID token and no access token | Throws `AUTH_001` ("No active session. Please sign in."). |
| Authenticated backend call returns `401` | Session cleared, user redirected to `/login` (no silent refresh). |
| Window reload mid-session | Token persists in `sessionStorage`; bootstrap restores the session within the same tab. |
| Full app restart | The keychain refresh token is exchanged for a fresh access token at bootstrap; the user stays signed in (pragna2-tracker TD-009). Falls back to sign-in when no refresh token is stored or it's expired. |

## 6. Out of Scope

- **Mid-session** silent refresh-and-retry on a `401` (startup refresh is in scope and implemented).
- Password reset, forgot-password, email-verification, and MFA UI flows.
- In-app webview OAuth or any in-app OAuth callback route.
- Backend-managed sessions/cookies; the access token is sent as a Bearer header to the Pragna backend only.
- Server-side enforcement of authorization (this spec covers the client gating only).

## 7. Open Questions

- [x] **Session lifetime across restarts.** *(Resolved — pragna2-tracker TD-009.)* The refresh
  token is persisted in the OS keychain (`keyring`) and exchanged at bootstrap,
  so the session survives restarts. Requires the Auth0 app/API to be configured
  to issue refresh tokens (Native app + Refresh Token grant + API "Allow Offline
  Access"); otherwise it degrades to sign-in-each-launch.
- [ ] **Unused error codes.** `AUTH_002` (profile decode), `AUTH_003` (refresh failed), `AUTH_004` (popup blocked), and `AUTH_005` (cancelled) are defined in the catalog but not currently thrown anywhere in the auth flow — confirm whether they are reserved for planned behavior or should be removed.
- [ ] **Loopback port collisions.** The default pool is `8788–8791`; every port must be registered in Auth0 as an Allowed Callback URL. Confirm the production Auth0 app has all four (and any `VITE_OAUTH_LOOPBACK_PORTS` override) registered.
- [ ] **`/register` returns an empty `id`.** The repository's `register()` returns a `User` with `id: ''` before the follow-up ROPG sign-in repopulates the profile — confirm no consumer relies on the id between those two steps.

---

_Link to Technical Spec: [technical/login.md](../technical/login.md)_
