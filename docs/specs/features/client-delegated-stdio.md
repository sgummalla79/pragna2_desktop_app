# Feature Spec: Client-delegated stdio MCP servers

> **Status**: Approved
> **Author**: Suman Gummalla
> **Created**: 2026-06-11
> **Last Updated**: 2026-06-12

---

## 1. Overview

Lets a user register and run **local (stdio) MCP servers** from the desktop app, even though the agent loop runs on the hosted backend. The backend never spawns a subprocess (that would be an RCE surface); instead the desktop runs the stdio server, and when a hosted run calls one of its tools the backend **pauses and delegates** the call to the desktop, which executes it locally and resumes the run. This is the client half of the already-shipped backend feature (master `5c7134f`).

In the Settings rail this surface is labelled **"Developer"** (the user-facing name; the underlying route/feature remains client-delegated stdio). See §8 for the 2026-06-12 UI revision that renamed it, moved it last in the rail, and moved config editing into a flyout.

## 2. Goals & Non-Goals

**Goals**
- [ ] Register local stdio MCP servers via a config-based editor (Claude-Desktop style): `mcpServers: { name: { command, args, env } }`.
- [ ] Discover each server's tools locally and make them usable by the hosted agent (the backend stores identity + schemas; the desktop holds the launch config).
- [ ] Show the discovered tools per server with per-tool enable/disable + a Re-discover action.
- [ ] Execute delegated tool calls locally (headless) and auto-resume the run.
- [ ] Keep launch configs + secrets (`env`) in the OS keychain — never sent to the backend.
- [ ] Declare the `stdio_delegation` capability so the backend binds stdio tools and the capability gate passes.

**Non-Goals**
- A field-by-field registration form (config editor instead) or a brand-icon gallery (that's for remote connectors).
- Managing per-sub-MCP auth for aggregator servers (the aggregator owns it; we pass credentials through `env`).
- A re-auth button affordance (deferred — depends on a deferred backend mid-run re-auth interrupt).
- Parallel multi-interrupt resume (the backend resumes a single delegation interrupt in v1).

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| user | add a local MCP server by editing a JSON config | I can use filesystem / local DB / OS / aggregator MCP tools |
| user | see the tools a local server exposes and toggle them | I control what the agent can call |
| user | have the agent call my local tools mid-chat | local capabilities work in hosted flows without me doing anything |
| user | put credentials in the server's `env` | downstream/aggregated MCPs authenticate, with secrets staying on my machine |

## 4. Acceptance Criteria

- [ ] Given a valid `mcpServers` config, when I save, then each server is spawned, its tools are discovered, registered with the backend, and the launch config is stored in the keychain; the server + its tools appear in the list.
- [ ] Given a registered stdio server, when the agent calls one of its tools, then the desktop runs it locally and the run resumes with the result — no user interaction.
- [ ] Given a tool that fails (subprocess error / declined / sub-MCP auth), when it's delegated, then the run degrades (the agent reports the failure) instead of crashing.
- [ ] Given the same connector run from the **web app** (no `stdio_delegation` capability), then the run is rejected with `409 client_delegation_unavailable` naming the tools.
- [ ] Given `env` credentials, when stored, then they are masked in the UI, kept in the keychain, and never sent to the backend or logged.
- [ ] Given a config change (new auth / profile), when I Re-discover, then the visible tool list refreshes.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Subprocess fails to start / bad command | Discovery returns a clear error; the server is not registered. |
| Tool call hangs | Per-call timeout fires → `tool_error` → run degrades. |
| App closed mid-run | The delegation pause stays `awaiting_user`; on reopen the desktop re-reads the envelope (episode reattach) and runs it. |
| Aggregator sub-MCP needs interactive re-auth | Bounded by the per-call timeout → `tool_error`; user re-auths in the aggregator's own flow and retries. |
| stdout > pipe buffer | Continuously drained by the Rust host (no deadlock). |
| Server removed from config | Backend connector deleted + keychain entry cleared. |

## 6. Out of Scope

Re-auth button UX, parallel multi-stdio-worker resume, a non-config structured form, structured per-sub-MCP auth UI, scheduled background tool refresh.

## 7. Open Questions

- [ ] Build sequencing settled (all three sub-phases in one pass).

---

## 8. UI revision — "Developer" page (2026-06-12)

A presentation-only revision of the settings page (no change to the
discover/register/delegate machinery in §1–§6). It is **desktop-only** — the web
app has no local-stdio surface, so none of this is backported (see
`docs/web-app-parity.md`).

**What changed**

- **Renamed** the nav item **and** page title from "Local MCP servers" →
  **"Developer"**, and **moved the nav item to the end** of the settings rail
  (after Profile).
- **Icon** — the item now uses a colored `EntityIcon` tile (like every sibling)
  via a new multicolor `DeveloperIcon`, on a **muted slate** tile (a bright
  saturated tile read too hot behind the multicolor art).
- **Config editing moved into a flyout** — the always-open `<textarea>` editor
  was replaced by an **"Edit Config"** button next to the "Configured servers"
  heading. It opens a right-anchored **flyout side panel** (a rounded, inset
  "box" mirroring the sidebar's floating chrome) containing the JSON editor and a
  **Save** button.
- **Save → refresh + close** — on a successful save the panel **closes** and the
  **Configured servers** list refreshes (existing react-query invalidation). Save
  **errors** keep the panel open with the message inline so the JSON can be fixed.
- **Example config** is now **pretty-printed** and shown **above** the Configured
  servers list as a **collapsible accordion** ("Example config"), styled to match
  the connector cards (clickable header, chevron, conditional body).

**Acceptance criteria (revision)**

- [x] The Settings rail shows **"Developer"** as the **last** nav item, with a
      colored icon tile consistent with its siblings.
- [x] Clicking **Edit Config** opens the flyout; the editor and Save live inside
      it; the panel has visible rounded corners (inset from the window edge).
- [x] A successful Save closes the flyout and the Configured-servers list reflects
      the saved set; a parse/save error keeps the flyout open and shows the error.
- [x] The **Example config** accordion sits above the Configured-servers list,
      is collapsed by default, and expands/collapses on click (and Enter/Space).
- [x] All of the above remain usable from narrow → wide window widths (the flyout
      fills the width on small screens, capped on large; the accordion + list
      reflow without overflow).

---

_Link to Technical Spec: [technical/client-delegated-stdio.md](../technical/client-delegated-stdio.md)_
