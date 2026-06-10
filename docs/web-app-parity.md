# Web-App Parity & Deviations

> **Purpose**: a single, honest ledger of where the desktop app
> (`pragna2_desktop_app`) **deviates** from the web app
> (`pragna2_sgummalla_works`) it is ported from.
>
> **Last Updated**: 2026-06-09

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

## 2. ❌ Functional gaps — web app has it, desktop does not yet (NOT at parity)

These are genuine functional differences to close for full parity.

| Capability | Web app | Desktop | Tracking |
|---|---|---|---|
| **Flow proposals** | LLM emits a `propose_flow_<api_name>` tool call → `FlowProposalCard` → accept starts an episode | **Not implemented.** `startEpisode` plumbing exists; detection + card do not. Blocked on confirming the `flow_api_name` the create endpoint expects (web-app reference is contradictory re. the `propose_flow_` prefix) | `TD-014` Phase B |
| **Cancel a paused episode** | `EpisodeRepository.cancel` + `useCancelEpisode` + a Cancel button on the form card (status → `cancelled`) | **Not implemented.** A user must complete the form (or navigate away); no in-UI cancel | `TD-014` (deferred note) |
| **`file` ask_user field** | Uploads via the attachments system, stores the `attachment_id` as the field value | **Unsupported** — renders a "not supported yet" hint; a *required* file field blocks submit | `TD-012` (attachments) |
| **Attachments + PDF, message actions (edit/branch/regenerate/continue), usage & cost, KaTeX/diagrams** | Present | Deferred (pre-existing, from the chat port) | `TD-012`, `TD-015`, `TD-016`, `TD-019` |

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
- **Settings** (providers, configuration, connectors, knowledge, agents): faithful.

---

## How to keep this current

Update this file whenever a port introduces a deviation, closes a functional gap,
or when a live-verification item (§1) is confirmed/closed against a running backend.
It is the companion to the per-feature specs in `docs/specs/` — those describe each
feature as built; this one describes how each differs from the web-app reference.
