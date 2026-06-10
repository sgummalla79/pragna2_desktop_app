# Web-App Parity & Deviations

> **Purpose**: a single, honest ledger of where the desktop app
> (`pragna2_desktop_app`) **deviates** from the web app
> (`pragna2_sgummalla_works`) it is ported from.
>
> **Last Updated**: 2026-06-10

---

## Guiding principle

**Functionality must stay in sync with the web app.** Implementation should also
match the web app **unless**:

1. **Platform forces it** (Tauri webview vs. browser) — unavoidable, functionality identical; or
2. **A deliberate, approved improvement** was made — documented here with rationale + a revert path; or
3. **UI / presentation** differs — explicitly acceptable per the project owner.

Anything else is **drift to be closed**. Functional gaps (web app does X, desktop
doesn't yet) are tracked here and in `docs/TODO.md`.

**Legend** — 🟰 functionally identical · ⭐ deliberate improvement (approved) ·
🧩 platform-forced · 🎨 UI/UX only · ❌ functional gap (not yet at parity).

---

## 1. ⭐ Deliberate improvement — HITL resume streams natively (the "better than web app" item)

This is the **one significant implementation deviation**, made deliberately and
with prior approval.

**Web app (the reference):**
- `EpisodeRepository.create` / `.resume` POST to `…/episodes[/{id}/resume]` with
  **`responseType: 'text'`** — the SSE stream is **buffered as one opaque string**
  and resolves only after it ends (`EpisodeRepository.ts`). The events never flow
  through the chat `HttpAgent`.
- Detection is **out-of-band polling**: after the run, it queries
  `GET …/episodes?limit=1` and treats `status === 'awaiting_user'` as a pause.
- Because the agent's in-memory `messages` never saw the resume events, the UI
  then calls **`replaceMessages`** to resync from the persisted log. The web app's
  own code comments call this a **two-sources-of-truth anti-pattern / debt**
  (`useEpisodes.ts`, `IEpisodeRepository.ts`).

**Desktop (this app):**
- `TauriHttpAgent.runRaw(url, body, signal)` POSTs the episode start/resume body
  and **streams the SSE through ag-ui's own `apply()` → `processApplyEvents()`** —
  the exact pipeline a normal chat turn uses. So the resumed reply renders **live**,
  `agent.messages` stays canonical, and a **second `on_interrupt` surfaces
  natively**. No buffering, no polling-to-detect, no `replaceMessages`.
- Detection is **in-stream**: the `on_interrupt` CustomEvent is handled in
  `useChatSession.onCustomEvent`. (The event carries the form **schema** but not the
  episode **id**, so one `GET …/episodes?limit=1` resolves the id — a single lookup,
  not a poll loop.)

**Is functionality in sync?** **Yes, at the outcome level** — pause → form →
submit → run continues → maybe pause again. The differences are mechanism, plus two
**edge cases flagged for live verification** (a running backend is needed to close
them):
- **Form-submission turn rendering.** Web app reconciles the transcript from the
  persisted log (`replaceMessages`); desktop relies on the live resume stream +
  a post-run message-log query invalidation. If the resume stream does **not**
  echo the user's submitted turn, the desktop transcript could differ until the
  next reload. *Mitigation in place:* messages query is invalidated after each
  episode run.
- **Stream envelope.** Desktop runs the resume events through `verifyEvents`, which
  expects a `RUN_STARTED … RUN_FINISHED` envelope. If the resume SSE doesn't open
  with `RUN_STARTED`, `verifyEvents` must be relaxed. (Web app never parses the
  stream, so it's immune to this.)

**Why deviate at all?** The desktop had **no** `EpisodeRepository` to inherit, so
building native cost the same as porting the buffered version — and it avoids the
debt the web app itself flagged. Approved before implementation.

**Decision (2026-06-09):** **keep** the native approach on desktop — it is the
better implementation — and **backport it to the web app** so both converge on it
(replace the web app's buffer+poll+`replaceMessages` with a `runRaw`-equivalent).
The goal is parity on the *best* implementation, not on the legacy one.

**Revert path (kept for reference only):** to instead mirror the web app's legacy
approach, buffer `/resume` as text (axios `responseType:'text'`), poll
`GET …/episodes?limit=1` for `awaiting_user`, and add a `replaceMessages` resync.
The episode read layer + types already exist.

See: `docs/specs/technical/hitl-episodes.md`.

---

## 1b. ⭐ Flow proposals send the correct `api_name` (web-app bug fixed)

Flow proposals are now implemented on desktop (a `propose_flow_<api_name>` tool
call renders a `FlowProposalCard`; accept starts an episode). In porting it, a
**latent web-app bug** surfaced:

- The propose-flow **tool name** is `propose_flow_<api_name>` (prefix is
  load-bearing). The backend create endpoint
  (`create_episode.py` → `get_by_user_and_api_name(user_id, flow_api_name)`)
  looks the flow up by the **bare `api_name`**.
- The **web app** passes `call.name` (the *prefixed* tool name) straight through
  as `flow_api_name` (`FlowProposalCard` → `EpisodeService.create` →
  `EpisodeRepository.create`, no strip anywhere). That value can't match a flow's
  bare `api_name`, so the create lookup should 404 — i.e. accepting a proposal
  appears broken in the web app.
- **Desktop** detects the call by matching it to a known flow and then sends that
  **matched flow's bare `apiName`** to `startEpisode` — correct by construction,
  no string-slicing.

**Action for parity:** fix the web app to send the bare `api_name` (strip the
`propose_flow_` prefix or map back to the flow). Until then, desktop is the
correct reference for this path.

---

## 2. ❌ Functional gaps — web app has it, desktop does not yet (NOT at parity)

These are genuine functional differences to close for full parity.

| Capability | Web app | Desktop | Tracking |
|---|---|---|---|
| **Cancel a paused episode** | `EpisodeRepository.cancel` + `useCancelEpisode` + a Cancel button on the form card (status → `cancelled`) | **Not implemented.** A user must complete the form (or navigate away); no in-UI cancel | `TD-014` (deferred note) |
| **`file` ask_user field** | Uploads via the attachments system, stores the `attachment_id` as the field value | **Unsupported** — renders a "not supported yet" hint (attachments now exist (`TD-012`); wiring the form field to them is the remaining step) | `TD-014`/`TD-012` |

> **Now shipped (were gaps):** attachments + viewer (`TD-012`, session view),
> message actions — edit / branch / regenerate (+ with-model) / continue
> (`TD-015`), the **full markdown renderer** — KaTeX math + Mermaid/`sketchon`
> diagrams + smooth-streaming reveal (`TD-019`; faithful port of the web app's
> `MarkdownMessage`, see §4 for the one adaptation), and the **per-conversation
> usage + cost** sidebar chip (`TD-016`, see §4/§5).

> **Not a gap (verified):** neither app re-attaches to a *live, in-flight* episode
> stream on remount — there is no `/stream` re-attach endpoint in the web app. Both
> rely on the run completing + the episode row. Desktop additionally restores an
> `awaiting_user` form on conversation reopen.

---

## 3. 🧩 Platform-forced deviations — implementation differs, functionality identical

Forced by the Tauri webview (cross-origin backend, no Vite dev proxy, non-HTTP
origin). Behavior is the same; only the transport differs.

| Area | Web app | Desktop | Why |
|---|---|---|---|
| **Streaming transport** | ag-ui `HttpAgent` using the global `fetch` | `TauriHttpAgent extends HttpAgent`, overriding `run()` (and adding `runRaw()`) to fetch via `@tauri-apps/plugin-http` (`tauriHttpRequest.ts`) | Webview CORS blocks the cross-origin call; relative URLs can't resolve against a non-HTTP origin |
| **`PRAGNA_BASE_URL`** | Relative `/api/pragna` (Vite dev proxy avoids CORS) | **Absolute** `${API_BASE_URL}/pragna` | No dev proxy in the packaged webview |
| **REST transport** | axios over browser fetch | axios over the Tauri native-HTTP adapter | same CORS reason |

The event-parsing + state machinery (`transformHttpEventStream`, `transformChunks`,
`verifyEvents`, `apply`) is reused **unchanged** from ag-ui, so events behave 1:1.

---

## 4. 🎨 UI / implementation deviations with no functional change (acceptable)

| Area | Web app | Desktop | Note |
|---|---|---|---|
| **HITL free-text (`allow_text_input`)** | The main chat **composer** doubles as the form's free-text `text` field (lifted state in `ChatSessionView`) | A **textarea inside the form card**; the main composer is disabled while a form is open | Same data submitted (`{form, text}`); different input location. UX deviation |
| **`HITLFormCard` state ownership** | Fully parent-controlled (values/touched/textValue lifted to the chat view) | **Self-contained** — owns its values/touched/free-text, remounted per pause (keyed by episode id) | Implementation simplification; identical behavior |
| **Form schema types** | Re-declared locally in `form/validators.ts` | Centralised in `domain/types/episode.types.ts` (imported by the validators) | No behavior change |
| **`multiselect` / `checkbox` / `date` controls** | same | Native inputs (no kit primitive) | UI only |
| **Branch handoff (`TD-015`)** | Stashes `{ text, agent }` before navigating to the fork | Stashes `{ text }` only — desktop's handoff has no `agent` field; the fork inherits `flow_id`/`user_model_id` server-side and the session view resolves the agent from the conversation | No functional impact (desktop chat conversations are non-flow; the inherited model/flow drives the re-send) |
| **`sendWithModel` (`TD-015`)** | Standalone hook method | Thin wrapper over `sendWithOverrides(text, { userModelId })` — same `?user_model_id` query param | Identical behavior |
| **Regen-with-model gating (`TD-015`)** | Gated on `agentName === DEFAULT_AGENT_NAME` | Gated on `!conversation.flowId` | Equivalent (desktop has no flow-agent resolution; `flowId` null = default chat) |
| **Continue prompt (`TD-015`)** | Inline literal `'continue'` | `CONTINUE_PROMPT` constant (`constants/chat.ts`) | Same value; externalised per the no-hardcoding rule |
| **Sketchon diagram theme signal (`TD-019`)** | `SketchonDiagram` reads light/dark from `<html data-theme>` | Reads the **`.dark` class** on the root element (`document.documentElement.classList.contains('dark')`), observed via a `class`-attribute `MutationObserver` | The desktop signals dark via the `.dark` class (`@custom-variant dark` in `index.css`), not a `data-theme` attribute. Same outcome — diagrams re-theme live on mode change |
| **KaTeX CSS dependency (`TD-019`)** | `katex` resolves transitively (hoisted node_modules) | `katex` pinned as an **explicit dep** (`^0.16.47`, the version Streamdown bundles) so `katex/dist/katex.min.css` resolves under pnpm's strict layout | Packaging only; same bundled KaTeX Streamdown already uses |
| **Streamdown `@source` glob (`TD-019`)** | `dist/*.js` | `dist/*.js` (was `dist/index.js`) | Widened to scan all Streamdown dist files so mermaid/controls utility classes generate — matches the web app |
| **Usage chip layout (`TD-016`)** | Chip `absolute right-2.5`, fades on hover so an absolutely-positioned kebab takes the slot | Chip `absolute` inside a `relative` trailing wrapper, fades on `group-hover`/`group-focus-within` so the desktop's **inline** action row takes the slot | Desktop sidebar rows reveal actions inline (no kebab); same "chip ↔ actions share the trailing slot, no layout shift" behaviour |
| **Usage 404 guard location (`TD-016`)** | Zero-state mapped in the `useConversationUsage` **hook** | Zero-state mapped in the **repository** `getUsage` (matches the desktop's `get`→`null` / `getMessages`→`[]` convention) | Same outcome (a 404 row shows no cost, never an error); guard lives one layer lower |
| **Usage staleTime (`TD-016`)** | Inline `staleTime: 60_000` | `USAGE_STALE_MS` constant (`constants/chat.ts`) | Same 60s; externalised per the no-hardcoding rule |
| **Slash popover, form fields, cards** | web-app styling | theme tokens (tweakcn) + shadcn primitives | UI only, per the standing theme rule |

---

## 5. 🟰 Faithful ports — no functional or structural deviation

- **Slash dispatch** (`TD-013`): per-turn URL override to `…/flows/{name}`, restored
  on finalize — same mechanism as the web app's `useChatSession`.
- **Conversation data layer** (list/get/create/messages/update/delete), **chat
  streaming** core, **model/thinking** controls.
- **Agent Flows editor core**: `buildEditorGraph` / `graphToYaml` / the zustand
  editor store / connection rules — ported faithfully; YAML stays the source of
  truth.
- **HITL form validation logic** (`validators.ts`): ported field-for-field.
- **Conversation usage + cost** (`TD-016`): same `GET …/usage` contract,
  `ConversationUsage`/`UsageRecord` types, snake→camel mapper (cost kept as a
  string), `getUsage` on port/service/repo, `useConversationUsage`
  (`['conversations', id, 'usage']`, 60s stale), the `formatUsd` tiers, and a
  total-cost sidebar chip hidden at `$0` — functionally identical to the web app
  (deviations in §4 are layout/guard-location/constant only).
- **Chat markdown renderer** (`TD-017`/`TD-019`): both apps use **Streamdown
  `^1.6.11`** — the same renderer (TD-017's "switch to react-markdown" was a
  hypothetical, never the web app's choice; react-markdown is only Streamdown's
  transitive dep). `MarkdownMessage`, `normalizeMathDelimiters`, `rehypeSketchon`,
  and `SketchonDiagram` are ported faithfully; the diagram theme-signal read is the
  only adaptation (§4).
- **Settings** (providers, configuration, connectors, knowledge, agents): faithful.

---

## How to keep this current

Update this file whenever a port introduces a deviation, closes a functional gap,
or when a live-verification item (§1) is confirmed/closed against a running backend.
It is the companion to the per-feature specs in `docs/specs/` — those describe each
feature as built; this one describes how each differs from the web-app reference.
