# Backlog / TODO

Single source of truth for deferred work. Code must **not** carry free-floating
`TODO` notes — instead reference an ID here (e.g. `// see docs/TODO.md TD-001`).

Status: ⬜ `open` · 🟡 `in-progress` · ✅ `done` · `wontfix`
Priority: `P1` (blocks a feature) · `P2` (should do soon) · `P3` (nice to have)

| ID | Title | Area | Priority | Status |
|----|-------|------|----------|--------|
| [TD-001](#td-001--desktop-oauth-connector-callback-round-trip) | Desktop OAuth connector callback round-trip | Connectors | P1 | ⬜ open |
| [TD-002](#td-002--feature--technical-spec-docs-for-the-three-settings-pages) | Spec docs for Configuration / Connectors / Knowledge | Docs | P2 | ✅ done |
| [TD-007](#td-007--backfill-spec-docs-for-login--providers) | Backfill spec docs for Login + Providers | Docs | P2 | ✅ done |
| [TD-008](#td-008--providers-view-swallows-errors) | Providers view swallows several errors | Providers | P3 | ✅ done |
| [TD-009](#td-009--auth-session-does-not-persist-across-restart) | Auth session does not persist across restart | Login | P3 | ✅ done |
| [TD-010](#td-010--agent-tool-entry-autocomplete-against-apitools) | Agent tool entry: autocomplete against /api/tools | Agents | P3 | ✅ done |
| [TD-011](#td-011--model--temperature-selection-on-standalone-agents) | Model / temperature selection on standalone agents | Agents | P3 | ⬜ open |
| [TD-003](#td-003--unit-tests-for-the-three-new-features) | Unit tests for the three new features | Testing | P2 | ⬜ open |
| [TD-004](#td-004--verify-multipart-knowledge-upload-against-the-live-backend) | Verify multipart Knowledge upload end-to-end | Knowledge | P2 | ⬜ open |
| [TD-005](#td-005--client-side-file-validation-for-knowledge-upload) | Client-side file validation for Knowledge upload | Knowledge | P3 | ✅ done |
| [TD-006](#td-006--chat-action-preferences-have-no-consumer-yet) | Chat-action preferences have no consumer yet | Configuration | P3 | ⬜ open |
| [TD-012](#td-012--chat-attachments--pdf-viewer) | Chat attachments + PDF viewer | Chat | P2 | ✅ done (session view) |
| [TD-013](#td-013--chat-slash-commands--flow-dispatch) | Chat slash commands + flow dispatch | Chat | P3 | ✅ done |
| [TD-014](#td-014--chat-hitl-episodes-ask_user-forms--flow-proposals) | Chat HITL episodes (ask_user forms + flow proposals) | Chat | P2 | ✅ done |
| [TD-015](#td-015--chat-message-actions-edit--branch--regenerate--continue) | Chat message actions (edit / branch / regenerate / continue) | Chat | P3 | ⬜ open |
| [TD-016](#td-016--chat-conversation-usage--cost-panel) | Chat conversation usage + cost panel | Chat | P3 | ⬜ open |
| [TD-017](#td-017--evaluate-streamdown-transitive-weight) | Evaluate Streamdown transitive weight | Chat | P3 | ⬜ open |
| [TD-018](#td-018--historical-tool-call-badges-not-rehydrated) | Historical tool-call badges not rehydrated | Chat | P3 | ✅ done |
| [TD-019](#td-019--chat-markdown-katex-math--sketchon-diagrams) | Chat markdown: KaTeX math + sketchon diagrams | Chat | P3 | ⬜ open |
| [TD-020](#td-020--agent-flows-phase-2-interactive-editor) | Agent Flows Phase 2: interactive editor | Flows | P2 | ✅ done |
| [TD-021](#td-021--flow-editor-advanced-sub-features) | Flow editor: advanced sub-features | Flows | P3 | ⬜ open |

---

## TD-001 — Desktop OAuth connector callback round-trip

**Area:** Connectors (MCP) · **Priority:** P1 · **Status:** open

**What:** OAuth-type MCP connectors are not yet fully connectable on desktop. The
api_key / bearer / headers / none auth types work end-to-end. For OAuth, we call
`POST /api/mcp-connectors/{id}/oauth-authorization`, then open the returned
`authorizationUrl` in the **system browser** via the opener plugin — but there is
no callback listener to capture the redirect and finish the exchange, so the user
must manually return and hit **Refresh**.

**Where:**
- `src/presentation/views/settings/ConnectorsView/ConnectorCard.tsx` (`onConnect`/`startOAuth` handler)
- `src/presentation/views/settings/ConnectorsView/AddConnectorWizard.tsx` (OAuth step)

**Approach:** Reuse the login pattern — a localhost loopback server (RFC 8252,
`tauri-plugin-oauth`) as the redirect target, then complete the exchange and
invalidate the connectors query. See `src/infrastructure/auth0/tauriLoopbackAuthFlow.ts`.
Open question: the connector `redirect_uri` is registered with the upstream
authorization server / set by the backend, so confirm the backend can accept a
loopback `redirect_uri` (or a custom deep-link scheme) for desktop clients before building.

**Done when:** an OAuth MCP connector can be connected without leaving the app and
its tools appear automatically.

---

## TD-002 — Feature + technical spec docs for the three settings pages

**Area:** Docs · **Priority:** P2 · **Status:** done (2026-06-09)

**What:** CLAUDE.md requires two specs per feature
(`docs/specs/features/<name>.md` + `docs/specs/technical/<name>.md`).

**Done:** `configuration.md`, `connectors.md`, `knowledge.md` written under both
`docs/specs/features/` and `docs/specs/technical/`, sourced from the shipped code.

---

## TD-007 — Backfill spec docs for Login + Providers

**Area:** Docs · **Priority:** P2 · **Status:** done (2026-06-09)

**What:** The `login` and `providers` features were merged earlier without the two
required spec docs (only `boilerplate-setup` and the three settings pages have them).
Backfill them to bring every shipped feature into compliance with the CLAUDE.md rule.

**Where:** create `login.md` and `providers.md` under both `docs/specs/features/`
and `docs/specs/technical/`, sourced from the shipped code.

**Done (2026-06-09):** `login.md` and `providers.md` written under both
`docs/specs/features/` and `docs/specs/technical/`. Every shipped feature now has
both spec docs.

---

## TD-008 — Providers view swallows several errors

**Area:** Providers · **Priority:** P3 · **Status:** done (2026-06-09)

**Resolved:** added shared `src/lib/httpError.ts` (`detailOr`/`statusOf`); connect
now maps 409 → `PRV_002` and prefers backend `detail` (else `PRV_003`); refresh
catches errors (`PRV_006`) and shows a diff summary ("N added · N archived · N
restored"); the enable/disable toggle surfaces failures (`PRV_007`); model
bulk-save catches + shows `MDL_004` while keeping the edit buffer. `ConnectorCard`
refactored onto the shared `detailOr`.

**What:** Surfaced while writing the providers spec. Unlike Connectors, the
Providers view does not surface backend `detail`, and several failures are silent:
refresh-models and the tile enable/disable toggle are fire-and-forget (no catch);
bulk-save failure keeps the buffer but shows no message; the refresh diff
(created/archived/unarchived) is returned but never displayed; an already-registered
provider falls through to the generic `PRV_003` instead of `PRV_002`.

**Where:** `src/presentation/views/settings/ProvidersView/*`

**Done when:** these paths show explicit, user-visible errors (prefer backend
`detail` with catalog fallback) and `PRV_002` is used for duplicates.

---

## TD-009 — Auth session does not persist across restart

**Area:** Login · **Priority:** P3 · **Status:** done (2026-06-09)

**Decision:** keep a **long-lived session** via a refresh token in secure storage.

**Resolved (cross-platform):** the refresh token is captured from Auth0 token
responses and stored in the **OS keychain** — macOS Keychain + Windows Credential
Manager via the Rust `keyring` crate (`secure_store_set/get/delete` Tauri commands,
wrapped by `src/infrastructure/storage/secureStore.ts`). `Auth0Repository.refresh()`
exchanges it (`grant_type=refresh_token`, handles rotation); `AuthService.bootstrap()`
falls back to it on a fresh launch; `logout()` clears it. Degrades gracefully to
sign-in-each-launch when no refresh token is issued. Errors → `AUTH_011`.

**Caveats / live-verify (needs the real Auth0 tenant + a desktop run):**
- Auth0 must be configured to issue refresh tokens — **Native** app type +
  **Refresh Token** grant (+ rotation) + the API's **"Allow Offline Access"**.
- **Startup** refresh only; a mid-session `401` still logs out (no transparent
  refresh-and-retry in the axios interceptor — possible follow-up).

**Where:** `src-tauri/src/lib.rs` (keychain commands), `src/infrastructure/storage/
secureStore.ts`, `src/infrastructure/runtime.ts`, `Auth0Repository`, `AuthService`,
`auth.types`, `IAuthRepository`. Specs: `docs/specs/{features,technical}/login.md`.

---

## TD-010 — Agent tool entry: autocomplete against /api/tools

**Area:** Agents · **Priority:** P3 · **Status:** done (2026-06-09)

**Resolved:** `ChipInput` gained an optional `suggestions` prop — an autocomplete
dropdown (↑/↓/Enter/Tab/Esc, free-form still allowed) plus an amber "not in your
tools" flag on unknown chips. Wired in the flow editor's **`NodePanel`** agent-node
Tools field, sourced from `useTools()` filtered to enabled `api_name`s.

**Note:** the actual free-form tool chip lives in `NodePanel.tsx` (flow agent
nodes), not `AgentFormModal.tsx` — standalone agents have no tools field. The
emit/context-slot chip inputs pass no `suggestions` and are unchanged.

**What:** In the agent editor, tools are entered as a free-form chip input of tool
handles (matching the web app) — no validation or autocomplete against the actual
tools inventory. Upgrade it to an autocomplete/picker sourced from `GET /api/tools`
so users select from real, enabled tools instead of typing handles by hand.

**Where:** `src/presentation/views/settings/AgentsView/ChipInput.tsx` /
`AgentFormModal.tsx`; reuse `useTools()`.

**Done when:** tool entry suggests/validates against the live tools list.

---

## TD-011 — Model / temperature selection on standalone agents

**Area:** Agents · **Priority:** P3 · **Status:** open

**What:** Standalone agents currently have no model or sampling-parameter
(temperature/top_p) selection — the `/api/agents` contract does not include them
(model selection lives on *flow* agents). Add per-agent model + temperature
selection once the backend contract supports it, sourcing models from the
already-ported Providers/Models layer (`useModels`).

**Where:** `src/presentation/views/settings/AgentsView/AgentFormModal.tsx`;
domain `agent.types.ts`; backend `/api/agents` contract.

**Done when:** a standalone agent can pin a model + temperature, persisted by the backend.

**Blocked by:** backend support on the `/api/agents` contract.

---

## TD-003 — Unit tests for the three new features

**Area:** Testing · **Priority:** P2 · **Status:** open

**What:** The testing standard calls for tests with every feature. The ported
repositories, mappers, services, and hooks shipped without tests.

**Scope:** repository HTTP contracts (mock network — incl. the multipart upload
path), boundary mappers (snake_case ↔ camelCase), and react-query hook behavior
(query keys + invalidation). Mirror the web app's existing test style where useful.

**Done when:** `pnpm test` (frontend) covers the new repos/mappers/hooks and passes.

---

## TD-004 — Verify multipart Knowledge upload against the live backend

**Area:** Knowledge · **Priority:** P2 · **Status:** open

**What:** File upload posts `FormData` through the native-HTTP axios adapter, which
was hardened to drop the JSON `Content-Type` so the transport sets the multipart
boundary (`src/infrastructure/http/tauriHttpAdapter.ts`). This was not exercised
against the running backend from the dev environment.

**Done when:** a real document (pdf/txt/md/csv/docx/xlsx) uploads successfully on a
packaged macOS build and the source appears in the library.

---

## TD-005 — Client-side file validation for Knowledge upload

**Area:** Knowledge · **Priority:** P3 · **Status:** done (2026-06-09)

**Resolved:** `LibraryDocumentsManager.handleFilePick` now runs
`validateKnowledgeFile` (extension against the accept list + size vs
`KNOWLEDGE_MAX_FILE_BYTES` = 25 MB) on both the picker and drag-drop paths;
a rejected file isn't accepted and shows an inline message. The size cap is a
named constant with a comment (the API exposes no limit; the backend remains the
real gate at 413/415).

---

## TD-006 — Chat-action preferences have no consumer yet

**Area:** Configuration · **Priority:** P3 · **Status:** open

**What:** The Configuration page's "Chat actions" toggles persist to local storage
(`useChatPreferences`) but nothing reads them yet — the chat surface isn't built.

**Done when:** the chat UI honors these preferences (revisit when chat lands).

**Update (2026-06-09):** Chat Phase 1 (core streaming chat) shipped but does not
yet consume these toggles — the Branch and Regenerate-with-model affordances they
gate are part of the deferred message-actions work ([TD-015](#td-015--chat-message-actions-edit--branch--regenerate--continue)).
Still open; wire when message actions land.

---

## TD-012 — Chat attachments + PDF viewer

**Area:** Chat · **Priority:** P2 · **Status:** done — session view (2026-06-09); landing uploads deferred

**Shipped:** attachment data layer (`attachment.types`, `IAttachmentRepository`/
`AttachmentRepository` upload + `fetchContent`, `mapAttachment`, `AttachmentService`,
DI, `useUploadAttachment`); composer attach button + staged chips (`AttachmentChip`)
with image preview/progress/remove + 10 MB/type pre-check (`constants/attachments.ts`);
`useChatSession.send(text, attachmentIds)` → `forwardedProps.attachment_ids`;
persisted-turn rendering (`mapMessage` now maps `attachments[]`; `PersistedMessage.
attachments`; `ChatMessage` chips) + an authed-blob image/PDF `AttachmentViewer`
(`useAttachmentBlob`). **Prerequisite:** added `blob`/`arraybuffer` `responseType`
to `tauriHttpAdapter` (it only did text/json). Errors `ATT_001..003`. Specs:
`docs/specs/{features,technical}/attachments.md`.

**Deferred:** landing-composer uploads (no conversation row yet); drag-and-drop;
persisted-image inline thumbnails; client model-capability gating.

**Live-verify (needs desktop + backend):** multipart upload through the native
adapter (also [TD-004](#td-004--verify-multipart-knowledge-upload-against-the-live-backend)),
blob GET through the adapter, PDF in the webview `<iframe>` via blob URL (fallback:
Tauri temp file + `convertFileSrc`).

**Done when:** a user can attach an image/PDF, see it on the turn, and the model
receives it.

---

## TD-013 — Chat slash commands + flow dispatch

**Area:** Chat · **Priority:** P3 · **Status:** done (2026-06-09)

**What:** A `/{flow-name}` prefix routes a turn to the deterministic
`POST {PRAGNA_BASE_URL}/flows/{name}` endpoint instead of `/chat`, with a
slash-command popover sourced from `GET {PRAGNA_BASE_URL}/flows`.

**Shipped:** `usePragnaSlashFlows` (+ `PragnaFlowService`/`PragnaFlowRepository`/
`mapPragnaSlashFlow`/`PragnaSlashFlow`, DI registered), `SlashCommandPopover` +
slash detection/keyboard nav/accept inside `ChatInput`, and per-turn URL
dispatch in `useChatSession` (`slashFlowNames` option; reuses the existing
`overrideUrlRef` restore seam; slash wins over model/thinking overrides).
Constants in `constants/slashCommands.ts`; discovery failure → `CHT_008` (silent
popover). Specs: `docs/specs/{features,technical}/slash-commands.md`.

**Not included (still TD-014):** HITL ask_user forms + flow proposals + resume.

**Verify live:** `pnpm tauri dev` → expose a flow as a slash in Settings →
Flows, then in chat type `/<name> …` and confirm the popover + flow dispatch.

---

## TD-014 — Chat HITL episodes (ask_user forms + flow proposals)

**Area:** Chat · **Priority:** P2 · **Status:** done (2026-06-09) — Phase A + Phase B

**What:** When a flow run calls `ask_user` it pauses (`awaiting_user`); the UI
renders an interactive form and resumes via
`POST /api/conversations/{id}/episodes/{eid}/resume` (SSE). Flow *proposals*
(`propose_flow_*` tool calls → proposal card → start episode) are the second half.

**Phase A — shipped (ask_user pause/resume), fully native:** `episode.types.ts`,
`IEpisodeRepository`/`EpisodeRepository`/`mapEpisode`/`EpisodeService` (read-only;
list/get), DI. **`TauriHttpAgent.runRaw(url, body, signal)`** streams the resume
(and start) SSE through ag-ui's inherited `apply()`/`processApplyEvents()` — so
the continuation renders live and a second `on_interrupt` surfaces natively, **no
buffer/poll/`replaceMessages`** (the web app's documented debt, avoided by
construction). `useChatSession` gains `on_interrupt` detection +
`resolveOpenEpisode` (one `episodes?limit=1` GET for the id the event omits) +
`pendingInterrupt` / `submitInterrupt` / `startEpisode`. Form subsystem in
`components/hitl/` (`validators`, `FormField`, `HITLFormCard`; 8 field types — file
unsupported pending TD-012). Wired into `ChatSessionView`. Errors `HITL_001..003`.
Specs: `docs/specs/{features,technical}/hitl-episodes.md`.

**Phase B — shipped (flow proposals):** `ChatMessage` maps
`propose_flow_<apiName>` tool calls to the matching flow and renders
`FlowProposalCard` (summary + description + extra-context box; Run gated on args
complete); accept → `startEpisode` with the matched flow's **bare `apiName`**.
Resolved the contract: the create endpoint resolves by `api_name`
(`get_by_user_and_api_name`), so desktop sends the bare name — the web app sends
the *prefixed* tool name and so appears to 404 (web-app bug; see
`docs/web-app-parity.md` §1b).

**Live-verify (needs a backend):** resume SSE opens with `RUN_STARTED` (else relax
`verifyEvents`); how the form-submission user turn is echoed in the resumed stream.
Also deferred: episode cancel from the UI; file-upload fields (TD-012).

**Done when (Phase A):** an `ask_user` pause renders a form whose submission
resumes the run live; a second pause re-shows a form; reopening a paused
conversation restores the form. ✓

---

## TD-015 — Chat message actions (edit / branch / regenerate / continue)

**Area:** Chat · **Priority:** P3 · **Status:** open

**What:** Per-message hover actions on assistant/user turns: copy, regenerate
(optionally with a different model), edit-and-resend, branch the conversation, and
Continue when an assistant turn stopped on `length`. These rely on the BE
`truncate-from` and `branch` endpoints (deferred from the repository) and the
per-turn `?user_model_id=` override (`sendWithModel`).

**Where (to add):** restore `truncateFrom` + `branch` on `IConversationRepository`
/ `ConversationService` / `ConversationRepository` + `useTruncateFromMessage` /
`useBranchConversation`; restore `sendWithModel` on `useChatSession`; a
`MessageActions` component. This also unblocks [TD-006](#td-006--chat-action-preferences-have-no-consumer-yet)
(the `useChatPreferences` Branch / regen-with-model toggles).

**Done when:** the four actions work and honor the chat preferences.

---

## TD-016 — Chat conversation usage + cost panel

**Area:** Chat · **Priority:** P3 · **Status:** open

**What:** Surface per-conversation token usage + cost from
`GET /api/conversations/{id}/usage` (a `useConversationUsage` hook + the
`getUsage` repo method, both deferred from Phase 1).

**Where (to add):** restore `getUsage` on the conversation port/service/repo +
`ConversationUsage` / `UsageRecord` types; a usage panel/chip in the chat header.

**Done when:** a conversation shows its running token + cost totals.

---

## TD-017 — Evaluate Streamdown transitive weight

**Area:** Chat · **Priority:** P3 · **Status:** open

**What:** `streamdown` (the chat markdown renderer) pulls in heavy **lazy** chunks
— mermaid (~885 kB), cytoscape (~443 kB), a wasm blob (~622 kB), wardley, and the
full Shiki language-grammar set. They are code-split (only fetched when such a
block renders), so the eager bundle is unaffected, but the on-demand footprint is
large for "core chat."

**Where:** `src/presentation/views/chat/components/MarkdownMessage.tsx`; bundler
config.

**Approach:** Decide between (a) keeping Streamdown but trimming/disabling the
diagram (mermaid/cytoscape/wardley) support, or (b) switching to
`react-markdown` + `shiki` with a curated grammar set. Measure first.

**Done when:** the chat markdown dependency footprint is a deliberate, documented
choice.

---

## TD-018 — Historical tool-call badges not rehydrated

**Area:** Chat · **Priority:** P3 · **Status:** done (2026-06-09)

**Resolved:** `persistedToAGUIMessage` now carries `tool_calls` into the AG-UI
seed (as `{ id, type, function:{ name, arguments } }`), and `toChatMessage` falls
back to `aguiToolCallToChatToolCall(tc)` when the live accumulator ref has no
entry — so a reopened conversation renders its historical tool-call badges
(name + args). Live turns are unaffected (the ref still wins).

**Minor follow-up:** the persisted tool **result** isn't on the AG-UI tool-call
shape, so historical badges show name + args but not the result string.

---

## TD-019 — Chat markdown: KaTeX math + sketchon diagrams

**Area:** Chat · **Priority:** P3 · **Status:** open

**What:** Phase 1's `MarkdownMessage` renders standard markdown + code
highlighting but omits the web app's KaTeX math pass and the custom `rehypeSketchon`
diagram plugin (`<sketchon-diagram>`).

**Where:** `src/presentation/views/chat/components/MarkdownMessage.tsx`.

**Done when:** math and sketchon diagrams render (decide alongside
[TD-017](#td-017--evaluate-streamdown-transitive-weight), since they affect the
renderer choice).

---

## TD-020 — Agent Flows Phase 2: interactive editor

**Area:** Flows · **Priority:** P2 · **Status:** open

**What:** Agent Flows Phase 1 ships flow list + CRUD, slash-exposure, YAML
authoring (validate/save), and a **read-only** canvas. Phase 2 makes the canvas
an interactive editor: drag/connect/delete nodes, a node palette, per-node and
per-edge side panels (agent / decision / connector / knowledge / edge-condition +
dispatch), **graph→YAML** serialization (the inverse of the read-only
`layoutFlow`), a zustand editor store wiring canvas ⇄ YAML bidirectionally, and
drag-**position persistence** (`PATCH /api/flows/{id}` with `metadata.positions`).
Likely also a full-page editor route (the web app uses `/flows/:id/edit`).

**Where (to add):** `src/presentation/views/settings/FlowDetailView/` (or a new
`FlowEditorView/`) — `graphToYaml.ts`, `useFlowEditorStore.ts`, the side-panel
components, editable node/edge variants; add `js-yaml` + restore an
`updatePositions` method on `IFlowRepository`/`FlowService`/`FlowRepository`.

**Approach:** Port the web app's `FlowEditorView` (canvas ~900 lines + ~500-line
store + 6 panels). Reuse the Phase 1 `layoutFlow`, `canvasNodes`, `ConditionEdge`,
`edgeConditions`, and the flow data layer.

**Done when:** a user can build/edit a flow graph visually, the YAML round-trips
canvas ⇄ text, and node positions persist across reloads.

**Done (2026-06-09):** Interactive editor shipped — editable reactflow canvas
(drag/connect/delete), node palette, per-node/edge side panels, `js-yaml`
graph→YAML serialization via a zustand store, and Save (validate → save-by-id)
with positions persisted in `metadata.positions`. Ported from the web app's
`FlowEditorView` into `src/presentation/views/settings/FlowDetailView/`. Remaining
advanced sub-feature UIs are split out to [TD-021](#td-021--flow-editor-advanced-sub-features).

---

## TD-021 — Flow editor: advanced sub-features

**Area:** Flows · **Priority:** P3 · **Status:** open

**What:** The interactive editor (TD-020) omits the editing **UI** for the most
advanced sub-features, though their data round-trips losslessly through
`buildEditorGraph`/`graphToYaml`/the store:
- **Dynamic-dispatch fan-out** (#35: `dispatch_mode`/`items_slot`/`item_slot`) —
  shown as a read-only "per-item" edge chip; no editor in `EdgePanel`.
- **Context slots** (#26: inputs/outputs/reducers) — carried; minimal/!no UI.
- An editable **YAML/source view** (Phase 1 had a CodeMirror panel; the editor
  superseded it — re-add as a toggle if users want raw editing).
- **Connector inline-register** — the connector picker selects from already-
  connected MCP connectors (`useMcpConnectors`); registering a new one inline
  (as the web app's editor does) is deferred.

**Where:** `src/presentation/views/settings/FlowDetailView/{EdgePanel,NodePanel,ConnectorPanel,FlowEditor}.tsx`.

**Done when:** these sub-features are editable in the UI (decide which are worth
surfacing vs. leaving to YAML).

---

> **Cross-link:** the chat ↔ flows integration was unblocked by the Agent Flows
> flow layer (`useFlows`, `FlowService`, `flow.types`).
> [TD-013](#td-013--chat-slash-commands--flow-dispatch) (chat slash dispatch) and
> [TD-014](#td-014--chat-hitl-episodes-ask_user-forms--flow-proposals) (chat HITL
> episodes — ask_user pause/resume **and** flow proposals) are both **done**. The
> chat ↔ flows integration is complete; remaining chat work is the unrelated
> deferrals (attachments `TD-012`, message actions `TD-015`, usage `TD-016`).
