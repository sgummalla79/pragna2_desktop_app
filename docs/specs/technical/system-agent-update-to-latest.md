# Technical Spec: Update System Agent to Latest (Nexus Help Agent)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-26
> **Last Updated**: 2026-06-26

---

## 1. Overview

A FE-only re-sync for **system agents** that works with today's backend (no new
BE endpoint). The page detects when a user's system agent is stale relative to
its source template and offers an "Update to latest" action that fetches the
freshest template (`GET /api/agents/templates/{key}`) and patches the instance
(`PATCH /api/agents/{id}`) with the template-owned fields. Linkage from instance
to template is by `apiName` — the same key the backend matches on at activation.

## 2. Backend contract (verified, read-only)

Confirmed by reading `nexus-kit-api`:

- `POST /agents/templates/{key}/activate` on an already-activated user returns
  the **existing agent unchanged** (HTTP 200, `created=false`) — re-activation
  does **not** refresh. (`activate_agent_template.py`.)
- There is **no** `template_key` / `version` / `revision` column on the agent or
  template, so the client cannot get a version signal from the BE.
- There is **no** refresh / sync / reseed endpoint. The only mutation path is
  `PATCH /api/agents/{id}` (`UpdateAgent`), a generic partial update.
- `GET /api/agents/templates[/{key}]` **does** return the full template incl.
  `system_prompt` and `tools` — which is what makes the FE stopgap possible.

Consequence: the FE computes staleness itself (field comparison) and reuses
PATCH. The robust fix (BE owns refresh + version) is tracked as a backend issue.

## 3. Architecture & Layer Placement

- **Domain**: no new types. Reuses `Agent`, `UpdateAgentPayload`
  (`domain/types/agent.types.ts`) and `AgentTemplate`
  (`domain/types/agentTemplate.types.ts`).
- **Application**: no new ports/services. Orchestration is a thin presentation
  hook over the existing `AgentService.update` and `AgentTemplateService.get`
  (consistent with `useActivateAgentTemplate`).
- **Adapters / Presentation**: pure helpers + a query hook + the AgentsView row
  affordance.

## 4. Data Flow

```
AgentsView
  └─ useAgentTemplates() ─────────────► GET /api/agents/templates   (staleness signal)
  └─ per system-agent row:
       findTemplateForAgent(agent, templates)      (match by apiName)
       systemAgentNeedsUpdate(agent, template)     (field diff → show/hide button)
  └─ onUpdateToLatest(agentId, templateKey)
       └─ useSyncSystemAgent.mutateAsync
            ├─ agentTemplateService.get(templateKey) ─► GET /api/agents/templates/{key}
            ├─ buildSyncPayload(template) → UpdateAgentPayload
            └─ agentService.update(agentId, payload) ─► PATCH /api/agents/{id}
       └─ onSuccess: invalidate ['agents'] + ['agent-templates']; success toast
```

## 5. Module & File Layout

```
src/
  constants/
    errors.ts                                    (+ AGT_010)
  presentation/
    hooks/agents/
      useSyncSystemAgent.ts                       (new) orchestration hook
    views/settings/AgentsView/
      constants.ts                                (+ SYSTEM_AGENT_METADATA_KEY,
                                                     SYSTEM_AGENT_ROLE_HELP_SETUP)
      syncSystemAgent.ts                          (new) pure helpers
      syncSystemAgent.test.ts                     (new) helper unit tests
      AgentsView.tsx                              (+ Update-to-latest affordance,
                                                     uses isSystemAgent helper)
      AgentsView.test.tsx                         (+ system-agent update cases)
docs/specs/
  features/system-agent-update-to-latest.md       (new)
  technical/system-agent-update-to-latest.md       (new)
```

## 6. Key signatures (with docstrings in source)

```ts
// syncSystemAgent.ts — pure, no I/O
function isSystemAgent(agent: Agent): boolean;
function findTemplateForAgent(agent: Agent, templates: readonly AgentTemplate[]):
  AgentTemplate | undefined;                       // match by apiName
function systemAgentNeedsUpdate(agent: Agent, template: AgentTemplate): boolean;
function buildSyncPayload(template: AgentTemplate): UpdateAgentPayload;

// useSyncSystemAgent.ts
interface SyncSystemAgentArgs { agentId: string; templateKey: string; }
function useSyncSystemAgent(): UseMutationResult<Agent, Error, SyncSystemAgentArgs>;
```

`buildSyncPayload` sends **only** `displayName`, `description`, `systemPrompt`,
`tools`. It deliberately omits `apiName` (immutable), `isDefault` (set-default
endpoint), `status`, and `metadata` (preserves the system sentinel).

## 7. Error Handling

- Failures surface via `toast.error(detailOr(err, ERRORS.AGT_010.message))` — the
  BE `detail` string when present, else the `AGT_010` catalog message.
- A missing template (removed on BE) yields `findTemplateForAgent → undefined`,
  so the action is simply not offered (no error path needed).
- The hook's `mutationFn` lets errors propagate; the view's try/catch owns UX.

## 8. SOLID / Standards notes

- **SRP**: pure diff/payload logic (`syncSystemAgent.ts`) is separate from
  orchestration (`useSyncSystemAgent.ts`) and rendering (`AgentsView.tsx`).
- **OCP / no-hardcoding**: the system sentinel moved to named constants; linkage
  is data-driven by `apiName`, so new system templates work with no code change.
- **DIP**: the hook depends on the `AgentService` / `AgentTemplateService`
  abstractions via `useServices()`, not concrete repositories.

## 9. Testing

- `syncSystemAgent.test.ts`: sentinel detection, apiName matching, the four
  staleness fields, tools order-insensitivity, null/empty description
  normalisation, payload shape.
- `AgentsView.test.tsx`: system row shows View (not Edit) + no archive; update
  hidden when up-to-date; update offered + correct `get`/`update` calls when the
  template moved on.

## 10. Backend follow-up (out of scope here)

Tracked as a `target:backend` issue: give the BE a real refresh path — either an
idempotent re-activate that updates the existing instance, or a `version` field
plus a refresh endpoint — so knowledge re-seeding is covered and staleness is
detectable server-side rather than diffed on the client.
