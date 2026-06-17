# Technical Spec: MCP per-service re-auth (aggregator / mcp-adaptor)

> **Status**: Draft
> **Author**: Suman Gummalla
> **Created**: 2026-06-17
> **Last Updated**: 2026-06-17
>
> Tracker **#124** · BE counterpart **#123** (merged, pragna2-api `Releases/V1` @ 3f80c45).
> Contract source of truth: pragna2-api `src/constants.py` @ `Releases/V1` (mirrored here).

---

## 1. Overview

Detection + service-derivation live in **Rust** (the only layer that sees the tool
result content, `result.isError`, **and** the connector's stored launch config — binary
path + `--server` arg). The Rust delegated-call path stops discarding `isError`,
classifies an auth-required outcome, derives the downstream `service` from the launch
config, and returns a **discriminated outcome** to the frontend. The frontend's
`runDelegation` maps an `AuthRequired` outcome to the backend's structured
`{ auth_required: { service, reason, authorization_url } }` result on `/resume-tool`.
The backend (already shipped, #123) raises a boundary-aware `connector_reauth` pause; the
frontend renders a `boundary=downstream_service` variant of the existing `ReauthCard`
that runs `<adaptor-binary> auth --provider <service>` and resumes via the unchanged
`/resume-reauth` (`retry` → BE re-raises a normal `mcp_tool_delegation` interrupt the
existing handler already runs; `continue` → degrade).

## 2. Architecture & Layer Placement

**Rust (`src-tauri/`)**
- **Domain** (`domain/mcp.rs`): a `DelegatedCallOutcome` value (success vs auth-required +
  `service`/`reason`); the auth-signal constant list. No new error variant required
  (auth-required is a normal outcome, not a host failure).
- **Application** (`application/mcp_host.rs`): `call` returns `DelegatedCallOutcome` (and
  enriches `service` from the launch-config args); new `reauth(id, service)` use case
  resolving the binary from the stored config and running `<command> auth --provider
  <service>`; `auth(command, service)` extended with the optional `--provider`; a
  `service_for(id)` helper derives the provider from the launch-config args.
- **Platform** (`platform/mcp_registry.rs`): `call` stops discarding `result.isError`;
  classifies the flattened content (and a raised call error) against the signal list, and
  emits a `[mcp_stdio_call]` diagnostic of the raw outcome (the #124 verify-first probe);
  `load_config` reused to read `command` + `args` for derivation and re-auth.
- **Adapters** (`adapters/mcp_commands.rs`): `mcp_stdio_call` returns the discriminated
  outcome; new `mcp_stdio_reauth` command (the existing `mcp_stdio_auth(command)` stays for
  the config-save/gateway-login flow — FEAT-001).

**Frontend (`src/`)**
- **Domain** (`domain/types/mcpDelegation.types.ts`): extend `ReauthEnvelope` with additive
  `boundary`/`transport`/`service`/`authorization_url`/`resume_actions`; add the
  `auth_required` `DelegationResult` variant; predicate `isDownstreamServiceReauth`; new
  wire-key/value constants mirroring the BE.
- **Infrastructure** (`infrastructure/platform/mcpStdio.ts`): `call` returns the
  discriminated outcome; new `reauth(connectorId, service)` wrapper.
- **Presentation**:
  - `runDelegation` (`useChatSession.ts`) maps an `auth_required` outcome to the structured
    `/resume-tool` result; `submitReauth` already posts to `/resume-reauth`.
  - `ReauthCard.tsx` branches on `boundary === 'downstream_service'`: "Re-authenticate" runs
    `mcpStdio.reauth(connector_id, service)` (or opens `authorization_url`) instead of
    `useStartConnectorOAuth()`.

## 3. Data Flow

```
agent calls aggregator tool
  → BE pauses: mcp_tool_delegation { calls:[{connector_id, upstream_name, args, ...}] }
  → useChatSession.runDelegation()
      for each call: mcpStdio.call(connector_id, upstream_name, args)
        → Rust McpRegistry::call → flatten_result + isError
            ├─ ok, !isError        → Outcome::Success(content)
            └─ isError + signal    → Outcome::AuthRequired { service: service_for(id), reason }
      auth-required call → results.push({ auth_required: { service, reason, authorization_url:null } })
      normal call        → results.push({ tool_result } | { tool_error })
  → POST /resume-tool { results }
  → BE raises connector_reauth { boundary:"downstream_service", transport:"stdio", service:"gus", ... }
  → readReauthEnvelope() → ReauthCard (downstream-service branch)
      "Re-authenticate" → mcpStdio.reauth(connector_id, service)
                           → Rust: <command> auth --provider <service> (system browser)
                        → on success → submitReauth('retry') → POST /resume-reauth {action:"retry"}
      "Continue"        → submitReauth('continue') → POST /resume-reauth {action:"continue"}
  → on retry, BE re-raises mcp_tool_delegation for the failed call → runDelegation re-runs it
```

## 4. Module & File Layout

```
src-tauri/src/
  domain/mcp.rs               ← DelegatedCallOutcome, AUTH_ERROR_RESULT_SIGNALS, provider-flag consts
  application/mcp_host.rs     ← call() -> DelegatedCallOutcome; reauth(id, service); service_for(id)
  platform/mcp_registry.rs    ← call() classifies isError + signal; (keeps load_config)
  adapters/mcp_commands.rs    ← mcp_stdio_call (outcome); mcp_stdio_reauth (new)
src/
  domain/types/mcpDelegation.types.ts   ← ReauthEnvelope additive fields, auth_required variant,
                                            constants, isDownstreamServiceReauth()
  infrastructure/platform/mcpStdio.ts    ← call() outcome; reauth(connectorId, service)
  presentation/views/chat/hooks/useChatSession.ts        ← runDelegation maps auth_required
  presentation/views/chat/components/hitl/ReauthCard.tsx ← downstream-service branch
```

## 5. Method Specifications

### Rust — `platform::mcp_registry::McpRegistry`

#### `call(&self, id, cfg, upstream_name, args) -> Result<DelegatedCallOutcome, McpHostError>`

| Field | Detail |
|---|---|
| **Purpose** | Run a delegated tool call against the warm service; classify an auth-required outcome instead of discarding `isError`. |
| **Inputs** | `id: Uuid`, `cfg: &StdioLaunchConfig`, `upstream_name: &str`, `args: serde_json::Value` |
| **Output** | `DelegatedCallOutcome::Success(String)` for a normal result; `::AuthRequired { service: Option<String>, reason: String }` when the result `isError` and its content matches `AUTH_ERROR_RESULT_SIGNALS` (case-insensitive substring). |
| **Errors** | `Timeout`, `Protocol` (handshake/transport), `Spawn` — unchanged. A raised `Protocol` whose message matches the signal list is **also** mapped to `AuthRequired` (pending verification — see §10). |
| **Side Effects** | Spawn-or-reuse the warm subprocess (unchanged). |
| **Invariants** | Classification is conservative — a non-auth `isError` still returns `Success` (relayed as content); a false positive only costs a pause the user can dismiss. |

### Rust — `application::mcp_host`

#### `service_for(id: Uuid) -> Result<Option<String>, McpHostError>`
| Field | Detail |
|---|---|
| **Purpose** | Derive the downstream provider from the connector's stored launch config (the value after `--server` / `--provider` in `args`). |
| **Output** | `Some("gus")` when a provider flag is present; `None` otherwise (FE sends `service: null`). |
| **Errors** | `NotConfigured`, `Keyring`, `Serde` from `load_config`. |

#### `reauth(id: Uuid, service: Option<&str>) -> Result<(), McpHostError>`
| Field | Detail |
|---|---|
| **Purpose** | Drive the adaptor's own re-auth for a downstream service: load the config, run `<config.command> auth [--provider <service>]`, wait for exit. |
| **Inputs** | `id` (connector), `service` (provider; when `None`, runs `auth` with no `--provider`, matching the existing gateway-login behaviour). |
| **Output** | `()` on exit 0. |
| **Errors** | `Spawn` (binary missing / not executable), `Protocol` (non-zero exit = cancelled/rejected), plus `load_config` errors. |
| **Side Effects** | Launches the adaptor's browser OAuth flow; the adaptor stores fresh tokens in its own store. **No pragna2-side token mutation.** |

> The provider-flag is `--provider <service>` for re-auth (confirmed from the user's
> invocation `mcp-adaptor-go-... auth --provider gus`). Derivation reads `--server`
> **or** `--provider` from the launch args (constant list), to be confirmed against a
> real connector config (§10).

### Frontend — `domain/types/mcpDelegation.types.ts`

- `interface AuthRequiredResult { service: string | null; reason: string; authorization_url: string | null }`
- `DelegationResult` gains optional `auth_required?: AuthRequiredResult` (exactly one of
  `tool_result` / `tool_error` / `auth_required` set).
- `ReauthEnvelope` gains optional `boundary?`, `transport?`, `service?: string | null`,
  `authorization_url?: string | null`, `resume_actions?: string[]` (original 4 stay required).
- `isDownstreamServiceReauth(env): boolean` — `env.boundary === MCP_REAUTH_BOUNDARY_DOWNSTREAM_SERVICE`.

### Frontend — `infrastructure/platform/mcpStdio.ts`

- `call(...)` resolves to `{ kind: 'result'; content: string } | { kind: 'auth_required';
  service: string | null; reason: string }` (mirrors the Rust outcome; serde tag).
- `reauth(connectorId, service): Promise<void>` → `invoke('mcp_stdio_reauth', { connectorId, service })`,
  `isTauriRuntime()`-guarded (throws `NotInTauriError` in browser).

## 6. Error Handling Strategy

| Error | Layer | Propagation |
|---|---|---|
| `McpHostError::Spawn/Protocol/...` | Rust platform/app | `to_string()` at the Tauri boundary (unchanged) → rejected `invoke` → caught in `runDelegation`/`ReauthCard` |
| `DelegatedCallOutcome::AuthRequired` | Rust → FE | **Not an error** — a normal outcome mapped to the `auth_required` result on `/resume-tool` |
| Re-auth subprocess non-zero / missing binary | Rust → `ReauthCard` | Inline card error; no resume; Continue still available |
| Stream/resume failure | FE | Existing `HITL_002` handling in `runEpisodeStream` |

## 7. Configuration & Constants

| Constant | Source | Description |
|---|---|---|
| `AUTH_ERROR_RESULT_SIGNALS` (Rust) / mirror | mirrors pragna2-api `MCP_AUTH_ERROR_RESULT_SIGNALS` | Conservative case-insensitive auth-failure substrings (`invalid_session_id`, `401`, `403`, `unauthorized`, `forbidden`, `token expired`, `token has expired`, `expired token`, `invalid_token`, `invalid token`, `stale session`, `session expired`, `authentication failed`, `not authenticated`, `re-authenticate`, `reauthenticate`, `www-authenticate`) |
| `MCP_DELEGATION_RESUME_AUTH_REQUIRED_KEY = "auth_required"` | BE `constants.py` | Top-level key of the structured result |
| `MCP_AUTH_REQUIRED_KEY_{SERVICE,REASON,AUTHORIZATION_URL}` | BE `constants.py` | Inner keys (`service`/`reason`/`authorization_url`) |
| `MCP_REAUTH_KEY_{BOUNDARY,TRANSPORT,SERVICE,AUTHORIZATION_URL,RESUME_ACTIONS}` | BE `constants.py` | Additive envelope keys |
| `MCP_REAUTH_BOUNDARY_DOWNSTREAM_SERVICE = "downstream_service"`, `..._CONNECTOR = "connector"` | BE `constants.py` | Boundary discriminator |
| `MCP_REAUTH_REASON_TOKEN_EXPIRED = "token_expired"` (default) | BE `constants.py` | Reason when no definitive revocation signal |
| `MCP_REAUTH_TRANSPORT_STDIO = "stdio"` | BE / mcp.types | Transport discriminator for the card branch |
| Provider flags `["--server", "--provider"]` | this spec (constants file) | Launch-arg flags whose value is the downstream `service` |

All wire keys are centralised (no inline literals) so a contract drift is a one-line edit.

## 8. Testing Plan

| Test | Type | What It Verifies |
|---|---|---|
| `call_classifies_isError_auth_result` | Rust unit | isError + signal → `AuthRequired`; service derived from args |
| `call_non_auth_isError_still_success` | Rust unit | isError without a signal → `Success` (relayed) |
| `call_happy_path_unchanged` | Rust unit | ok result → `Success(content)` |
| `service_for_parses_server_and_provider_flag` | Rust unit | `--server gus` / `--provider gus` → `Some("gus")`; absent → `None` |
| `reauth_runs_auth_provider` / `reauth_nonzero_is_protocol_err` | Rust unit | command shape + exit-code mapping |
| `runDelegation maps auth_required` | TS unit | an `auth_required` outcome → structured `/resume-tool` result |
| `readReauthEnvelope parses additive fields` + back-compat | TS unit | new fields read; 4-field envelope still parses |
| `isDownstreamServiceReauth` truth-table | TS unit | boundary branch |
| `ReauthCard downstream-service branch` | TS/RTL | "Re-authenticate" calls `mcpStdio.reauth(id, service)` (not OAuth); names the service; Continue/Retry resume actions |
| Manual / Docker-BE scenario | E2E (manual) | expired GUS → card naming `gus` → adaptor auth → Retry succeeds (the browser flow is not Playwright-automatable) |

Coverage assessment surfaced before declaring done (unit/integration/UI/E2E split).

## 9. Dependencies & External Integrations

- mcp-adaptor binary supporting `auth --provider <service>` (e.g.
  `mcp-adaptor-go-v2.1.0`). **Not present on the current dev Mac** — re-auth + the expired-
  token verification need a machine with the adaptor + a GUS account.
- Docker `pragna2-api` (`Releases/V1`, ≥ v1.0.12) for the boundary-aware pause.
- No new crates expected (`tokio::process` already used by the existing `auth`).

## 10. Open Questions / Risks

- [ ] **Detection mechanism (verify-first, blocking the classifier lock).** FEAT-001 found
      the adaptor's *gateway-login* expiry surfaced only in child-process **stderr**
      (unreachable via rmcp). This feature targets a *downstream-service* expiry during a
      `call_tool`, expected to return an `isError` result body carrying the signal — but
      this must be confirmed against the Docker BE + a real expired GUS token. If it is
      stderr-only, classification needs a different mechanism (capture the child's stderr,
      or a proactive affordance) and this spec's `call` change is insufficient.
- [ ] **Cross-platform.** Re-auth spawns the adaptor binary — verify on both Windows
      (the `...-windows-amd64` binary path) and macOS.
- [ ] **Service-derivation model.** Assumes one connector per `--server <svc>`; if a single
      connector aggregates multiple providers, `service` must come from the tool namespace
      or the adaptor error payload instead. Revisit once a real config is in hand.
- [ ] **isError discard is also a latent bug** on this delegated path (mirrors the #123 BE
      fix) — log in `docs/CODE_FIXES.md` with web-app (`pragna2_sgummalla_works`)
      applicability.

---

_Link to Feature Spec: [features/mcp-per-service-reauth.md](../features/mcp-per-service-reauth.md)_
