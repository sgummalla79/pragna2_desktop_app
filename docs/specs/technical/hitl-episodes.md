# Technical Spec: HITL Episodes (human-in-the-loop forms)

> **Status**: Implemented (Phase A). Flow proposals deferred.
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Architecture & the key decision

The defining choice: **resume streams through the chat agent transport**, not a
buffer-then-poll path. The web app buffers `/resume` as opaque text and polls
the episodes list, then `replaceMessages` — a documented two-sources-of-truth
debt. We avoid it by construction: the resume (and episode-start) runs go through
the **same** ag-ui apply/subscriber pipeline as a chat turn, so messages update
live and a second `on_interrupt` surfaces natively.

This is feasible because ag-ui's `AbstractAgent` exposes `protected apply()` +
`protected processApplyEvents()` (subclass-visible), and `transformChunks` /
`verifyEvents` / `transformHttpEventStream` are exported. Our `TauriHttpAgent`
adds a `runRaw()` that POSTs a non-`RunAgentInput` body to a conversation-episode
URL and pipes the SSE reply through that exact pipeline.

```
run pauses → onCustomEvent('on_interrupt') stashes schema + sets sawInterrupt
           → run finalizes → resolveOpenEpisode() GETs episodes?limit=1
           → status awaiting_user → setPendingInterrupt({episodeId, schema})
ChatSessionView renders <HITLFormCard schema/> ; composer disabled
submit → submitInterrupt(form,text) → agent.runRaw(resumeUrl,{form,text})
       → apply()/processApplyEvents() → live messages + maybe another on_interrupt
```

## 2. Episode read layer (REST)

- **`domain/types/episode.types.ts`** — `EpisodeStatus`, `EpisodeSnapshot`
  (camelCase), `EpisodeListPage`, `CreateEpisodePayload`, `ResumeEpisodePayload`,
  and the `AskUserSchema` / `AskUserField` / `AskUserFieldType` **passthrough**
  types (kept snake_case — they're the backend's `ask_user` schema, declared
  `additionalProperties: true`, so re-mapping would be lossy).
- **`IEpisodeRepository`** (`list`, `get` only — start/resume are SSE, not here)
  → **`EpisodeRepository`** (`GET /conversations/{id}/episodes[?limit&offset]`,
  `GET …/{episodeId}`) + **`mapEpisode`** / **`mapEpisodeListPage`**.
- **`EpisodeService`** (thin) registered as `episodeService` in DI
  (`ServiceContext` + `ServiceProvider`).

## 3. Transport seam — `TauriHttpAgent.runRaw`

```ts
async runRaw(url: string, body: unknown, signal?: AbortSignal): Promise<void>
```
- Builds `RequestInit` = `POST` + `{...this.headers, Content-Type, Accept:
  text/event-stream}` + `JSON.stringify(body)` + `signal`.
- `input = this.prepareRunAgentInput()` (subscriber-callback context only; the
  `body` is what's actually POSTed).
- Pipeline: `transformHttpEventStream(runHttpRequestViaTauri(url, init))` →
  `transformChunks(false)` → `verifyEvents(false)` → `this.apply(input, …,
  this.subscribers)` → `this.processApplyEvents(input, …, this.subscribers)`;
  awaited via `lastValueFrom(…, { defaultValue: undefined })`.
- Because it reuses the inherited `apply`/`processApplyEvents`, the registered
  `useChatSession` subscriber's event hooks fire identically to chat — so live
  text/tool-call/`on_interrupt` all work and `this.messages` stays canonical.

## 4. `useChatSession` HITL wiring

New option: none (uses `threadId` as the conversation id). New return members:
`pendingInterrupt: { episodeId, schema } | null`, `submitInterrupt(form, text)`,
`startEpisode(payload)`.

- **Detection**: `onCustomEvent` gains an `on_interrupt` branch → stashes
  `interruptSchemaRef` + sets `sawInterruptRef`. `onRunFinalized` calls
  `resolveOpenEpisodeRef.current()` when the flag is set. A `threadId` effect
  also calls it on mount (reopen a paused conversation).
- **`resolveOpenEpisode`**: `episodeService.list(threadId, {limit:1})`; if the
  newest episode is `awaiting_user`, `setPendingInterrupt({ episodeId,
  schema: interruptValue.schema ?? stashed })`; else clears it.
- **`runEpisodeStream(url, body, errCode)`**: shared helper for start/resume —
  manages status (`running`→`idle`/`error`), an `AbortController` in
  `rawAbortRef` (so `stop()` cancels it), calls `agent.runRaw`, then
  `resolveOpenEpisode()` again (second pause), and invalidates the conversation
  list + message-log queries in `finally`. Lifecycle is managed here because
  `runRaw` bypasses ag-ui's `runAgent` (so `onRunInitialized/Finalized` don't
  fire for these runs).
- **`submitInterrupt`** → `POST {API_BASE_URL}/conversations/{cid}/episodes/
  {episodeId}/resume` body `{ form, text }`; clears `pendingInterrupt` first.
- **`startEpisode`** → `POST {API_BASE_URL}/conversations/{cid}/episodes` body
  `{ flow_api_name, seed_summary, seed_user_input }`. (Built now; consumed by
  Phase B proposals.)
- **`send` guard**: a `pendingInterruptRef` blocks a normal chat turn while a
  form is open (the backend 409s on an open episode).

## 5. Form subsystem (`components/hitl/`)

- **`validators.ts`** — `initialFormValues`, `validateField`, `validateForm`,
  `isFormValid`, `coerceForSubmit`, `FieldErrors`. Ported from the web app; types
  imported from `episode.types` (not redefined). Mirrors the server guard for
  friendly inline messages (server remains source of truth).
- **`FormField.tsx`** — polymorphic renderer; text/textarea/number/select use
  shadcn primitives, multiselect/checkbox/date/daterange use native inputs,
  `file` renders an unsupported hint (TD-012), unknown → text fallback.
- **`HITLFormCard.tsx`** — self-contained, internally controlled (values/touched/
  free-text seeded from the schema). On submit: marks all touched, validates,
  and calls `onSubmit(coerceForSubmit(values), allow_text_input ? text : '')`.
  Remounted per pause (keyed by `episodeId`) so a fresh interrupt resets it.

## 6. View wiring (`ChatSessionView`)

Pulls `pendingInterrupt` + `submitInterrupt` from `useChatSession`; renders
`<HITLFormCard key={episodeId} schema submitting onSubmit/>` at the end of the
transcript; disables the composer (`disabled={Boolean(pendingInterrupt)}`) with a
"complete the form" placeholder while paused.

## 7. Error handling

- `HITL_001` open-episode load (warn, non-blocking — no form), `HITL_002` resume,
  `HITL_003` start. AbortError on a raw run is a silent unwind (Stop/navigation),
  matching the chat path.

## 8. Phase B — flow proposals (shipped)

- **Detection** (`ChatMessage`): builds a `propose_flow_<apiName> → Flow` map from
  `useFlows`; a tool call matching a key renders `<FlowProposalCard flow call
  busy onAccept/>` instead of a `ToolCallBadge`.
- **`FlowProposalCard`**: shows the flow name + the call's `summary` arg + the
  flow description + an optional extra-context box; **Run flow** is gated on
  `call.complete` (args fully streamed); **Skip** dismisses locally.
- **Accept → start**: `ChatSessionView` passes `onAcceptProposal(flowApiName,
  summary, ctx)` that calls `startEpisode({ flowApiName, seedSummary, seedUserInput })`.
  Crucially it sends the **matched flow's bare `apiName`** — NOT the prefixed tool
  name — because the create endpoint resolves by `api_name`
  (`get_by_user_and_api_name`). (The web app sends the prefixed name and so
  appears to 404; see `docs/web-app-parity.md` §1b. This is a deliberate
  correctness deviation.)

## 9. Deferred / live-verification

- **Runtime unknowns** (need a backend): the resume SSE must open with
  `RUN_STARTED` (else relax `verifyEvents`), and how the form-submission user
  turn is echoed in the resumed stream (the post-run message-log invalidation is
  the safety net).
- **File-upload fields** (`TD-012`); **episode cancel** from the UI;
  historical proposal-card rehydration on reload (tool-call badges aren't
  rehydrated — `TD-018`).
