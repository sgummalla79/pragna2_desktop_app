# Technical Spec: System Agent Templates (Help & Setup Assistant)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-25
> **Last Updated**: 2026-06-25
>
> Tracker: nexus-kit-tracker #213. BE contract **verified against the running
> Docker `nexus-kit-api` (`:8181`) OpenAPI**, not assumed from the issue text.

---

## 1. Overview

A new, dedicated read-only catalog stack parallel to the existing agents stack,
kept **separate** from `IAgentRepository` (Interface Segregation): system
templates are browse + a single activate action, with no CRUD and their own cache
lifecycle. Activation copies a template into the user's agents; the resulting
agent flows into the existing agents list and the existing in-chat `AgentPicker`,
so **point 3 of the issue (switch a conversation to the help agent) needs no new
code** — it reuses the agent-switcher feature.

## 2. Verified BE contract (`:8181`)

- **List**: `GET /api/agents/templates` → `AgentTemplateResponse[]`.
- **By key**: `GET /api/agents/templates/{key}` → `AgentTemplateResponse`.
- **Activate**: `POST /api/agents/templates/{key}/activate` →
  `ActivateAgentTemplateResponse` (201 created / 200 already existed).
- `AgentTemplateResponse`: `key, api_name, display_name, description,
  system_prompt, tools[], activatable` (all required).
- `ActivateAgentTemplateResponse`: the full `AgentResponse` fields (`id,
  api_name, display_name, description?, system_prompt, tools[], is_default,
  status, metadata, created_at, modified_at`) **plus** `created: bool`,
  `knowledge_seeded: bool` (default false), `knowledge_note: string|null`.

## 3. Architecture & Layer Placement

Clean-architecture layers touched (FE only — no Rust/platform surface):

- **Domain** (`domain/types/agentTemplate.types.ts`): new `AgentTemplate`
  entity + `ActivatedAgentTemplate` (the activated `Agent` plus `created`,
  `knowledgeSeeded`, `knowledgeNote`). No change to `agent.types.ts`.
- **Application — Port** (`application/ports/IAgentTemplateRepository.ts`):
  `list()`, `get(key)`, `activate(key)`. Separate port (ISP) from
  `IAgentRepository`.
- **Application — Service** (`application/services/AgentTemplateService.ts`):
  thin facade delegating to the port (mirrors `AgentService`).
- **Adapters — Mapper** (`infrastructure/.../mappers/mapAgentTemplate.ts`):
  `ApiAgentTemplateResponse → AgentTemplate`; `ApiActivateAgentTemplateResponse
  → ActivatedAgentTemplate`. The activate response is `ApiAgentResponse` widened
  with metadata, so its agent part is mapped by **reusing `mapAgent`** (DRY) —
  `ApiActivateAgentTemplateResponse extends ApiAgentResponse`.
- **Adapters — Repository** (`infrastructure/repositories/AgentTemplateRepository.ts`):
  axios-backed; paths relative to the `/api` baseURL. No 404 collapse (no
  expected-empty state, unlike `getDefault`).
- **DI** (`ServiceContext.ts` + `ServiceProvider.tsx`): register
  `agentTemplateService` (Open/Closed — added alongside the others).
- **Presentation — Hooks** (`hooks/agents/useAgentTemplates.ts`):
  `useAgentTemplates()` query (`['agent-templates']`) + `useActivateAgentTemplate()`
  mutation that, on success, invalidates **both** the agents list (`AGENTS_KEY` —
  the new agent appears) and the templates list (`activatable` flips).
- **Presentation — UI** (`views/settings/AgentsView/AgentTemplatesSection.tsx`):
  data-driven section rendered inside `AgentsView` below the user's agents. No
  hard-coded template key/name (Open/Closed — new templates surface
  automatically).

## 4. Data Flow

```
[AgentsView mount]
  -> useAgentTemplates -> AgentTemplateService.list
     -> AgentTemplateRepository.list  (GET /agents/templates)
        -> mapAgentTemplate[]  -> AgentTemplatesSection renders cards

[Activate click]
  -> useActivateAgentTemplate.mutate(key)
     -> AgentTemplateService.activate(key)
        -> AgentTemplateRepository.activate  (POST /agents/templates/{key}/activate)
           -> mapActivatedAgentTemplate (reuses mapAgent for the agent part)
        -> onSuccess: invalidate ['agents'] + ['agent-templates']
     -> announceActivation: toast.success(created? "activated" : "already activated")
        + toast.info(knowledgeNote) when !knowledgeSeeded && knowledgeNote
  -> agents list refreshes (activated agent present) ; template row -> "Activated"

[Use the agent in chat]  (no new code — existing agent-switcher feature)
  -> AgentPicker lists active agents (shown at >=2) -> useSetConversationAgent
     -> PATCH /api/conversations/{id} { agent_id }
```

## 5. Module & File Layout

```
src/
  domain/types/
    agentTemplate.types.ts                 (new — AgentTemplate, ActivatedAgentTemplate)
  application/
    ports/IAgentTemplateRepository.ts       (new)
    services/AgentTemplateService.ts        (new)
  infrastructure/repositories/
    AgentTemplateRepository.ts              (new)
    AgentTemplateRepository.test.ts         (new — MSW)
    mappers/mapAgentTemplate.ts             (new — reuses mapAgent)
    mappers/mapAgentTemplate.test.ts        (new)
  presentation/
    providers/ServiceContext.ts             (+ agentTemplateService)
    providers/ServiceProvider.tsx           (+ wiring)
    hooks/agents/useAgentTemplates.ts        (new — query + activate mutation)
    views/settings/AgentsView/
      AgentTemplatesSection.tsx             (new — list + Activate)
      AgentTemplatesSection.test.tsx        (new)
      AgentsView.tsx                        (+ renders the section)
      AgentsView.test.tsx                   (+ stubs agentTemplateService)
  constants/errors.ts                        (+ AGT_008, AGT_009)
```

## 6. Method Specifications

### `IAgentTemplateRepository`

| Method | Maps to | Returns |
|---|---|---|
| `list()` | `GET /api/agents/templates` | `AgentTemplate[]` |
| `get(key)` | `GET /api/agents/templates/{key}` | `AgentTemplate` |
| `activate(key)` | `POST /api/agents/templates/{key}/activate` | `ActivatedAgentTemplate` |

### `useActivateAgentTemplate()`

| Field | Detail |
|---|---|
| **Purpose** | Mutation to activate a template by key (idempotent on the server). |
| **Inputs** | `key: string` |
| **Output** | `ActivatedAgentTemplate` |
| **Side Effects** | On success invalidates `['agents']` (new agent appears) and `['agent-templates']` (`activatable` flips). |
| **Errors** | The axios error propagates to the call site, which surfaces `detailOr(err, AGT_009)`. |

### `AgentTemplatesSection`

| Field | Detail |
|---|---|
| **Purpose** | Lists system templates and activates one; surfaces activation feedback. |
| **Behaviour** | Loading → quiet line; error → `AGT_008` text; empty → renders `null`. Per row: Activate button when `activatable`, else an "Activated" badge. Active mutation row shows "Activating…" (disabled). |
| **Feedback** | `announceActivation`: success toast (`created` → "activated", else "already activated"); `toast.info(knowledgeNote)` only when `!knowledgeSeeded && knowledgeNote`. |
| **Side Effects** | None beyond the mutation; parent page owns the agents list. |

## 7. Error Handling Strategy

| Error | Layer | Propagation |
|---|---|---|
| Templates list load fails | hook → component | `AGT_008` alert text in the section (page unaffected). |
| Activate fails (network/4xx/5xx) | repo → hook → component | `toast.error(detailOr(err, AGT_009.message))`; no optimistic state to roll back. |
| `knowledge_seeded = false` | component | Not an error — `knowledge_note` surfaced as an info toast. |

No silent fallbacks: load + activate failures are surfaced with catalog codes.

## 8. Configuration & Constants

| Constant | Source | Description |
|---|---|---|
| Endpoint paths `/agents/templates[...]` | `AgentTemplateRepository` (axios `baseURL` = `API_BASE_URL`) | No new base-URL literal. |
| Query key `['agent-templates']` | `useAgentTemplates.ts` | Scoped invalidation. |
| `AGT_008`, `AGT_009` | `constants/errors.ts` | Load + activate failure messages. |

No hard-coded template key/name in logic — the catalog is fully data-driven, so the
`nexus-kit-help` template (and any future one) surfaces from the API alone.

## 9. Testing Plan

| Test | Type | What It Verifies |
|---|---|---|
| `mapAgentTemplate` / `mapActivatedAgentTemplate` map the wire shapes; tools default; null note | unit | snake→camel; `mapAgent` reuse for the activate agent part. |
| `AgentTemplateRepository` list/get/activate (201 + idempotent 200) | unit (MSW) | Correct routes/methods; result mapping for both status codes. |
| `AgentTemplatesSection` loading/error/empty/list branches | unit (RTL) | Quiet loading line, `AGT_008` on error, empty → no DOM, list shows handle + Activate. |
| Activatable vs activated rendering | unit | Activate button vs "Activated" badge (no button). |
| Activate flow: success toast; knowledge note only when not seeded; error toast | unit | `announceActivation` paths + `AGT_009` on failure. |
| `AgentsView` still green with the embedded section (stubbed empty) | unit | Section is non-intrusive; existing page behaviour unchanged. |

Full suite: 803 tests pass; `tsc` clean; `lint:platform` gate passes (no
platform/Tauri surface added).

## 10. Dependencies & External Integrations

- BE: nexus-kit-api 2.0.2 templates endpoints (verified live on `:8181`).
- No new npm deps. No Rust. No platform/runtime code (no `lint:platform` surface
  change). Reuses the agent-switcher feature for in-chat use of the activated
  agent.

## 11. Open Questions / Risks

- [ ] Optional future "Start a chat with this assistant" one-click shortcut
      (deferred — existing picker covers switching).
- [ ] The desktop-only `create_stdio_mcp_connector` tool the help agent carries is
      most useful here; no FE-specific handling needed (the agent runs it like any
      tool).

---

_Link to Feature Spec: [features/agent-templates.md](../features/agent-templates.md)_
