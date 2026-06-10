# Technical Spec: Conversation Usage & Cost

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-10
> **Last Updated**: 2026-06-10

---

## 1. Architecture

A read-only aggregate threaded through the existing conversation Clean-Architecture
layers, surfaced by one react-query hook and rendered as a sidebar chip.

```
ConversationListItem
  → useConversationUsage(id)            // ['conversations', id, 'usage'], 60s stale
  → ConversationService.getUsage(id)
  → ConversationRepository.getUsage(id) // GET /api/conversations/{id}/usage
       └ 404 → zero-state aggregate
  → mapConversationUsage (snake→camel)
  → formatUsd(totalCostUsd)             // chip text, hidden when 0
```

## 2. Backend contract

`GET /api/conversations/{conversation_id}/usage` (Bearer auth) →
`ConversationUsageResponse`:

```
conversation_id: UUID
records: UsageRecordResponse[]          // { id, user_model_id, node_id,
                                        //   input_tokens, output_tokens,
                                        //   cost_usd, created_at }
total_input_tokens:  int
total_output_tokens: int
total_cost_usd:      Decimal            // serialised as a STRING
```

`cost_usd` / `total_cost_usd` are `Decimal` serialised as strings (e.g.
`"0.001050"`) to preserve precision. `404` = not found **or** not owned
(indistinguishable by design). Cost is computed and stored server-side at call
time from `model_pricing`; the client never prices.

## 3. Domain types

`domain/types/conversation.types.ts`:

- **`UsageRecord`** — `{ id, userModelId, nodeId, inputTokens, outputTokens,
  costUsd: string, createdAt }`. `costUsd` is kept as a **string** (precision).
- **`ConversationUsage`** — `{ conversationId, records: UsageRecord[],
  totalInputTokens, totalOutputTokens, totalCostUsd: string }`.

## 4. Mapper

`infrastructure/repositories/mappers/mapConversation.ts`:

- `ApiUsageRecordResponse` / `ApiConversationUsageResponse` (raw snake_case).
- `mapConversationUsage(raw)` → `ConversationUsage` (maps `records[]` via a private
  `mapUsageRecord`; cost strings pass through unparsed).

## 5. Port / service / repository

- **`IConversationRepository.getUsage(id): Promise<ConversationUsage>`** — doc'd
  to return the zero-state aggregate on 404.
- **`ConversationService.getUsage`** — one-line delegation.
- **`ConversationRepository.getUsage`** — `GET …/usage` → `mapConversationUsage`;
  catches a 404 axios error and returns `{ conversationId, records: [],
  totalInputTokens: 0, totalOutputTokens: 0, totalCostUsd: '0' }`. The guard lives
  in the repo to match the existing `get`→`null` / `getMessages`→`[]` convention
  (the web app guards in the hook instead — a no-impact location difference).

## 6. Hook

`presentation/hooks/conversations/useConversations.ts`:

- `USAGE_KEY = (id) => ['conversations', id, 'usage']`.
- **`useConversationUsage(id)`** — `useQuery<ConversationUsage>`, `staleTime:
  USAGE_STALE_MS` (60s, from `constants/chat.ts`), `enabled: Boolean(id)`. No
  refetch interval; **not** invalidated on run-finalize (matches the web app — the
  chip catches up within the window rather than fanning out a refetch per cached
  row each turn).

## 7. UI

`presentation/views/chat/components/ConversationListItem.tsx`:

- Reads `useConversationUsage(conversation.id)`; `totalCost =
  parseFloat(usage.totalCostUsd)`; `showCost = totalCost > 0`.
- The trailing region is a `relative` wrapper: the chip is an `absolute`,
  `pointer-events-none` `<span>` (`formatUsd(totalCost)`) that fades on
  `group-hover` / `group-focus-within`, while the inline action row fades in — so
  chip and actions share the slot with no layout shift. `formatUsd`
  (`domain/utils/formatCost.ts`) already existed (shared with provider pricing).

## 8. Deviations from the web app

All no-functional-impact (logged in `docs/web-app-parity.md` §4/§5): chip overlays
the desktop's **inline** action row vs. the web app's absolute kebab; the 404
zero-state guard lives in the **repository** vs. the web app's hook; `staleTime` is
the named `USAGE_STALE_MS` constant vs. an inline `60_000`.

## 9. Deferred / notes

`records[]` + token totals are fetched but not rendered (web-app parity). A future
breakdown panel can consume them with no data-layer change. Live verification needs
a running backend + a cost-incurring conversation.
