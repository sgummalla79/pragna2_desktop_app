# Feature Spec: MCP per-service re-auth (aggregator / mcp-adaptor)

> **Status**: Draft
> **Author**: Suman Gummalla
> **Created**: 2026-06-17
> **Last Updated**: 2026-06-17
>
> Tracker: **#124** (`fp:mcp-per-service-reauth-desktop-phase1`, `target:desktop-fe`).
> Desktop Phase 1 of #122. BE counterpart **#123** (merged, pragna2-api `Releases/V1` @ 3f80c45, v1.0.12).
> Design: `~/.claude/plans/mcp-per-service-reauth.md`.

---

## 1. Overview

When the agent uses a tool from a **client-delegated stdio aggregator** MCP server
(a local `mcp-adaptor` exposing several downstream providers — e.g. `gus`, `search`,
`google` — each with its own OAuth), the desktop runs that tool locally. If the
**downstream provider's** token is expired/invalid (e.g. GUS returns
`INVALID_SESSION_ID`), today the error text is relayed to the backend as a plain
`tool_error` and the LLM narrates it in prose (the #122 symptom).

This feature makes the desktop **(a)** classify that downstream auth failure, **(b)**
return a **structured `auth_required` signal** to the backend so the run pauses with a
precise, per-service **Re-authenticate** card, and **(c)** on the user's
"Re-authenticate", drive the adaptor's own re-auth flow
(`<adaptor-binary> auth --provider <service>`, which opens the system browser) and then
resume the paused run so the now-authed call succeeds.

The backend already pauses on a conservative text-signal fallback (#123), so the card
appears even before this work lands. This feature **upgrades** that to per-service
precision and **drives the actual re-auth**.

## 2. Goals & Non-Goals

**Goals**
- [ ] Classify an auth/expired failure returned by a delegated stdio aggregator tool call.
- [ ] Map the failure to the **downstream provider** (`service`, e.g. `gus`).
- [ ] Return the structured `{ auth_required: { service, reason, authorization_url } }`
      result on `/resume-tool` instead of a plain `tool_error`.
- [ ] Render a `boundary=downstream_service` / `transport=stdio` variant of the existing
      `ReauthCard` that names the specific service.
- [ ] On "Re-authenticate", run `<adaptor-binary> auth --provider <service>` (or open
      `authorization_url` when present), then resume `retry`.
- [ ] On "Continue without it", resume `continue` (the BE degrades the step).
- [ ] Independent downstream services under the same adaptor re-auth independently.

**Non-Goals**
- Owning or storing the downstream provider's token (the adaptor owns it — boundary B/C).
- Remote-aggregator connectors and MCP **URL elicitation** (Phase 2 / #125).
- Changing the existing remote-OAuth (`boundary=connector`) re-auth behaviour.
- Any backend or web-FE change (those are #123 / their own sessions — §15).

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| user | be told *which* connected service (e.g. GUS) needs re-authentication when it expires mid-run | I know exactly what to fix, not read an LLM guess |
| user | click "Re-authenticate" and have the adaptor's own login open | I can reconnect without a terminal |
| user | retry after re-authenticating and have the agent's step actually complete | the run finishes with real data |
| user | choose to continue without the service | the run proceeds (degraded) when I can't reconnect now |

## 4. Acceptance Criteria

- [ ] Given a delegated GUS tool call whose downstream token is expired, when the call
      returns its auth error, then the desktop posts `{ auth_required: { service: "gus",
      reason: "token_expired", authorization_url: null } }` on `/resume-tool` (not a
      `tool_error`).
- [ ] Given the resulting pause, the inline card names the **specific service** (`gus`),
      not a generic connector label, and is **not** an LLM prose explanation.
- [ ] Given the user clicks "Re-authenticate", then `<adaptor-binary> auth --provider gus`
      runs and the system browser opens; when `authorization_url` is present instead, that
      URL opens.
- [ ] Given the user finished re-auth and clicks "Retry", then the BE re-raises a normal
      `mcp_tool_delegation` interrupt, the desktop re-runs the (now-authed) call, and the
      run continues with a real result.
- [ ] Given the user clicks "Continue without it", then the run resumes `continue` and
      degrades gracefully.
- [ ] Given two downstream services under the same adaptor, when one expires, only that
      service's re-auth is driven (the `service` field selects the `--provider`).
- [ ] Given a **non-auth** tool error, then behaviour is unchanged (still a `tool_error`,
      no pause).
- [ ] Given the older 4-field `connector_reauth` envelope (no `boundary`), the card still
      renders (the remote-OAuth path is untouched).

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Auth error returned as an `isError` result body (HTTP-200-equivalent) | Classified as auth-required (isError + signal match), not relayed as a normal result |
| Adaptor binary missing / not executable on re-auth | Inline error on the card ("could not start re-authentication"); user can still Continue |
| `<binary> auth --provider <svc>` exits non-zero (cancelled / rejected) | Inline error on the card; no resume; user may retry or Continue |
| `service` cannot be derived from the connector's launch config | Send `auth_required` with `service: null`; card falls back to a generic "reconnect out of band, then Retry" message |
| Re-delegated retry **still** auth-fails | BE bounds it to one attempt and degrades to a `tool_error` (no infinite loop) — desktop just runs the call again |
| Non-Tauri runtime (browser/dev) reaches this path | Cannot happen — the BE only binds stdio delegation when the client declares `stdio_delegation`; the re-auth Tauri commands are `isTauriRuntime()`-guarded |

## 6. Out of Scope

- Remote aggregator connectors + URL elicitation (Phase 2 / #125).
- Proactive (pre-expiry) re-auth of downstream services.
- Multi-service-per-connector derivation if a single connector aggregates many providers
  (see Open Questions — current model is one connector per `--server <svc>`).

## 7. Open Questions

- [ ] **Detection mechanism (verify-first):** does an expired *downstream-service* token
      surface as an `isError` result body whose content carries the signal (e.g.
      `INVALID_SESSION_ID`), or — as FEAT-001 found for the adaptor's *gateway-login* token
      — only in child-process **stderr** (unreachable via rmcp)? Must be confirmed against
      the Docker BE + a real expired GUS token before the classifier is locked.
- [ ] **Service-derivation model:** confirmed assumption is one connector per downstream
      service, launched `mcp-adaptor --server <svc>`, re-authed `auth --provider <svc>`
      (e.g. `~/.mcp-adaptor/bin/mcp-adaptor-go-v2.1.0-...-amd64 auth --provider gus`). If a
      single connector aggregates multiple services, `service` must instead come from the
      tool-name namespace or the adaptor error payload — revisit.

---

_Link to Technical Spec: [technical/mcp-per-service-reauth.md](../technical/mcp-per-service-reauth.md)_
