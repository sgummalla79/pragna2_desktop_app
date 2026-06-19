# Technical Spec: In-chat Agent Switcher

> **Status**: In Review
> **Author**: Suman Gummalla
> **Created**: 2026-06-18
> **Last Updated**: 2026-06-18
>
> Tracker: pragna2-tracker #147. BE contract verified against the running
> `:8001` all-in-one image (OpenAPI), not assumed from the issue text.

---

## 1. Overview

A near-exact parallel of the existing **model picker** path. The conversation
gains an `agentId` field; an `AgentPicker` composer control PATCHes
`{ agent_id }` on the conversation via a new `useSetConversationAgent` mutation;
an `AgentBadge` renders per-message persona attribution from the message's
`agentId`. Attribution prefers the message's persisted `agentId`; only the
in-flight (streaming) turn falls back to the conversation's current active agent
— a completed turn with no stored agent shows nothing rather than being
re-labeled when the user later switches agents (a switch must not rewrite past
turns). No new runtime/platform concerns — pure React + data-layer wiring.

## 2. Verified BE contract (`:8001`)

- **Switch**: `PATCH /api/conversations/{id}` with body `{ "agent_id": "<uuid>" }`
  (the recommended option won; there is **no** `/active-agent` route).
  `UpdateConversationRequest` accepts `agent_id: string|null`.
- **Conversation shape**: `ConversationResponse` includes `agent_id: string|null`.
- **Message shape**: `MessageResponse` includes `agent_id: string|null` (per-turn
  persona attribution) alongside `user_model_id`.
- **Errors** (from the route docstring): `agent_id` not owned → **404**;
  agent archived/inactive → **400**; open episode → **409** (mid-run guard).
- **Agents list**: `GET /api/agents` (already wired via `useAgents`); each `Agent`
  has `id`, `displayName`, `isDefault`, `status` (`active|inactive|archived`).

## 3. Architecture & Layer Placement

Clean-architecture layers touched (FE):

- **Domain** (`src/domain/types/conversation.types.ts`): add `Conversation.agentId`,
  `PersistedMessage.agentId`, `UpdateConversationPayload.agentId`. No new entities.
- **Application / Adapters boundary** (`infrastructure/repositories/mappers/mapConversation.ts`):
  map `agent_id` on conversation + message wire shapes. `ConversationRepository.update`
  already forwards arbitrary `UpdateConversationPayload` fields — no repo change needed.
- **Presentation**:
  - `useSetConversationAgent` mutation (hooks/conversations).
  - `AgentPicker` composer control + `AgentBadge` attribution component.
  - `ChatInput` gains a narrow `leadingControls` slot (Open/Closed — it stays
    agent-agnostic); `ChatSessionView` wires the picker + per-message agent id.

## 4. Data Flow

```
[AgentPicker.onAgentChange(agentId)]
  -> useSetConversationAgent.mutate({ id, agentId })
    -> ConversationService.update(id, { agentId })
      -> ConversationRepository.update  (PATCH /conversations/{id} { agent_id })
        -> invalidate conversation list + single-lookup  -> picker reflects new agent

[next user turn] -> existing useChatSession.send -> BE resolves conversation.agent_id

[reload] GET /messages -> mapMessage(agent_id -> agentId)
  -> ChatSessionView builds persistedAgentById -> <AgentBadge agentId> per assistant turn
```

## 5. Module & File Layout

```
src/
  domain/types/
    conversation.types.ts            (+ agentId on Conversation, PersistedMessage, UpdateConversationPayload)
  infrastructure/repositories/mappers/
    mapConversation.ts               (+ agent_id on Api*Response + map both)
  presentation/
    hooks/conversations/
      useConversationMutations.ts    (+ useSetConversationAgent)
    views/chat/
      components/
        AgentPicker.tsx              (new — mirrors ModelPicker)
        AgentBadge.tsx               (new — mirrors ModelBadge)
        ChatInput.tsx                (+ leadingControls slot in the left cluster)
        ChatMessage.tsx              (+ userAgentId prop → renders AgentBadge by ModelBadge)
      ChatSessionView.tsx            (wire AgentPicker as leadingControls; persistedAgentById)
      components/__tests__ (or *.test.tsx) AgentPicker + AgentBadge
```

## 6. Method Specifications

### `useSetConversationAgent()`

| Field | Detail |
|---|---|
| **Purpose** | Mutation to switch a conversation's active agent (the mid-chat switch). |
| **Inputs** | `{ id: string; agentId: string }` |
| **Output** | `Conversation` (updated row) |
| **Errors** | BE 400 (archived/inactive), 404 (not owned), 409 (open episode) propagate as the axios error to `onError` at the call site; UI logs + surfaces and invalidates to reconcile. |
| **Side Effects** | `invalidateConversationListQueries(qc, { conversationId: id })` on success (list + single-lookup only — never the messages subtree, matching the sibling mutations). |
| **Invariants** | Caller only enables it for non-flow conversations and when not running. |

### `AgentPicker({ agentId, onAgentChange })`

| Field | Detail |
|---|---|
| **Purpose** | Inline composer picker of the active agent (shadcn `Select`), mirroring `ModelPicker`. |
| **Inputs** | `agentId: string \| null` (active id; parent owns persistence); `onAgentChange: (agentId: string) => void`; `disabled?: boolean` (mid-run). |
| **Output** | Borderless pill `Select`; renders `null` while agents load or none exist. |
| **Behaviour** | Lists `status === 'active'` agents from `useAgents()`. Soft-defaults the trigger to the user's default (`isDefault`) — then first active — when `agentId` is null/unresolved, so the label is never blank. |
| **Side Effects** | None (pure; parent persists). |

### `AgentBadge({ agentId })`

| Field | Detail |
|---|---|
| **Purpose** | Quiet "by &lt;agent&gt;" attribution under an assistant turn. |
| **Inputs** | `agentId: string \| null \| undefined` |
| **Output** | Muted span, or `null` when the id is falsy / unresolved in the warm `useAgents` cache (graceful, like `ModelBadge`). |

### `ChatInput` — new `leadingControls?: ReactNode`

| Field | Detail |
|---|---|
| **Purpose** | Render extra controls in the **left** cluster, right after the attach-file button (where the agent picker goes). Keeps `ChatInput` agent-agnostic (Interface Segregation / Open-Closed). |
| **Inputs** | `leadingControls?: ReactNode` |
| **Output** | Rendered inside the existing `flex-wrap` left cluster → wraps at narrow widths (responsive gate). |

## 7. Error Handling Strategy

| Error | Layer | Propagation |
|---|---|---|
| Axios 400 (archived/inactive agent) | Adapter → hook | `onError` at call site → `logger.fromError('CHT_005:set-agent', e)` + user-facing message; query invalidation reconciles the picker to server truth. |
| Axios 404 (agent not owned) | Adapter → hook | Same path; no optimistic state to roll back (we don't optimistically pin the agent — the picker reflects the query). |
| Axios 409 (open episode) | Adapter → hook | Prevented in UI (picker `disabled` while running); if hit, surfaced + reconciled. |
| Unresolved `agentId` in cache | Presentation | `AgentPicker` soft-defaults label; `AgentBadge` renders nothing. |

No silent fallbacks: every failure is logged with a `CHT_005:*` code (matching the
sibling conversation-mutation error codes) and surfaced.

## 8. Configuration & Constants

| Constant | Source | Description |
|---|---|---|
| Endpoint path `/conversations/{id}` | existing `ConversationRepository` (axios `baseURL` = `API_BASE_URL`) | No new URL literal — reuses `conversationService.update`. |
| Active-status filter | `AgentStatus` (`'active'`) from `agent.types.ts` | Reuse the domain type, no string literal in logic beyond the type-driven compare. |
| Error code `CHT_005:set-agent` | `src/constants/errors.ts` pattern | Matches `set-model` / `set-thinking` codes. |

No hard-coded model/agent names, URLs, or limits introduced.

## 9. Testing Plan

| Test | Type | What It Verifies |
|---|---|---|
| AgentPicker renders active agents, hides archived/inactive | unit (Vitest/RTL) | Only `status==='active'` listed; trigger shows active/default. |
| AgentPicker soft-defaults when `agentId` null | unit | Label falls back to `isDefault` agent, never blank. |
| AgentPicker `disabled` while running | unit | Trigger is disabled; `onAgentChange` not callable. |
| AgentPicker calls `onAgentChange` on select | unit | Selecting an item fires the callback with the agent id. |
| AgentBadge resolves id → "by <name>" | unit | Renders display name; renders nothing on null / cache miss. |
| mapConversation / mapMessage map `agent_id` | unit (if mapper tests exist) | Wire `agent_id` → `agentId`. |
| `scenario-31-agent-switch` — multiple mid-chat switches + per-turn attribution survives reload | e2e (live) | Against `:8001`+seeded model: new chat opens on default; each switch PATCHes `conversations.agent_id` (DB-asserted); after reload each turn's `AgentBadge` (`data-testid="agent-badge"`) shows the persona that produced it (default / Bravo / default). Self-skips without a real LLM key. Verified green (OpenAI gpt-4o). |

## 10. Dependencies & External Integrations

- BE #145 (verified live on `:8001`). No new npm deps. No platform/Tauri code, so
  no `lint:platform` surface change (still run the gate). No Rust changes.

## 11. Open Questions / Risks

- [ ] Badge layout: agent + model vs agent-only — settle in review.
- [ ] Whether to optimistically update the picker label before the PATCH resolves
      (avoid a flash). Initial cut: rely on the conversation query + invalidation
      (no optimism) for correctness; add optimism only if a flash is observed.

---

_Link to Feature Spec: [features/agent-switcher.md](../features/agent-switcher.md)_
