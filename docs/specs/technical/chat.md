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
  `abortRun` (client-side only).
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
- Mutations log via the error catalog (`CHT_005` update, `CHT_006` delete) on
  `onError`; the delete flow navigates away first + invalidates only list keys to
  avoid 404-ing still-mounted per-conversation observers.
- New catalog codes: `CHT_001`–`CHT_007`, `STREAM_001`.

## 7. Deferred / known gaps

See `docs/TODO.md`: `TD-012` attachments+PDF, `TD-013` slash/flow dispatch,
`TD-014` HITL episodes (restores `attach`/`replaceMessages`), `TD-015` message
actions (restores `truncateFrom`/`branch`/`sendWithModel`), `TD-016` usage
(restores `getUsage`), `TD-017` Streamdown weight, `TD-018` historical tool-call
rehydration, `TD-019` KaTeX/sketchon. Unit tests for the new repo/mappers/hooks
fold into `TD-003`. Live end-to-end SSE verification requires the running backend
+ a valid Auth0 token (cannot be exercised from the dev box).
