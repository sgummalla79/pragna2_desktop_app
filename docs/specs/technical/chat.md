# Technical Spec: Chat (Phase 1 — core streaming chat)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Architecture

Chat follows the app's clean-architecture layering:

```
domain/types/conversation.types.ts
  → application/ports/IConversationRepository.ts
  → application/services/ConversationService.ts
  → infrastructure/repositories/ConversationRepository.ts (+ mappers)
  → presentation/hooks/conversations/* + presentation/views/chat/*
```

Two transports are involved:
- **REST (axios)** for conversation CRUD + message history, via the shared
  `axiosClient` (native HTTP adapter in Tauri; `/api` baseURL).
- **SSE (AG-UI)** for the streaming turn itself, via a custom agent (§2).

## 2. Streaming transport (the enabler)

The web app drives chat with `@ag-ui/client`'s `HttpAgent`, which calls the
webview's **global `fetch`**. In the packaged Tauri webview that fails twice: the
CORS policy blocks the cross-origin backend, and a relative `/api` URL can't
resolve against the non-HTTP webview origin. We keep the library (for its proven
event parsing/accumulation) and swap only the transport:

- **`infrastructure/http/tauriFetch.ts`** — `httpFetch`: Tauri
  `@tauri-apps/plugin-http` `fetch` in the desktop runtime (streams the response
  body incrementally via a `ReadableStream`; honours `init.signal`), falling back
  to global `fetch` in a plain browser. Mirrors `axiosClient`'s `isTauriRuntime()`
  switch.
- **`infrastructure/agui/tauriHttpRequest.ts`** — `runHttpRequestViaTauri(url,
  init): Observable<HttpEvent>`: a faithful port of the library's internal
  `runHttpRequest`, but issuing via `httpFetch`. Emits one `headers` event then
  one `data` event per streamed chunk; maps non-2xx to a thrown error carrying the
  parsed payload. `HttpEvent` is re-declared locally (the library doesn't export
  it) and is byte-compatible with the parser.
- **`infrastructure/agui/TauriHttpAgent.ts`** — `class TauriHttpAgent extends
  HttpAgent` overriding the single `run(input)` seam:
  `transformHttpEventStream(runHttpRequestViaTauri(this.url, this.requestInit(input)))`.
  `requestInit()` (inherited) still builds the POST body, `Authorization` /
  `Accept: text/event-stream` headers, and the abort `signal`; `abortRun()`
  aborts that signal, which propagates through `httpFetch` to the Rust side.

**rxjs pin:** `@ag-ui/client` depends on `rxjs@7.8.1`. Our direct dep is pinned to
the same `7.8.1` so the `Observable` types unify (two copies → incompatible
`Observable<T>` and a `TS2416` on the `run` override).

**`PRAGNA_BASE_URL`** (`constants/api.ts`) is derived **absolutely** as
`${API_BASE_URL}/pragna` (no Vite proxy in the packaged webview), overridable via
`VITE_PRAGNA_BASE_URL`. The streaming POST targets the same backend host already
allow-listed for the axios adapter in `capabilities/default.json` — no capability
change.

## 3. Data layer

- **`conversation.types.ts`** — `Conversation`, `PersistedMessage`,
  `CreateConversationPayload`, `UpdateConversationPayload`, `MessageRole`,
  `FinishReason`, `PersistedToolCall`. (Attachments, usage, branch/truncate types
  are deferred.)
- **`IConversationRepository` / `ConversationService`** — `list`, `get`, `create`,
  `getMessages`, `update`, `delete`. Thin service pass-through, registered as
  `conversationService` in the DI container (`ServiceContext`/`ServiceProvider`).
- **`ConversationRepository`** (axios) — endpoints (resource-relative under
  `/api`): `GET /conversations` (`?limit&offset&pinned`), `GET /conversations/{id}`
  (404 → `null`), `POST /conversations` (idempotent on `thread_id`),
  `GET /conversations/{id}/messages` (404 → `[]`), `PATCH /conversations/{id}`,
  `DELETE /conversations/{id}`. Mappers in `mappers/mapConversation.ts`
  (snake_case ↔ camelCase; the API `attachments` array is ignored in Phase 1).

## 4. Presentation

- **Hooks** (`presentation/hooks/conversations/`): `useConversations(page)` +
  `usePinnedConversations` (keys `['conversations', <page>]` / `['conversations',
  'pinned']`), `useConversation(id)` (`['conversations', id, 'single']`),
  `useConversationMessages(id)` (`['conversations', id, 'messages']`,
  `staleTime: Infinity`), and `useConversationMutations` (rename / set-model /
  set-pinned / set-thinking / delete). `invalidateConversationListQueries` is a
  narrow predicate that touches only list pages + the named single-lookup, never
  the per-conversation message subtree.
- **`views/chat/hooks/useChatSession.ts`** — wraps one `TauriHttpAgent` per
  `(accessToken, threadId)`. Installs an `AgentSubscriber` that mirrors
  `agent.messages` into React state and handles AG-UI events:
  `TEXT_MESSAGE_{START,CONTENT,END}`, `TOOL_CALL_{START,ARGS,END,RESULT}`, and
  `CUSTOM` (`on_progress` → live label, `title_updated` → list invalidate,
  `model_attribution` → rolling producer-model id stamped onto the streaming
  message id, `reasoning_content` → thinking trace). Exposes `{ messages, status,
  error, progressLabel, send, sendWithOverrides, stop, streamingMessageIds,
  streamingModelByMessageId }`. On `RUN_FINISHED` it invalidates the list +
  this conversation's message log. `send` appends a user turn and calls
  `runAgent`; `sendWithOverrides` appends `?user_model_id=` / `?thinking_enabled=`
  for the first turn then restores the base URL on finalize; `stop` calls
  `abortRun` (client-side only). **Failed-turn rollback (pragna2-tracker #111 /
  CF-015):** the optimistic user push is tracked (`pendingUserIdRef` +
  `lastRunFailedRef`); because a failed run is never reconciled to the persisted
  log (`useReconcileMessages` skips while in-memory is ahead — CF-013b), its
  un-persisted copy would otherwise linger and be re-sent on every retry,
  duplicating the message N× in the outgoing history. `send` drops that orphan
  via `utils/messageDedup.pruneOrphanedOptimisticMessage` before pushing the new
  turn, so exactly one copy of each user message is sent per turn.
- **`views/chat/hooks/useChatModels.ts`** — chat-eligible models
  (`enabled && availableForChat && !archived`) from the shared `useModels` cache.
  Single source for the picker, the composer gating, and the landing default.
- **Views**: `ChatView` (responsive shell: rail + drawer + `<Outlet/>`),
  `ChatLandingView` (greeting + composer; eager-create → stash → navigate),
  `ChatSessionView` (loads history, then mounts an inner `ChatConversation` keyed
  by id so the agent seeds with history at creation). Components: `ChatSidebar`,
  `ConversationList`, `ConversationListItem`, `ChatInput`, `ModelPicker` (shadcn
  `Select`), `ThinkingToggle`, `ChatMessage`, `MarkdownMessage` (Streamdown),
  `ReasoningPanel`, `ToolCallBadge`, `ModelBadge`, `ThinkingStrip`, `SetupBanner`.
- **Agent-activity rendering (FEAT-002, claude.ai-style).** The transcript never
  shows raw tool output. `ChatSessionView` groups the flat message list with
  `utils/assistantTurns.groupChatMessages` into user/system messages + assistant
  **turns**. `AssistantTurn` folds each turn's reasoning + interim narration +
  **every** tool call into **one** collapsible `ActivityDisclosure` (the shared
  summary → Clock → `Working…`/`Done` timeline; `ReasoningPanel` is a thin wrapper
  over it). The umbrella is the complete audit log of the turn's work, so it
  surfaces every tool call — plain MCP tools **and** output/interactive tools
  (document `create_pdf_*`, propose-flow) — not only plain ones (nexus-kit-tracker
  #225 / CF-046). The **final answer** (last assistant text with no trailing tool
  call) and **outputs/interactive cards** (generated-document PDFs,
  `FlowProposalCard`, HITL forms) render **outside** the umbrella via `ChatMessage`
  (new `hideReasoning` prop — reasoning lives in the umbrella) — so an output tool
  appears BOTH as an umbrella activity row (the audit log) and as its card (the
  deliverable). **Regenerate** is offered only on a turn's final text answer, never
  on a tool-call row (an assistant message carrying `tool_calls`): regenerating a
  mid-turn row re-runs from a mid-turn boundary and fails (nexus-kit-tracker #226 /
  CF-047). Tool names are
  humanized by `utils/toolDisplay.toolDisplayLabel` (curated map in
  `constants/toolLabels` + generic humanizer); args show as readable key/value
  lines, never raw JSON; `tool`-role messages are suppressed (their content is the
  raw result payload). Agent **flows** are out of scope — their stage UI is
  unchanged. `ThinkingStrip` is **persistent** (CF-017): a static brand logo when
  idle ("ready for your next message"), spinning + label while running.
- **Markdown renderer** (`MarkdownMessage`, ported faithfully from the web app):
  Streamdown owns GFM + Shiki + KaTeX + Mermaid; we add two things and configure
  three:
  - `normalizeMathDelimiters` (`utils/markdownStreaming.ts`) rewrites `\(…\)`/`\[…\]`
    → `$…$`/`$$…$$` so remark-math/KaTeX render math from any provider; code spans
    are masked first so literals aren't rewritten.
  - `rehypeSketchon` (`utils/rehypeSketchon.ts`) is appended **after**
    `defaultRehypePlugins` (so it runs past rehype-harden) and swaps a
    ```` ```sketchon ```` block for a `<sketchon-diagram spec="…">` element, rendered
    by `SketchonDiagram` via Streamdown's `components` map. `SketchonDiagram`
    parses/validates the spec (`@sgummalla-works/sketchon`), renders to SVG,
    **DOMPurify-sanitizes** it (SVG profile) before injection, and offers Copy-PNG /
    Download-SVG. It reads light/dark from the **`.dark` class** on the root element
    (the desktop's theme signal) — the web app reads `data-theme` (the one porting
    adaptation; see `web-app-parity.md`).
  - Config: `shikiTheme={SHIKI_THEMES}`, `controls={STREAMDOWN_CONTROLS}` (table/code
    + mermaid pan-zoom/fullscreen/copy/download), and a capture-phase wheel throttle
    (`MERMAID_ZOOM_WHEEL_THROTTLE`) so mermaid zoom is gradual. All literals live in
    `constants/markdown.ts`.
  - Streaming: `useSmoothStreamingText` reveals a growing prefix at a steady cadence
    (`STREAM_REVEAL_BASE_CPS`, bounded by `STREAM_REVEAL_MAX_LAG_SECONDS`) while
    `isStreaming` (threaded from `ChatMessage.streaming`); `mode='streaming'` +
    `parseIncompleteMarkdown` repair partial fences; a `.chat-markdown--animate`
    per-block fade-in completes the reveal. `katex/dist/katex.min.css` is imported in
    the component; `katex` is pinned as an explicit dep (Streamdown bundles it but
    pnpm's strict layout doesn't hoist the CSS path).
- **Handoff** (`hooks/initialMessageHandoff.ts`): the landing's first message is
  written to `sessionStorage` under the new id; `ChatConversation` reads it once,
  clears it, and fires `sendWithOverrides`.

## 5. Conversation lifecycle / data flow

1. **Create:** landing generates a UUID, `conversationService.create({threadId,
   userModelId, thinkingEnabled})`, invalidates `['conversations']`, stashes the
   message, navigates to `/chat/{id}`.
2. **First turn:** `ChatConversation` consumes the stash → `sendWithOverrides` →
   `TauriHttpAgent.runAgent()` streams the reply.
3. **Stream:** subscriber callbacks update React state per event; `ThinkingStrip`
   shows `progressLabel`; the streaming assistant id maps to its producer model.
4. **Finalize:** list + message-log queries invalidated (auto-title + attribution
   pickup).
5. **Resume:** `useConversationMessages` history → `persistedToAGUIMessage` seeds
   the agent on mount (keyed remount per conversation).

## 6. Error handling

- Repo maps 404 → `null` (`get`) / `[]` (`getMessages`); other axios errors
  propagate.
- `useChatSession`: `AbortError` (Stop/navigation) resets silently; other run
  failures set `status='error'` + an error string and log `CHT_004`.
- Two distinct run-failure paths (CF-016): a *thrown* error (connection drop /
  abort rejection) → `onRunFailed`; a backend-emitted **in-band `RUN_ERROR`
  event** (a background run that failed mid-stream, e.g. an LLM 4xx) →
  `onRunErrorEvent`. ag-ui delivers the latter as a non-throwing event, so it
  must be handled separately or the turn goes silently idle with no reply.
  `onRunErrorEvent` surfaces the backend's sanitized message (fallback
  `CHT_004`); a `RUN_ERROR` with `code:'abort'` unwinds silently like the
  thrown `AbortError`. The abort-vs-error decision is the pure
  `utils/runError.classifyRunErrorEvent`.
- Mutations log via the error catalog (`CHT_005` update, `CHT_006` delete) on
  `onError`; the delete flow navigates away first + invalidates only list keys to
  avoid 404-ing still-mounted per-conversation observers.
- New catalog codes: `CHT_001`–`CHT_007`, `STREAM_001`.

## 7. Deferred / known gaps

See pragna2-tracker. **Shipped since Phase 1:** pragna2-tracker TD-013 slash/flow dispatch
(per-turn URL dispatch, see `slash-commands.md`); pragna2-tracker TD-014 HITL `ask_user`
pause/resume **and** flow proposals — the run streams natively via
`TauriHttpAgent.runRaw` through ag-ui's `apply`/`processApplyEvents`, so it does
**not** use the web app's `replaceMessages` resync (see `hitl-episodes.md`); and
pragna2-tracker TD-018 historical tool-call rehydration (`persistedToAGUIMessage` carries
`tool_calls`; `toChatMessage` rebuilds badges from the seed — name + args; the
persisted result string isn't on the AG-UI shape — and `ConversationRepository.getMessages`
sorts the log by `messageIndex` so a tool turn's two same-`created_at` assistant rows
keep a stable order, nexus-kit-tracker #224 / CF-045); and pragna2-tracker TD-012 **attachments +
viewer** (session view — upload + `forwardedProps.attachment_ids` + persisted-turn
chips + an authed-blob image/PDF viewer; needed a `blob` `responseType` in the
native adapter — see `attachments.md`; landing-composer uploads deferred).
and pragna2-tracker TD-015 **message actions** (edit/branch/regenerate/continue — `truncateFrom`
+ `branch` conversation methods, `sendWithModel`, `MessageActions`; also wires the
pragna2-tracker TD-006 chat-action prefs — see `message-actions.md`); and the **full markdown
renderer** — pragna2-tracker TD-019 KaTeX math + Mermaid/`sketchon` diagrams + smooth-streaming
reveal, with pragna2-tracker TD-017 resolved as **keep Streamdown** (the heavy diagram/grammar
chunks are code-split — verified: the eager `index` bundle is unaffected; mermaid,
cytoscape, wasm, wardley, and language grammars each build as separate lazy
chunks; see `chat-markdown.md`); and pragna2-tracker TD-016 **usage + cost** (see
`conversation-usage.md`) — `ConversationUsage`/`UsageRecord` types,
`mapConversationUsage` (snake→camel; `cost_usd`/`total_cost_usd` kept as strings to
preserve `Decimal` precision), `getUsage` on the port/service/repo (404 → zero-state
aggregate, matching the repo's `get`/`getMessages` convention), and a
`useConversationUsage` hook (key `['conversations', id, 'usage']`, `USAGE_STALE_MS`
60s, `enabled` on id). The sidebar `ConversationListItem` renders a quiet
running-total chip via `formatUsd` (already present), shown only when cost > 0 and
faded on hover/focus. Usage is **not** invalidated on run-finalize (matches the web
app — the chip catches up within the staleness window rather than refetching every
cached row per turn). **Nothing from the Phase-1 chat non-goals remains deferred.**
Unit tests for the new repo/mappers/hooks fold into pragna2-tracker TD-003. Live end-to-end SSE
verification requires the running backend + a valid Auth0 token (cannot be exercised
from the dev box).
