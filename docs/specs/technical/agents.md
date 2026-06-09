# Technical Spec: Agents

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Overview

Port the standalone **Agents** feature from the web app into the desktop app,
following the established Clean-Architecture layering (domain → application →
infrastructure → presentation) and the existing Providers/Connectors/Knowledge
conventions. All transport goes through the shared axios client over the native
HTTP adapter. No new external dependencies. Theme-tokens only.

The feature has three data surfaces: **agents** (`/api/agents`), **agent↔connector
bindings** (`/api/agents/{id}/connectors`), and **agent↔knowledge-library bindings**
(`/api/agents/{id}/knowledge-libraries`). The first two are new; the third is added
back onto the existing Knowledge layer (those methods were intentionally omitted
when Knowledge was first ported standalone).

## 2. Architecture & Layer Placement

- **Domain**:
  - New: `domain/types/agent.types.ts` (`Agent`, `AgentStatus`, `CreateAgentPayload`,
    `UpdateAgentPayload`, `DefaultAgentTemplate`), `domain/types/agentConnector.types.ts`
    (`AgentConnector`, `AttachAgentConnectorPayload`, `UpdateAgentConnectorPayload`).
  - Modified: `domain/types/knowledge.types.ts` — add back `AgentKnowledgeLibrary`
    and `AttachLibraryPayload` (agent-binding types).
- **Application**:
  - New port `application/ports/IAgentRepository.ts`; new service
    `application/services/AgentService.ts`.
  - Modified port `application/ports/IKnowledgeRepository.ts` + service
    `application/services/KnowledgeService.ts` — add `listAgentLibraries`,
    `attachAgentLibrary`, `detachAgentLibrary`.
- **Infrastructure**:
  - New `infrastructure/repositories/AgentRepository.ts` (constructor takes
    `AxiosInstance`) + mappers `mappers/mapAgent.ts`, `mappers/mapAgentConnector.ts`.
  - Modified `infrastructure/repositories/KnowledgeRepository.ts` +
    `mappers/mapKnowledge.ts` — add the three agent-binding methods + a binding mapper.
- **Presentation**:
  - Views `presentation/views/settings/AgentsView/`: `AgentsView.tsx` (default
    export, list + onboarding), `AgentFormModal.tsx` (create/edit dialog),
    `AgentConnectorsSection.tsx`, `AgentKnowledgeSection.tsx`, `ChipInput.tsx`,
    `constants.ts` (handle regex).
  - Hooks `presentation/hooks/agents/`: `useAgents.ts`, `useAgentConnectors.ts`,
    `useAgentKnowledge.ts`.
  - DI: register `agentService` in `ServiceContext.ts` + `ServiceProvider.tsx`.
  - Routing: `AppRoutes.tsx` swaps the `/settings/agents` placeholder for `AgentsView`.
  - Errors: add `AGT_001`–`AGT_007` to `constants/errors.ts`.

## 3. Data Flow

```
AgentsView ──useAgents──> AgentService.list() ──> AgentRepository.list() ──GET /api/agents──> [Agent]
AgentFormModal ──useCreateAgent/useUpdateAgent──> AgentService.create/update ──> AgentRepository ──POST/PATCH /api/agents[/{id}]
AgentConnectorsSection ──useAgentConnectors/useAttach…──> AgentService.listConnectors/attachConnector ──> /api/agents/{id}/connectors
AgentKnowledgeSection ──useAgentKnowledge/useAttach…──> KnowledgeService.listAgentLibraries/attach… ──> /api/agents/{id}/knowledge-libraries
```

Sub-resource mutations (connector/knowledge bindings) apply immediately and
invalidate their nested query key — they are **not** deferred to the form's Save.

## 4. Module & File Layout

```
src/
  domain/types/
    agent.types.ts                         (new)
    agentConnector.types.ts                (new)
    knowledge.types.ts                     (modified: +AgentKnowledgeLibrary, +AttachLibraryPayload)
  application/
    ports/IAgentRepository.ts              (new)
    ports/IKnowledgeRepository.ts          (modified: +3 agent-binding methods)
    services/AgentService.ts               (new)
    services/KnowledgeService.ts           (modified: +3 agent-binding methods)
  infrastructure/repositories/
    AgentRepository.ts                     (new)
    KnowledgeRepository.ts                 (modified: +3 agent-binding methods)
    mappers/mapAgent.ts                    (new)
    mappers/mapAgentConnector.ts           (new)
    mappers/mapKnowledge.ts                (modified: +mapAgentKnowledgeLibrary)
  presentation/
    hooks/agents/useAgents.ts              (new)
    hooks/agents/useAgentConnectors.ts     (new)
    hooks/agents/useAgentKnowledge.ts      (new)
    views/settings/AgentsView/
      AgentsView.tsx                       (new, default export)
      AgentFormModal.tsx                   (new)
      AgentConnectorsSection.tsx           (new)
      AgentKnowledgeSection.tsx            (new)
      ChipInput.tsx                        (new)
      constants.ts                         (new: API_NAME_RE)
    providers/ServiceContext.ts            (modified: +agentService)
    providers/ServiceProvider.tsx          (modified: +AgentService/AgentRepository)
    router/AppRoutes.tsx                   (modified: /settings/agents -> AgentsView)
  constants/errors.ts                      (modified: +AGT_001..AGT_007)
```

## 5. Method Specifications

### `IAgentRepository` / `AgentRepository`

#### `list(includeArchived = false) -> Promise<Agent[]>`
| Field | Detail |
|-------|--------|
| **Purpose** | List the user's agents. |
| **Inputs** | `includeArchived: boolean` — when true, send `?include_archived=true`. |
| **Output** | `Agent[]` (mapped from snake_case). |
| **Errors** | Network/HTTP → AxiosError; surfaced as `AGT_001` by the hook/view. |
| **Side Effects** | `GET /api/agents`. |
| **Invariants** | Read-only. |

#### `get(id: string) -> Promise<Agent>`
| Field | Detail |
|-------|--------|
| **Purpose** | Fetch one agent. |
| **Inputs** | `id` — agent UUID. |
| **Output** | `Agent`. |
| **Errors** | 404 → AxiosError (not collapsed here). |
| **Side Effects** | `GET /api/agents/{id}`. |

#### `getDefault() -> Promise<Agent | null>`
| Field | Detail |
|-------|--------|
| **Purpose** | Fetch the user's default agent, or null if none. |
| **Inputs** | none. |
| **Output** | `Agent | null`. |
| **Errors** | **404 is collapsed to `null`** (expected "no default yet" state); other errors rethrow. |
| **Side Effects** | `GET /api/agents/default`. |

#### `getDefaultTemplate() -> Promise<DefaultAgentTemplate>`
| Field | Detail |
|-------|--------|
| **Purpose** | Starter values for the create-default form. |
| **Output** | `DefaultAgentTemplate`. |
| **Side Effects** | `GET /api/agents/default-template`. |

#### `create(payload: CreateAgentPayload) -> Promise<Agent>`
| Field | Detail |
|-------|--------|
| **Purpose** | Create an agent (optionally as the new default). |
| **Inputs** | `CreateAgentPayload` (apiName, displayName, description?, systemPrompt?, tools?, isDefault?, metadata?). |
| **Output** | created `Agent`. |
| **Errors** | 409 duplicate (`AGT_002`), 422 bad handle (`AGT_007`), else `AGT_003`. |
| **Side Effects** | `POST /api/agents` (body mapped to snake_case; `is_default` triggers atomic default swap). |
| **Invariants** | `apiName` must match `API_NAME_RE`. |

#### `update(id, payload: UpdateAgentPayload) -> Promise<Agent>`
| Field | Detail |
|-------|--------|
| **Purpose** | Patch mutable fields (display name, description, system prompt, tools, status, metadata). |
| **Inputs** | `id`, `UpdateAgentPayload` — only set keys are sent (exclude_unset). |
| **Output** | updated `Agent`. |
| **Errors** | 400 default-protection (`AGT_006`), else `AGT_003`. |
| **Side Effects** | `PATCH /api/agents/{id}`. |
| **Invariants** | `apiName` and `isDefault` are NOT updatable here. |

#### `setDefault(id) -> Promise<Agent>`
| Field | Detail |
|-------|--------|
| **Purpose** | Promote an agent to default (atomic; prior default demoted). |
| **Errors** | else `AGT_005`. |
| **Side Effects** | `POST /api/agents/{id}/set-default`. |

#### `archive(id) -> Promise<void>`
| Field | Detail |
|-------|--------|
| **Purpose** | Soft-delete an agent. |
| **Errors** | 400 if it is the default (`AGT_006`), else `AGT_004`. |
| **Side Effects** | `DELETE /api/agents/{id}`. |

#### `listConnectors(agentId) -> Promise<AgentConnector[]>` · `attachConnector(agentId, payload)` · `updateConnector(agentId, bindingId, payload)` · `detachConnector(agentId, bindingId)`
| Field | Detail |
|-------|--------|
| **Purpose** | CRUD the agent↔connector binding rows. |
| **Inputs** | `AttachAgentConnectorPayload {mcpConnectorId, selectedTools?}`, `UpdateAgentConnectorPayload {selectedTools}`. |
| **Output** | `AgentConnector` / `AgentConnector[]` / `void`. |
| **Side Effects** | `GET/POST /api/agents/{id}/connectors`, `PATCH/DELETE …/{bindingId}`. |
| **Invariants** | `selectedTools` null/empty = all of the connector's enabled tools. |

### `KnowledgeService` / `KnowledgeRepository` (added methods)

#### `listAgentLibraries(agentId)` · `attachAgentLibrary(agentId, payload: AttachLibraryPayload)` · `detachAgentLibrary(agentId, bindingId)`
| Field | Detail |
|-------|--------|
| **Purpose** | CRUD the agent↔knowledge-library binding rows. |
| **Output** | `AgentKnowledgeLibrary[]` / `AgentKnowledgeLibrary` / `void`. |
| **Side Effects** | `GET/POST /api/agents/{id}/knowledge-libraries`, `DELETE …/{bindingId}`. |

### Hooks (react-query)

| Hook | Query/Mutation | Key | Invalidates |
|------|----------------|-----|-------------|
| `useAgents` | query | `['agents']` | — |
| `useDefaultAgent` | query | `['agents','default']` | — |
| `useDefaultAgentTemplate` | query | `['agents','default-template']` | — |
| `useCreateAgent` | mutation | — | `['agents']`, `['agents','default']` |
| `useUpdateAgent` | mutation | — | `['agents']` |
| `useSetDefaultAgent` | mutation | — | `['agents']`, `['agents','default']` |
| `useArchiveAgent` | mutation | — | `['agents']`, `['agents','default']` |
| `useAgentConnectors` | query | `['agents',id,'connectors']` | — |
| `useAttach/Update/DetachAgentConnector` | mutation | — | `['agents',id,'connectors']` |
| `useAgentKnowledge` | query | `['agents',id,'knowledge-libraries']` | — |
| `useAttach/DetachAgentKnowledge` | mutation | — | `['agents',id,'knowledge-libraries']` |

Nested binding queries are `enabled: !!agentId` (disabled in create mode).

## 6. Error Handling Strategy

| Error | Layer | Propagation |
|-------|-------|------------|
| `AGT_001` load agents | view/hook | catalog message on query error |
| `AGT_002` duplicate handle (409) | view | map from AxiosError status; prefer backend `detail` |
| `AGT_003` save failed | view | generic save fallback |
| `AGT_004` archive failed | view | — |
| `AGT_005` set-default failed | view | — |
| `AGT_006` default protected (400) | view | shown on archive/deactivate attempts |
| `AGT_007` invalid handle (422) | view | client-side regex pre-check + server fallback |

Repositories collapse only the documented `getDefault` 404→null; everything else
propagates as `AxiosError` and is mapped to a catalog code at the view, preferring
the backend `detail` string when present.

## 7. Configuration & Constants

| Constant | Source | Description |
|----------|--------|-------------|
| `API_NAME_RE` | `views/settings/AgentsView/constants.ts` | `^[a-z][a-z0-9-]*$` handle validation. Library-style literal regex — documented, not inlined in logic. |
| `AGT_*` messages | `constants/errors.ts` | User-facing error catalog entries. |
| Endpoint paths | repository methods | All relative to the axios `baseURL` (includes `/api`). |

No model names, hosts, or tunables are hardcoded; defaults for a new agent come
from the backend's `default-template`.

## 8. Testing Plan

| Test | Type | What It Verifies |
|------|------|-----------------|
| `AgentRepository.*` | unit | each endpoint's method/path/body mapping (mock network); `getDefault` 404→null |
| `mapAgent` / `mapAgentConnector` | unit | snake_case ↔ camelCase fidelity |
| Knowledge agent-binding methods | unit | the three added endpoints |
| `useAgents` & mutation hooks | unit | query keys + invalidation sets |
| handle validation | unit | `API_NAME_RE` accepts/rejects boundary cases |

(Tests are TD-003 scope — tracked, to be delivered with the testing pass.)

## 9. Dependencies & External Integrations

None new. Reuses the shared axios client + native HTTP adapter, existing UI
primitives (dialog, select, input, textarea, label, badge, card, confirm-button),
`EntityIcon` (`agents`), and the Connectors/Tools + Knowledge features for the
attach pickers (`useMcpConnectors`, `useTools`, `useKnowledgeLibraries`).

## 10. Open Questions / Risks

- [x] **Resolved:** Onboarding default-agent affordance enforces nothing for now
      (chat is the next feature).
- [x] **Resolved:** Tool entry stays a free-form chip input; autocomplete vs
      `/api/tools` tracked as [TD-010](../../TODO.md#td-010--agent-tool-entry-autocomplete-against-apitools).
- [ ] Model / temperature selection deferred — [TD-011](../../TODO.md#td-011--model--temperature-selection-on-standalone-agents).
- [ ] Backend `detail` envelope shape (`response.data.detail`) is assumed consistent
      with the other features.

---

_Link to Feature Spec: [features/agents.md](../features/agents.md)_
