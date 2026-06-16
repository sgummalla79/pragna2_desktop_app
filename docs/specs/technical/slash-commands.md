# Technical Spec: Chat Slash Commands (flow dispatch)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Architecture

Slash dispatch reuses the existing chat transport: the same `TauriHttpAgent`
runs the turn, only its `url` changes per-turn. There is **no** new streaming
code. Two concerns are added:

1. **Discovery** — a thin read layer over `GET /api/pragna/flows` (Clean
   Architecture, mirroring the other resources): domain type → port → repository
   + mapper → service → DI → react-query hook.
2. **Composer + dispatch** — a presentational popover, slash detection/keyboard
   handling inside `ChatInput`, and a per-turn URL override inside
   `useChatSession`.

The discovery query key `['pragna','flows']` is **shared** with the settings
Flow mutations (`useUpdateFlowSlashExposure`, `useSaveFlowFromYaml*`), which
already invalidate it — so exposing/renaming a flow refreshes the popover with
no extra wiring.

```
ChatLandingView / ChatSessionView
  ├─ usePragnaSlashFlows() ─────► PragnaFlowService ─► PragnaFlowRepository ─► GET /pragna/flows
  ├─ <ChatInput slashFlows> ────► SlashCommandPopover        (open state, filter, kbd nav, accept)
  └─ useChatSession({ slashFlowNames })
        └─ send(text): SLASH_COMMAND_RE → agent.url = …/flows/{name}; restore in onRunFinalized
```

## 2. Discovery data layer

- **`domain/types/pragnaSlashFlow.types.ts`** — `PragnaSlashFlow { slashApiName,
  displayName, description }`. The chat-surface projection (NOT the settings
  `Flow`).
- **`application/ports/IPragnaFlowRepository.ts`** —
  `listSlashFlows(): Promise<PragnaSlashFlow[]>`.
- **`infrastructure/repositories/PragnaFlowRepository.ts`** — `class
  PragnaFlowRepository implements IPragnaFlowRepository`, ctor `(http:
  AxiosInstance)`; `listSlashFlows()` GETs the resource-relative `/pragna/flows`
  and maps `data.flows`.
- **`infrastructure/repositories/mappers/mapPragnaSlashFlow.ts`** —
  `ApiPragnaSlashFlowResponse { slash_api_name, display_name, description }`,
  `ApiPragnaSlashFlowsListResponse { flows: [...] }`, and
  `mapPragnaSlashFlow(raw): PragnaSlashFlow` (snake→camel; `description ?? ''`).
- **`application/services/PragnaFlowService.ts`** — thin facade;
  `listSlashFlows()` delegates.
- **DI** — `pragnaFlowService` registered in `ServiceContext.ts` (type) +
  `ServiceProvider.tsx` (`new PragnaFlowService(new PragnaFlowRepository(axiosClient))`).
- **`presentation/hooks/flows/usePragnaSlashFlows.ts`** — exports
  `PRAGNA_FLOWS_KEY = ['pragna','flows']` and `usePragnaSlashFlows()`
  (`useQuery`, `staleTime: 30_000`).

## 3. Composer (`ChatInput`)

New optional prop `slashFlows?: PragnaSlashFlow[]`. When present, `ChatInput`
owns the popover:

- **State**: `slashOpen`, `slashStart` (index of the `/`), `slashQuery` (text
  after `/`), `slashIndex` (highlight).
- **Detection** (`useEffect` on `[value, slashFlows.length]`): reads the live
  caret from `textareaRef.selectionStart`, walks back to a `/` at a word start
  with no whitespace in the query; sets the slash state or closes.
- **Filter** (`useMemo`): `slashApiName.toLowerCase().startsWith(query)`, sliced
  to `SLASH_MAX_ITEMS`.
- **`acceptSlash(flow)`**: rewrites `value` to `${before}/${name} ${after}` via
  `onChange`, closes the popover, and restores the caret after the trailing
  space with `requestAnimationFrame` + `setSelectionRange`.
- **`handleKeyDown`**: when `slashActive` (open AND non-empty), ↑/↓ cycle,
  Enter/Tab `acceptSlash`, Escape closes — each `preventDefault`'d so they don't
  submit/newline. Falls through to the normal Enter-submits behavior otherwise.
- **Render**: `<SlashCommandPopover>` inside a now-`relative` composer container.

**`SlashCommandPopover`** (`presentation/views/chat/components/`) is purely
presentational: props `items`, `selectedIndex`, `onSelect`, `onHoverIndex`.
Uses `onMouseDown` + `preventDefault` (not `onClick`) so the textarea keeps
focus; scrolls the active row into view on `selectedIndex` change.

## 4. Dispatch (`useChatSession`)

New option `slashFlowNames?: Set<string>` (bare names, no `/`). Kept current via
a `slashFlowNamesRef` assigned each render, so the `send` callback stays stable
(a changing Set identity must not recreate `send` — that would re-fire the
landing handoff effect).

In `send(text)`, before pushing the user message:

```ts
const slashName = SLASH_COMMAND_RE.exec(trimmed)?.[1];
if (slashName && slashFlowNamesRef.current?.has(slashName)) {
  if (overrideUrlRef.current === null) overrideUrlRef.current = agent.url;
  agent.url = `${PRAGNA_BASE_URL}/flows/${encodeURIComponent(slashName)}`;
}
```

- **Restore**: the existing `onRunFinalized` already restores
  `overrideUrlRef.current` → `agent.url` and nulls it. No change needed.
- **Precedence over overrides**: `sendWithOverrides` sets `overrideUrlRef` to the
  base `/chat` URL and rewrites `agent.url` with query params, *then* calls
  `send`. The slash branch sees `overrideUrlRef !== null` (keeps the base as the
  restore target) and overwrites `agent.url` with the flow endpoint — so slash
  wins and the query-param overrides are dropped for that turn (a flow uses its
  own model).
- **Constants** (`constants/slashCommands.ts`): `SLASH_COMMAND_RE =
  /^\/([a-z_][a-z0-9_-]*)(?:\s|$)/` (capture 1 = bare name) and
  `SLASH_MAX_ITEMS = 8`. Externalised per the no-hardcoding rule.

## 5. View wiring

- **`ChatSessionView`** (`ChatConversation`): `usePragnaSlashFlows()` → builds
  `slashFlowNames` (`useMemo` Set), passes it to `useChatSession` and
  `slashFlows` to `ChatInput`.
- **`ChatLandingView`**: calls `usePragnaSlashFlows()` (drives its own popover
  **and** primes the `['pragna','flows']` cache so the session view's first-turn
  dispatch sees the names synchronously on mount) and passes `slashFlows` to
  `ChatInput`. The landing's send path is unchanged — it stashes the draft (slash
  text intact) and navigates; the session view's `useChatSession` does the
  dispatch on the first turn.

## 6. Error handling

- Discovery failures are non-blocking: no popover, text sends normally. Logged as
  `CHT_008` (`Failed to load slash commands.`, `warn`) at the hook/query layer;
  never thrown into the composer.
- Flow-endpoint run errors flow through the existing `onRunFailed` / `STREAM_001`
  path (identical to default chat).
- Unknown `/foo` prefixes are a no-op in `send` (not in the name set) — sent
  verbatim, no error.

## 7. Out of scope / deferred

HITL episodes (pragna2-tracker TD-014): `EpisodeRepository` + `episode.types.ts`, `useEpisodes`,
`HITLFormCard` / `FlowProposalCard`, and resume over
`POST /api/conversations/{id}/episodes/{eid}/resume`. The backend signals a pause
in-stream via `CustomEvent(name="on_interrupt", value={schema})`, which this
app's `useChatSession` CUSTOM handler is positioned to detect natively (vs. the
web app's buffer-and-poll approach) — a design decision to settle when pragna2-tracker TD-014 is
built.
