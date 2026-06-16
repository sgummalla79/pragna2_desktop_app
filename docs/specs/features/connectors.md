# Feature Spec: Connectors (MCP)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Overview

The Connectors settings page lets a user register and manage per-user **MCP (Model Context Protocol) connectors** — remote MCP servers whose tools become available to the user's agents. A user can add a connector from a curated preset gallery (e.g. Gmail, Tavily, Stripe, DeepWiki) or from a custom URL, choose an authentication method (none / bearer / api_key / custom headers / OAuth 2.1), and then opt individual discovered tools in or out. Connectors can be edited, refreshed (re-run upstream tool discovery), deactivated, or archived. OAuth-type connectors can begin the authorization flow (the system browser opens the authorization URL), but the callback round-trip is not yet wired on desktop — see pragna2-tracker TD-001.

## 2. Goals & Non-Goals

**Goals**
- [x] List the user's registered (non-archived) MCP connectors, each as an expandable card with transport + auth-type badges and an active/inactive toggle.
- [x] Register a connector via a three-step wizard: preset gallery (or "Custom server") → details/auth form → tool selection.
- [x] Support five auth types at registration: `none`, `bearer`, `api_key` (header or query param), `headers` (custom header list), and `oauth`.
- [x] Discover the connector's tools on registration and show a per-tool enable/disable toggle list.
- [x] Edit a connector's mutable fields (name, description, auth method, credentials); URL and transport are read-only after creation.
- [x] Refresh a connector's tools (re-run upstream discovery), surfacing an added/unchanged/archived summary.
- [x] Archive (soft-delete) a connector via a confirm-gated destructive action.
- [x] Begin the OAuth 2.1 connect flow for `oauth` connectors by opening the authorization URL in the system browser, including a manual-client fallback for authorization servers without dynamic client registration.

**Non-Goals**
- Completing the OAuth callback round-trip on desktop (capturing the redirect and finishing the token exchange in-app) — deferred to pragna2-tracker TD-001.
- The local `stdio` MCP transport (only `http` / HTTP-SSE and `streamable_http` are supported).
- Editing a connector's URL or transport after creation (a different URL is a different server — re-add instead).
- Serving the preset gallery from a backend endpoint (currently a curated local catalogue in `connectorPresets.ts`).
- Binding tools to specific agents/flows (this page only governs the user's tool inventory and per-tool enabled flags).

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| user | add a well-known MCP server from a gallery | I don't have to know its URL or auth details up front |
| user | add a custom MCP server by URL | I can connect servers not in the gallery |
| user | choose how the connector authenticates (none/bearer/api key/headers/OAuth) | I can connect both public and credentialed servers |
| user | see the tools a connector exposes and toggle each on/off | I control exactly which tools my agents can use |
| user | edit a connector's name, description, and credentials | I can fix or rotate details without re-adding it |
| user | refresh a connector's tools | I pick up new tools the upstream server added |
| user | deactivate a connector without deleting it | I can temporarily park it |
| user | archive a connector | I can remove it and its stored credentials permanently |
| user | connect an OAuth server | I can use servers that require an authorization handshake |

## 4. Acceptance Criteria

- [x] Given the page loads, when the user has registered connectors, then each renders as a card showing display name, transport badge, auth-type badge, an Active/Inactive toggle, and an "N / M tools enabled" count.
- [x] Given the page loads, when the user has no connectors, then an empty state prompts the user to add one.
- [x] Given the connectors query fails, when the page renders, then the `CON_001` message ("Failed to load connectors.") is shown.
- [x] Given the user clicks "Add connector", when the wizard opens, then it starts on the gallery step listing all presets plus a "Custom server" tile, with a search box filtering by name/blurb.
- [x] Given a preset is chosen, when the details step opens, then the form is pre-filled with the preset's name, URL, transport, auth type, and (for `api_key` presets) the default key name + location.
- [x] Given the details form, when the user submits with `none`/`bearer`/`api_key`/`headers` auth, then the connector is created, its tools are discovered, and the wizard advances to a tool-selection list showing "Discovered N tools".
- [x] Given the details form, when the user submits with `oauth` auth, then the connector is created and the wizard shows a "Connect with OAuth" CTA (plus an "I'll connect later" link) instead of a tool list.
- [x] Given a tool toggle list, when the user checks/unchecks a tool, then its per-user `enabled` flag is updated and both the tools and connectors caches refresh (so the card's enabled count updates).
- [x] Given a connector card, when the user clicks the Active/Inactive pill, then the connector's status flips between `active` and `inactive`.
- [x] Given a connector card, when the user clicks "Refresh tools", then discovery re-runs and a summary "Refreshed: X added, Y unchanged, Z archived." is shown.
- [x] Given a connector card, when the user opens Edit, then name/description/auth/credentials are editable while URL and transport render read-only; credential inputs start blank ("leave blank to keep").
- [x] Given the Edit form, when auth is switched to `none` or `oauth`, then `clearCredentials` is sent so any stored static credentials are wiped.
- [x] Given a connector card, when the user clicks Delete and confirms, then the connector is archived (soft-deleted) and its tools are cascade-disabled.
- [x] Given an `oauth` connector, when the user clicks Connect, then the returned `authorizationUrl` opens in the **system browser** and an inline note instructs the user to complete it there and then Refresh. (The callback is not captured in-app — pragna2-tracker TD-001.)
- [x] Given an `oauth` connector whose authorization server lacks dynamic client registration, when Connect returns `requiresManualClient`, then the card shows fields to enter a Client ID (and optional Client Secret) and re-attempt.
- [x] Given any mutation fails with a backend error carrying a `detail` string, when the error is shown, then the backend `detail` is surfaced; otherwise the relevant `CON_*` / `TOOL_*` catalog message is shown.
- [x] The page and modals are responsive: layouts use fluid widths (`max-w-4xl`, `max-w-[calc(100vw-32px)]`), the gallery grid collapses from two columns to one on narrow widths, and badge rows wrap.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Connectors list fails to load | `CON_001` message shown in place of the list. |
| Register fails | Backend `detail` (if present) else `CON_002` shown inline in the details step; the wizard stays on the details step. |
| Update / toggle-active / edit fails | Backend `detail` else `CON_003` shown inline on the card / edit modal. |
| Archive fails | Backend `detail` else `CON_004` shown inline on the card. |
| Refresh tools fails | Backend `detail` else `CON_005` shown inline on the card. |
| OAuth start fails | Backend `detail` else `CON_006` shown inline. |
| Tools list fails to load | `useTools` returns its error; toggle list renders empty. (`TOOL_001` is the catalog message for tool-load failures.) |
| Tool toggle fails | Backend `detail` else `TOOL_002` shown inline above the toggle list. |
| Toggling a system-managed / global tool | Backend returns 403/404; the failure surfaces as a `detail`/`TOOL_002` message. |
| Connector exposes no tools | Tool list shows an empty hint ("No tools yet…" / "No tools discovered…"). |
| Preset brand icon fails to load (offline/CSP) | Falls back to a monogram chip. |
| Search matches no presets | "No matching servers" hint with a pointer to "Custom server". |
| OAuth: `requiresManualClient` returned | Card shows Client ID / Client Secret inputs; in the wizard, the user is directed to the card's Connect button to enter them. |
| OAuth callback after browser auth | **Not captured on desktop** — no in-app redirect listener; user returns manually and clicks Refresh (pragna2-tracker TD-001). The `?oauth=success\|error` query handling is retained for web parity and never fires on desktop. |
| Unsaved details edits, then Escape / overlay click | The dirty-dialog guard intercepts to protect a typed token (wizard details step / edit modal). |

## 6. Out of Scope

- OAuth callback round-trip / in-app token capture on desktop (pragna2-tracker TD-001).
- Local `stdio` transport.
- Changing URL or transport on an existing connector.
- A backend-served preset catalogue.
- Per-agent / per-flow tool binding.
- Client-side credential validation beyond required name + URL.
- Automated tests for the repos/mappers/hooks (tracked under pragna2-tracker TD-003).

## 7. Open Questions

- [ ] **OAuth callback round-trip (pragna2-tracker TD-001).** How will desktop capture the OAuth redirect and finish the token exchange in-app? Candidate: a localhost loopback server (RFC 8252, `tauri-plugin-oauth`), reusing the login flow pattern in `auth0/tauriLoopbackAuthFlow.ts`.
- [ ] **Desktop redirect_uri acceptance.** Will the backend / upstream authorization server accept a loopback `redirect_uri` (or a custom deep-link scheme) for desktop clients? The connector `redirect_uri` is set by the backend / registered upstream — must be confirmed before building the loopback path (pragna2-tracker TD-001).

---

_Link to Technical Spec: [technical/connectors.md](../technical/connectors.md)_
