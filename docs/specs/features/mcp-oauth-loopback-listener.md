# Feature Spec: MCP OAuth loopback listener (pre-registered client)

> **Status**: Draft
> **Author**: Suman Gummalla
> **Created**: 2026-06-17
> **Last Updated**: 2026-06-17
>
> Tracker **#131** (`target:desktop-fe`, `type:feature`) · consumes BE **#130**
> (pre-registered OAuth client: `clientId` / `loginUrl` / `callbackPort`,
> merged on `pragna2-api`). Contract source: pragna2-api
> `docs/architecture/mcp-system.md` § "Pre-registered client config".

---

## 1. Overview

Some MCP servers do not advertise an authorization server for Dynamic Client
Registration; instead they use a **pre-registered OAuth app** with a fixed
**loopback** redirect — `http://localhost:{callbackPort}/callback` (RFC 8252
native-app loopback). Such a connector carries an optional, **generic**
`config.oauth = { clientId, loginUrl, callbackPort }` block. When `callbackPort`
is present, the authorization server redirects the browser to localhost — which
the backend's server-side `GET /oauth-callback` never receives. This feature
adds, **on the desktop client only**, a short-lived loopback HTTP listener that
catches the `code` + `state` at `localhost:{callbackPort}/callback` and POSTs
them to the authenticated `POST /api/mcp-connectors/{id}/oauth-completion`
endpoint, then surfaces success/failure in the connectors UI. It also lets the
connector-create form accept the optional `config.oauth` block so any such
connector can be registered. The implementation is **product-agnostic**: it
keys off the presence of `config.oauth.callbackPort`, never off a server name.

## 2. Goals & Non-Goals

**Goals**
- [ ] Complete an OAuth connect end-to-end on the desktop for a connector whose
      `config.oauth.callbackPort` is set, with no manual "Refresh".
- [ ] Let the connector-create form capture a generic pre-registered OAuth block
      (Client ID, Login URL, Callback port) for `oauth` connectors.
- [ ] Surface success/failure inline at the existing OAuth "Connect" affordance
      (the connector card and the add-connector wizard).
- [ ] Keep the existing browser-redirect OAuth flow (DCR + server-side callback)
      unchanged for connectors **without** `callbackPort`.

**Non-Goals**
- A web-FE (browser) equivalent — a plain browser cannot bind a loopback port;
  the web FE keeps the global server-side callback only. Cross-repo, out of
  scope here (see §6).
- Changing the BE OAuth contract, token storage, or the server-side callback.
- Any server-specific (e.g. Salesforce) preset, default, or code branch.

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| desktop user | register a connector that uses a pre-registered OAuth app (client id + login URL + callback port) | I can connect to servers that don't support automatic client registration |
| desktop user | click "Connect with OAuth" and finish in my browser | the connector becomes connected automatically, without me copying anything back or clicking Refresh |
| desktop user | see a clear message if the connection fails (port busy, timeout, denied) | I know what went wrong and what to do |

## 4. Acceptance Criteria

- [ ] Given an `oauth` connector with `config.oauth.callbackPort`, when I click
      "Connect with OAuth" in the desktop app, then a listener binds that port,
      my browser opens the authorization page, and on approval the connector
      flips to **connected** without a manual Refresh.
- [ ] Given the create form with auth method **OAuth 2.1**, when I expand the
      "Pre-registered OAuth app" section and enter Client ID / Login URL /
      Callback port, then the connector is created with a `config.oauth` block
      carrying exactly those values.
- [ ] Given a connector **without** `config.oauth.callbackPort`, when I connect,
      then the existing browser-redirect flow runs unchanged ("Complete the
      connection in your browser, then Refresh.").
- [ ] Given the loopback port is already in use, when I connect, then I get a
      clear, actionable error and the flow stops (no silent fallback to another
      port — the AS redirect URI is fixed).
- [ ] Given the frontend runs in a plain browser (no Tauri runtime), when a
      `callbackPort` connector would use the loopback path, then the loopback
      path is **not** taken (the UI falls back to the browser-redirect note);
      no Tauri-only API is called at render or click time without a guard.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Loopback port already bound | Clear error ("Port {n} is in use…"); flow aborts; listener torn down. |
| User abandons / times out in browser | After the timeout the listener is torn down and an inline timeout error is shown. |
| AS redirect carries `error=` | Inline error with the provider's reason; listener torn down. |
| Stray requests on the loopback port (favicon/probes) | Ignored — only a request carrying both `code` and `state` resolves the capture. |
| `requires_manual_client` returned (no DCR, no stored client) | Existing manual-client form path is reused; not expected for a correctly-configured pre-registered connector (its `clientId` lives in `config.oauth`). |
| `oauth-completion` rejects (invalid/expired/replayed `state`, token-exchange failure) | Inline error; connector stays not-connected; user can retry. |
| Not in Tauri runtime | Loopback path skipped; browser-redirect note shown; no crash. |
| Partial `config.oauth` on create (some fields blank) | Only a fully-specified block (all three fields present) is sent; otherwise no `config.oauth` is sent (a plain DCR oauth connector). |

## 6. Out of Scope

- Web FE (`pragna2_sgummalla_works`) loopback support — not possible in a plain
  browser; the web FE keeps the server-side callback. A tracker note is filed
  for the web-FE owner per the No-Cross-Repo rule; this repo does not change it.
- Backend changes — #130 already persists the config, builds the correct
  authorization URL, and exposes `oauth-completion`.

## 7. Open Questions

- [ ] Confirmed against the Docker BE with a real pre-registered connector that
      the captured `code`+`state` complete the exchange (the user confirmed
      code+state arrive at `localhost:8082/callback`; end-to-end completion to
      be exercised against the Docker BE before merge).

---

_Link to Technical Spec: [technical/mcp-oauth-loopback-listener.md](../technical/mcp-oauth-loopback-listener.md)_
