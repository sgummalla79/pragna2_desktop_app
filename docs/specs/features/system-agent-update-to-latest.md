# Feature Spec: Update System Agent to Latest (Nexus Help Agent)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-26
> **Last Updated**: 2026-06-26
>
> Tracker: nexus-kit-tracker #240 (Desktop FE: "Update system agent (Nexus Help)
> to latest template"). Paired backend gap #241 — the backend has no
> refresh/sync endpoint or version field for activated system agents (incl.
> knowledge re-seed); see §6 / §7.

---

## 1. Overview

When a user activates a **system agent template** (e.g. the Nexus Kit Help &
Setup Assistant, `key = nexus-kit-help`), the backend copies the template into a
per-user agent. That copy is **frozen at activation time**: when the template
later changes on the backend (new system prompt, tools, name, description), the
user's instance does **not** auto-refresh, and the backend exposes **no**
refresh/sync endpoint and **no** version field to detect staleness (confirmed by
reading `nexus-kit-api`). This feature adds an **"Update to latest"** action to
the **Settings → Agents** page that re-syncs a system agent to the current state
of its source template, using only the existing endpoints
(`GET /api/agents/templates/{key}` + `PATCH /api/agents/{id}`).

## 2. Goals & Non-Goals

**Goals**
- [x] Detect when a user's system agent is **stale** relative to its source
      template (name, description, system prompt, or tools differ).
- [x] Offer an **"Update to latest"** action on stale system agents only, behind
      a confirmation (it overwrites those fields).
- [x] Re-sync by fetching the freshest template and PATCHing the instance with
      the template-owned fields; refresh the agents + templates lists after.
- [x] Be data-driven: link instance → template by `apiName` (the BE's own
      activation key), with no hard-coded template key/name in logic.

**Non-Goals**
- Free-form editing of system agents (they remain read-only / view-only).
- Re-seeding the template's **knowledge base** — that only happens in the BE
  activate path, not via PATCH; closing it requires a BE change (tracked).
- A backend version field or refresh endpoint (tracked as a BE gap; this is the
  FE-only stopgap that works with today's API).
- Auto-updating instances silently — the user explicitly opts in per update.

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| user | be told when my Help agent is behind the latest published version | I know an update is available |
| user | update my Help agent to the latest version with one click | I get the newest instructions/tools without re-creating it |
| user | confirm before it overwrites | I'm not surprised by the replacement |

## 4. Acceptance Criteria

- [x] Given a system agent whose source template **differs**, when I open
      Settings → Agents, then an **"Update to latest"** button appears on its row.
- [x] Given a system agent that **matches** its template, then **no** update
      button is shown.
- [x] Given no matching template exists (template removed on the BE), then **no**
      update button is shown.
- [x] When I click "Update to latest" and confirm, then the agent's name,
      description, system prompt, and tools are replaced with the template's
      latest values, a success toast appears, and the list reflects the change.
- [x] A non-system (user-authored) agent never shows the update action.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Tools reordered only | Treated as **no change** (order-insensitive) — no update offered. |
| Instance `description` is null, template description is `""` | Treated as equal — no update offered. |
| Source template removed on the BE | No update button (cannot resolve a target). |
| PATCH fails (network/4xx/5xx) | Error toast with the BE `detail` or `AGT_010`; instance unchanged. |
| User cancels the confirm dialog | No-op; nothing patched. |

## 6. Out of Scope

Knowledge-base re-seeding, a BE version/revision field, and a true BE refresh
endpoint. These are recorded as a backend tracker issue.

## 7. Open Questions

- [ ] Should the backend instead own refresh (idempotent re-activate that
      updates, or a `version` field + refresh endpoint)? Tracked on the BE.

---

_Link to Technical Spec: [technical/system-agent-update-to-latest.md](../technical/system-agent-update-to-latest.md)_
