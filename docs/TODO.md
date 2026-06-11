# Backlog / TODO

Single source of truth for deferred work. Code must **not** carry free-floating
`TODO` notes — instead reference an ID here (e.g. `// see docs/TODO.md TD-001`).

Status: ⬜ `open` · 🟡 `in-progress` · ✅ `done` · `wontfix`
Priority: `P1` (blocks a feature) · `P2` (should do soon) · `P3` (nice to have)

| ID | Title | Area | Priority | Status |
|----|-------|------|----------|--------|
| [TD-001](#td-001--desktop-oauth-connector-callback-round-trip) | Desktop OAuth connector callback round-trip | Connectors | P1 | ⬜ open |
| [TD-002](#td-002--feature--technical-spec-docs-for-the-three-settings-pages) | Spec docs for Configuration / Connectors / Knowledge | Docs | P2 | ✅ done |
| [TD-003](#td-003--unit-tests-for-the-three-new-features) | Frontend unit-test suite (Vitest) | Testing | P2 | ✅ done |
| [TD-004](#td-004--verify-multipart-knowledge-upload-against-the-live-backend) | Verify multipart Knowledge upload end-to-end | Knowledge | P2 | ⬜ open |
| [TD-005](#td-005--client-side-file-validation-for-knowledge-upload) | Client-side file validation for Knowledge upload | Knowledge | P3 | ✅ done |
| [TD-006](#td-006--chat-action-preferences-have-no-consumer-yet) | Chat-action preferences have no consumer yet | Configuration | P3 | ✅ done |
| [TD-007](#td-007--backfill-spec-docs-for-login--providers) | Backfill spec docs for Login + Providers | Docs | P2 | ✅ done |
| [TD-008](#td-008--providers-view-swallows-errors) | Providers view swallows several errors | Providers | P3 | ✅ done |
| [TD-009](#td-009--auth-session-does-not-persist-across-restart) | Auth session does not persist across restart | Login | P3 | ✅ done |
| [TD-010](#td-010--agent-tool-entry-autocomplete-against-apitools) | Agent tool entry: autocomplete against /api/tools | Agents | P3 | ✅ done |
| [TD-011](#td-011--model--temperature-selection-on-standalone-agents) | Model / temperature selection on standalone agents | Agents | P3 | ⬜ open |
| [TD-012](#td-012--chat-attachments--pdf-viewer) | Chat attachments + PDF viewer | Chat | P2 | ✅ done (session view) |
| [TD-013](#td-013--chat-slash-commands--flow-dispatch) | Chat slash commands + flow dispatch | Chat | P3 | ✅ done |
| [TD-014](#td-014--chat-hitl-episodes-ask_user-forms--flow-proposals) | Chat HITL episodes (ask_user forms + flow proposals) | Chat | P2 | ✅ done |
| [TD-015](#td-015--chat-message-actions-edit--branch--regenerate--continue) | Chat message actions (edit / branch / regenerate / continue) | Chat | P3 | ✅ done |
| [TD-016](#td-016--chat-conversation-usage--cost-panel) | Chat conversation usage + cost panel | Chat | P3 | ✅ done |
| [TD-017](#td-017--evaluate-streamdown-transitive-weight) | Evaluate Streamdown transitive weight | Chat | P3 | ✅ done |
| [TD-018](#td-018--historical-tool-call-badges-not-rehydrated) | Historical tool-call badges not rehydrated | Chat | P3 | ✅ done |
| [TD-019](#td-019--chat-markdown-katex-math--sketchon-diagrams) | Chat markdown: KaTeX math + sketchon diagrams | Chat | P3 | ✅ done |
| [TD-020](#td-020--agent-flows-phase-2-interactive-editor) | Agent Flows Phase 2: interactive editor | Flows | P2 | ✅ done |
| [TD-021](#td-021--flow-editor-advanced-sub-features) | Flow editor: advanced sub-features | Flows | P3 | ✅ done (parity) |
| [TD-022](#td-022--chat-account-menu-avatar--sign-out) | Chat account menu (avatar + sign-out) | Chat | P2 | ✅ done |
| [TD-023](#td-023--appearance-page--lightdarksystem-theme-toggle) | Appearance page + light/dark/system theme toggle | Settings | P2 | ✅ done |
| [TD-024](#td-024--conversation-history-browser) | Conversation history browser (search + infinite scroll) | Chat | P2 | ✅ done |
| [TD-025](#td-025--generated-document-cards--reader-create_pdf) | Generated-document cards + reader (create_pdf) | Chat | P2 | ✅ done |
| [TD-026](#td-026--appearance-full-tweakcn-palette-parity) | Appearance: full TweakCN palette parity | Settings | P3 | ⬜ open |
| [TD-027](#td-027--integration--e2e-test-suite-tiers-1--2--manual-doc) | Integration + E2E test suite (Tiers 1 & 2 + manual doc) | Testing | P2 | ✅ done |
| [TD-028](#td-028--true-tauri-window-e2e-deferred-to-windows) | True Tauri-window e2e (native seam) — deferred to Windows | Testing | P3 | ⬜ open |

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

## TD-003 — Frontend unit-test suite (Vitest)

**Area:** Testing · **Priority:** P2 · **Status:** ✅ done (2026-06-10)

**What:** The frontend shipped without any tests. Now stood up the full suite,
mirroring the web app's stack (Vitest + Testing Library + jsdom + MSW).

**Resolved:** Vitest infra (`vitest.config.ts`, `src/__tests__/setup.ts`,
`pnpm test`/`test:run`/`test:coverage`; tests excluded from the `tsc` build).
**238 tests across 55 files**, all green, covering every testable layer:
- **domain/utils** — `formatCost`, `slugify`, `parseJwt`.
- **mappers** (all 11) — snake→camel + null-coalesce + payload serializers.
- **repositories** (all 13, MSW) — request shapes, response mapping, 404 →
  null/[]/zero-state, multipart endpoints.
- **services** (all 14) — delegation + `AuthService` bootstrap/login/logout logic.
- **chat utils** — `normalizeMathDelimiters`, `rehypeSketchon`.
- **HITL validators**, **slash regex**, **`useSmoothStreamingText`**.
- **flow editor** — `graphToYaml` serialization round-trip, `useFlowEditorStore`
  actions (incl. `updateEdgeData` all-or-none strip), `connectionRules`, `editorTypes`.
- **react-query hooks** — conversations (usage/mutations/`invalidateConversationListQueries`
  predicate/delete-race), flows, tools, mcp-connectors, pragna slash, chat-models filter.
- **components** — `MessageActions`, `AttachmentChip`, `ReasoningPanel`, `ModelBadge`,
  `SketchonDiagram` (mocked sketchon/dompurify), `ConversationListItem` cost chip,
  `EdgePanel` dynamic-dispatch UI (`TD-021`).
- **desktop-only** — `isTauriRuntime`, `secureStore` (mocked Tauri `invoke`),
  `tauriHttpAdapter` (mocked native fetch — text/json/blob/arraybuffer, multipart
  Content-Type strip, error wrapping).

**Coverage:** report-only (no threshold gate — chosen so the build never fails on
an arbitrary bar). `pnpm test:coverage` reports ~24% global statements: the tested
logic/data/hook layers are high; the large view/orchestration components
(`ChatSessionView`, `FlowEditor`, `App`, routers, big views) are unit-untested —
they're integration-test territory (heavy provider/reactflow/router wiring, mostly
JSX + wiring) and out of scope for this unit pass.

**Deferred (not unit tests):** end-to-end `useChatSession` SSE streaming, live
Tauri/IPC, and visual/e2e — a separate integration effort.

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

**Area:** Configuration · **Priority:** P3 · **Status:** done (2026-06-09)

**Resolved:** `ChatSessionView` now reads `useChatPreferences` (`pragna:chat-prefs`)
to gate the message-action affordances — `branchEnabled` shows/hides the Branch
button; `regenWithModelEnabled` shows/hides the regenerate-with-model dropdown.
Shipped with [TD-015](#td-015--chat-message-actions-edit--branch--regenerate--continue).

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

**Area:** Chat · **Priority:** P3 · **Status:** done (2026-06-09)

**Shipped:** per-message hover actions. Conversation layer gained `truncateFrom`
(`POST …/messages/truncate-from`) + `branch` (`POST …/branch`) on the port/service/
repository + `useTruncateFromMessage`/`useBranchConversation`. `useChatSession`
gained `sendWithModel` (wrapper over `sendWithOverrides({userModelId})`).
`MessageActions` (edit/branch on user; regenerate/regenerate-with-model/copy on
assistant) + inline edit + a Continue button (when the last assistant turn's
persisted `finishReason === 'length'`). `ChatSessionView` orchestrates: edit/
regenerate = truncate-then-resend, branch = fork + handoff + navigate, continue =
`send(CONTINUE_PROMPT)`. Closes [TD-006](#td-006--chat-action-preferences-have-no-consumer-yet)
(prefs gate Branch + regen-with-model). Specs: `docs/specs/{features,technical}/
message-actions.md`. Deviations (no functional impact) logged in
`docs/web-app-parity.md` §4.

**Live-verify (needs backend):** truncate-from + branch endpoints; that branch's
re-send doesn't duplicate the branch-point turn (mirrors web-app behavior).

---

## TD-016 — Chat conversation usage + cost panel

**Area:** Chat · **Priority:** P3 · **Status:** ✅ done (2026-06-10)

**What:** Surface per-conversation token usage + cost from
`GET /api/conversations/{id}/usage` (a `useConversationUsage` hook + the
`getUsage` repo method, both deferred from Phase 1).

**Resolved — built to match the web app (a sidebar cost chip, not a header
panel).** Verified the web app's only usage UI is the per-row total-cost chip in
`ConversationListItem` (commit `541aa2a`); ported it faithfully rather than the
header-panel wording above. Added `ConversationUsage`/`UsageRecord` types,
`mapConversationUsage` (snake→camel; `cost_usd`/`total_cost_usd` kept as strings to
preserve `Decimal` precision), `getUsage` on the port/service/repo (404 →
zero-state aggregate, matching `get`/`getMessages`), and `useConversationUsage`
(key `['conversations', id, 'usage']`, `USAGE_STALE_MS` 60s, `enabled` on id). The
sidebar row shows a quiet running-total chip via the existing `formatUsd`, hidden at
`$0` and faded on hover/focus so the row actions take the slot. Usage is **not**
invalidated on run-finalize (matches the web app — the chip catches up within the
staleness window). The per-call `records[]` / token splits are fetched but, like the
web app, not displayed. Deviations (chip layout, 404-guard location, externalised
staleTime) are no-impact — see `docs/web-app-parity.md` §4/§5.

**Live-verify:** needs `pnpm tauri dev` + backend with a cost-incurring
conversation to confirm the chip renders the running total.

---

## TD-017 — Evaluate Streamdown transitive weight

**Area:** Chat · **Priority:** P3 · **Status:** ✅ done (2026-06-10)

**What:** `streamdown` (the chat markdown renderer) pulls in heavy **lazy** chunks
— mermaid (~885 kB), cytoscape (~443 kB), a wasm blob (~622 kB), wardley, and the
full Shiki language-grammar set. They are code-split (only fetched when such a
block renders), so the eager bundle is unaffected, but the on-demand footprint is
large for "core chat."

**Where:** `src/presentation/views/chat/components/MarkdownMessage.tsx`; bundler
config.

**Resolved — decision: keep Streamdown.** The "switch to react-markdown" option
was moot: the **web app already uses Streamdown `^1.6.11`** (the same version), so
switching would *create* drift against the parity rule, not reduce footprint
(react-markdown is only Streamdown's transitive dep). The heavy chunks are
confirmed **code-split** — a production `pnpm build` emits mermaid (2.96 MB),
cytoscape (443 kB), wasm (622 kB), wardley (612 kB), and each Shiki grammar as
**separate lazy chunks**; the eager `index` bundle (~398 kB) is unaffected and
only loads a diagram/grammar chunk when such a block actually renders. The
footprint is therefore an accepted, documented cost of matching the web app's
renderer (see `docs/web-app-parity.md` §5). Closed together with `TD-019`.

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

**Area:** Chat · **Priority:** P3 · **Status:** ✅ done (2026-06-10)

**What:** Phase 1's `MarkdownMessage` renders standard markdown + code
highlighting but omits the web app's KaTeX math pass and the custom `rehypeSketchon`
diagram plugin (`<sketchon-diagram>`).

**Where:** `src/presentation/views/chat/components/MarkdownMessage.tsx`.

**Resolved:** `MarkdownMessage` is now a faithful port of the web app's renderer.
Added: `katex/dist/katex.min.css` + `normalizeMathDelimiters` (`\(…\)`/`\[…\]` →
`$…$`/`$$…$$`) for KaTeX math; `rehypeSketchon` (appended after
`defaultRehypePlugins`, past rehype-harden) + `SketchonDiagram`
(`@sgummalla-works/sketchon`, DOMPurify-sanitized SVG, Copy-PNG/Download-SVG) for
inline diagrams; `shikiTheme`/`controls` config, a mermaid wheel-zoom throttle, and
`useSmoothStreamingText` + a per-block fade-in for the smooth streaming reveal
(`isStreaming` threaded from `ChatMessage`). New constants in `constants/markdown.ts`;
`katex` pinned as an explicit dep (pnpm strict layout). One porting adaptation:
`SketchonDiagram` reads light/dark from the **`.dark` class** (desktop signal) vs the
web app's `data-theme` — see `docs/web-app-parity.md` §4. Closed with `TD-017`.

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

**Area:** Flows · **Priority:** P3 · **Status:** ✅ done for parity (2026-06-10);
non-parity items (reducers UI, editable YAML view) intentionally deferred.

**Resolved:** the two parity gaps shipped — **dynamic-dispatch fan-out** editing in
`EdgePanel` (a "Send per item" toggle + items-slot/item-slot dropdowns, gated by the
same source/target rules as the web app, written all-or-none via `updateEdgeData`)
and **connector inline-register** in `ConnectorPanel` (an add-dialog "Register a new
connector" button opens the shared `AddConnectorWizard`, whose new `onRegistered`
callback attaches the result to the node). Context-slot **inputs/outputs** editing
was already present in `NodePanel`. See `agent-flows.md` (feature + technical) and
`docs/web-app-parity.md` (connector-register UI deviation). **Live-verify** on a
`pnpm tauri dev` + backend pass.

**What (original):** The interactive editor (TD-020) omitted the editing **UI** for
the most advanced sub-features, though their data round-trips losslessly through
`buildEditorGraph`/`graphToYaml`/the store. **Classified against the web app
(verified 2026-06-10)** — items 1–3 were assessed as genuine parity gaps (the web
app has the editing UI; we don't), the rest are not:

**Parity gaps — web app HAS the editor UI, desktop must build to match:**
- **Dynamic-dispatch fan-out** (#35: `dispatch_mode`/`items_slot`/`item_slot`) —
  web app `EdgePanel.tsx` has a "Send per item" toggle + two slot dropdowns; desktop
  `EdgePanel` shows only the routing-condition select (the fields round-trip via the
  store but have no editor). **Gap.**
- **Connector inline-register** — web app `ConnectorPanel.tsx` opens a modal to
  either pick an existing MCP connector OR register a new one inline; desktop only
  picks from already-connected connectors (`useMcpConnectors`). **Gap.**

**Already at parity (verified 2026-06-10) — no work needed:**
- **Context slots — inputs/outputs** (#26) — the desktop `NodePanel.tsx` **already**
  has the "Context variables (advanced)" section with the two `ChipInput`s wired to
  `updateNode(nodeId, { inputs/outputs })`, identical to the web app. Not a gap (the
  earlier draft of this entry was wrong).

**NOT parity (web app does not have these) — only justified as documented
deviations, otherwise drop:**
- **Context slots — reducers** — in the web app `reducers` only round-trips through
  serialization (`editorTypes.ts`/`graphToYaml.ts`/`buildEditorGraph.ts`); there is
  **no editor UI** for it. Same as desktop today → not a gap; leave to YAML.
- **Editable YAML / source view** — the web app's "Flow YAML" modal is **read-only**
  (`editable={false}`; copy / export / import-to-replace only). Desktop's Phase-1
  editable CodeMirror panel was actually *ahead* of the web app; re-adding it would
  be a **deliberate enhancement (deviation)**, to be recorded in
  `docs/web-app-parity.md` if built — not a sync item.

**Where:** `src/presentation/views/settings/FlowDetailView/{EdgePanel,ConnectorPanel}.tsx`.

**Done when:** the two parity-gap sub-features (dispatch fan-out, connector
inline-register) are editable in the UI to match the web app; reducers +
editable-YAML stay deferred unless explicitly chosen as documented enhancements.

---

## TD-022 — Chat account menu (avatar + sign-out)

**Area:** Chat · **Priority:** P2 · **Status:** ✅ done (2026-06-10)

**What:** Surfaced via the chat-area parity audit (2026-06-10). The desktop had
**no sign-out affordance reachable from the running app** — the only `logout()`
button lived on the orphaned `HomeView`, no longer in the routed flow now that
the real chat surface shipped. The web app puts an `AvatarMenu` in the chat
sidebar footer (avatar → email + Settings + Sign out).

**Resolved:** added `AvatarMenu` (`src/presentation/views/chat/components/
AvatarMenu.tsx`) to the `ChatSidebar` footer, replacing the bare Settings link.
Built on the unified `radix-ui` `DropdownMenu` (no new dependency); delegates
identity + teardown to the existing `useAuth` hook. Sign out resets the auth
store (→ `ProtectedRoute` redirect) and navigates to `/login`. Spec pair
`account-menu.md` (feature + technical); deviation (no collapsed mode — the
desktop rail isn't collapsible) recorded in `docs/web-app-parity.md` §4. Tests:
`AvatarMenu.test.tsx` (6). Pointer-capture polyfills added to `src/__tests__/
setup.ts` so Radix menus open under jsdom.

---

## TD-023 — Appearance page + light/dark/system theme toggle

**Area:** Settings · **Priority:** P2 · **Status:** ✅ done (2026-06-10)

**What:** Surfaced via the settings-area parity audit (2026-06-10). The desktop
had `:root` (light) and `.dark` token sets in `index.css` but **no UI to switch
between them** — `/settings/appearance` was a `PlaceholderView` stub. The web app
has a real Appearance page (mode toggle + TweakCN palette grid).

**Resolved (toggle only):** added `AppearanceView`
(`src/presentation/views/settings/AppearanceView/AppearanceView.tsx`) with a
Light/Dark/System selector, backed by a new `themeStore`
(`src/presentation/store/themeStore.ts`) that persists to
`localStorage['pragna:theme']` and toggles the `.dark` class on `<html>`.
`System` follows the OS via `prefers-color-scheme` and tracks live changes;
`initTheme()` is called from `main.tsx` before first paint. Constants in
`src/constants/theme.ts`. Router points `/settings/appearance` at the real view.
Spec pair `appearance.md` (feature + technical). Tests: `themeStore.test.ts` (6),
`AppearanceView.test.tsx` (4). Deviation (default `system`; separate store) in
`docs/web-app-parity.md`. Full TweakCN palette parity tracked as TD-026.

---

## TD-027 — Integration + E2E test suite (Tiers 1 & 2 + manual doc)

**Area:** Testing · **Priority:** P2 · **Status:** ✅ done (2026-06-10)

**What:** The unit suite covers logic/data/hooks but left the view/orchestration
components at ~0% — the integration glue unit tests shouldn't cover. Bring the
desktop to the web app's bar with **Tier 1** component-integration tests (Vitest
+ jsdom — real views, mock services) and **Tier 2** browser e2e (Playwright vs a
real local stack), plus a desktop-owned manual-testing doc. Plan:
`docs/plans/integration-e2e-tests.md`. Spec pair `integration-e2e-tests.md`
(feature + technical).

**Done so far:**
- **Harness (Phase 1):** self-contained `e2e/` Playwright sub-workspace (npm,
  isolated) driving the desktop FE in browser-fallback mode against a real local
  stack; **seed-token auth** (no login UI — `global-setup.ts` mints a real
  local-BE access JWT + an unsigned decodable ID token; `fixtures.ts` injects
  both into sessionStorage so `Auth0Repository.me()` resolves locally with no
  Auth0 network). `scripts/{setup,teardown,seed-model}-stack.sh`. Smoke spec
  green (seeded → authed `/chat`; unseeded → `/login`).
- **Tier 1 (Phase 2):** shared `src/__tests__/renderWithProviders.tsx` + 22
  co-located view `*.test.tsx` for the high-value 0%-coverage views (chat,
  connectors, flows, settings, auth). Suite **65→88 files / 281→452 tests**;
  coverage **~24%→~56% lines** (above the web app's ~46%). `tsc` clean.

- **Tier 2 (Phase 3):** ported the web app's parity specs into `e2e/tests/` —
  settings (connector-manage, knowledge-manage, agent-connector-attach,
  agent-knowledge-attach), flow editor (flow-editor + scenarios 5/7/8/9/10/16/17
  + flow-design probes), documents (create-pdf render + sketchon), and the chat
  group (skip-gated on `E2E_ANTHROPIC_API_KEY`). Added reusable helpers
  (`canvas`, `flow-author`, `db`, `network`, `seed` + `seed_pdf_conversation.py`)
  and minimal `data-testid`s to flow/chat source. **Full e2e suite: 29 passed,
  11 skipped (LLM-gated), 0 failed.** The Tier-1 jsdom limits (ReactFlow canvas,
  Radix Select open-menu) are now covered here in a real browser.
- **Bugs found + fixed by the Tier-2 suite** (see `docs/CODE_FIXES.md`): CF-001
  (Radix Select dropdowns behind `z-[700]` modal overlays → unclickable), CF-002
  (missing Vite `process.env` shim → "process is not defined" crash on the chat
  view), CF-003 (**backend** `create_pdf_long` reportlab `LayoutError` on large
  tables — OPEN, in `pragna2-api`), CF-004 (StrictMode dev double-invoke aborted
  the first chat turn → e2e runs without StrictMode). All flagged for web-app /
  backend cross-check.
- **Manual doc (Phase 4):** `docs/MANUAL_TEST_SCENARIOS.md` (M1–M9) covers the
  un-automatable residue (streaming feel, reduced-motion, PDF fidelity, MCP
  OAuth consent, native keychain/social-login/file-dialogs).
- **Live-LLM keyed tier (best-effort, NOT the CI gate):** the real-LLM chat
  scenarios self-skip without `E2E_ANTHROPIC_API_KEY`; with a key they exercise
  the real path and pass individually, but are **non-deterministic in aggregate**
  (model latency/tool-choice under the serial single-DB suite), so they are a
  keyed best-effort tier, not part of the deterministic gate. The **deterministic
  gate is the keyless suite: 29 passed / 0 failed.** `fixme` specs: scenario-14
  (known lost-reply bug), scenario-19 (model tool-choice non-deterministic;
  render path covered by the seeded scenario-20), scenario-21 ×2 (blocked on
  CF-003). To run the keyed tier: put keys in `/tmp/e2e-keys.env`, `npm run
  setup`, `set -a; . /tmp/e2e-keys.env; set +a; npm test`.
- **Deferred:** the native Tauri-window seam is TD-028.

---

## TD-028 — True Tauri-window e2e (native seam) — deferred to Windows

**Area:** Testing · **Priority:** P3 · **Status:** ⬜ open (deferred)

**What:** Tiers 1 & 2 (TD-027) run the React frontend in a browser; they cannot
exercise the **native seam** — OS keychain persistence (`secureStore`), native
HTTP (`tauriHttpAdapter`), and the loopback OAuth flow
(`tauriLoopbackAuthFlow`). A true Tauri-window e2e layer would cover these.

**Why deferred:** the official `tauri-driver` has **no macOS support** (no
WKWebView WebDriver) — it runs on **Windows/Linux only**. The dev machine is a
Mac, so this can't run here today. The native seams are already unit-tested and
their user-visible behavior is captured in the manual doc, so deferring loses no
practical coverage now.

**When taken up (build on Windows/Linux):** a `tauri-driver` + WebdriverIO (or
`@crabnebula/tauri-driver`) harness under `e2e-tauri/`, covering keychain
"stay signed in" across restart, native cross-origin HTTP, and system-browser
loopback OAuth. No re-research needed — the macOS limitation, target platforms,
covered seams, and candidate tooling are all recorded here.

---

## TD-026 — Appearance: full TweakCN palette parity

**Area:** Settings · **Priority:** P3 · **Status:** ⬜ open

**What:** The web app's `AppearanceView` (235 LOC) also offers a **palette grid**
(bundled + installed palettes, preview swatches, "Active"/"Installed" badges) and
an **Import from TweakCN** dialog (paste/upload JSON) with uninstall. The desktop
shipped the **mode toggle only** (TD-023); the palette layer is deferred.

**When taken up:** port the web app's `themes/` registry (`registry.ts`,
`tweakcn.ts`, bundled palettes) + `ImportThemeDialog`, extend `themeStore` with a
`paletteId` slice (persisted) that applies palette CSS variables alongside the
`.dark` class, and add the palette grid + import dialog to `AppearanceView`.
Reference: `pragna2_sgummalla_works/src/presentation/views/settings/AppearanceView/`
and `src/themes/`.

---

## TD-025 — Generated-document cards + reader (create_pdf)

**Area:** Chat · **Priority:** P2 · **Status:** ✅ done (2026-06-10)

**What:** Surfaced via the chat-area parity audit (2026-06-10). Assistant-generated
PDFs (backend `create_pdf_short`/`create_pdf_long`) were already plumbed onto
messages but rendered as a tiny `AttachmentChip`, and the `create_pdf` tool showed
a raw-JSON badge. The web app renders a prominent `DocumentCard` + opens a reader,
and suppresses the document-tool badge.

**Resolved:** added `DocumentCard`
(`src/presentation/views/chat/components/DocumentCard.tsx`) — full-width card
(icon, title sans `.pdf`, "Document · PDF", Download) — rendered for assistant
attachments in `ChatMessage`; user uploads still render as chips. Document-tool
badges suppressed via a new `src/constants/documentTools.ts`. Open routes through
the existing `AttachmentViewer` (no separate `PdfCanvas`; `useAttachmentBlob` ≈
the web app's `usePdfDocument`); download via a new `src/lib/download.ts`. Spec
pair `generated-documents.md` (feature + technical). Tests: `download` (1),
`DocumentCard` (5), `ChatMessage.documents` (3). Deviations (reuse viewer; no
long-PDF episode progress) in `docs/web-app-parity.md`.

---

## TD-024 — Conversation history browser

**Area:** Chat · **Priority:** P2 · **Status:** ✅ done (2026-06-10)

**What:** Surfaced via the chat-area parity audit (2026-06-10). The desktop only
showed recent conversations in the sidebar — no way to browse/search/page the
full history. The web app has a full-width `ChatsBrowserView`.

**Resolved:** added `ChatsBrowserView`
(`src/presentation/views/chat/ChatsBrowserView.tsx`) at a new `/chat/history`
route (static, ranks above `:id`), reachable from the sidebar's **All chats**
entry. Title search (client-side), infinite scroll via `useInfiniteConversations`
(`useInfiniteQuery` over `conversationService.list({limit,offset})`, short-page =
end signal) + an `IntersectionObserver` sentinel, and relative timestamps via a
new pure `domain/utils/relativeTime.ts`. Spec pair `conversation-history.md`
(feature + technical). Tests: `relativeTime` (5), `useInfiniteConversations` (3),
`ChatsBrowserView` (6). Deviation (route vs. the web app's browse-mode flag) in
`docs/web-app-parity.md`.

---

> **Cross-link:** the chat ↔ flows integration was unblocked by the Agent Flows
> flow layer (`useFlows`, `FlowService`, `flow.types`).
> [TD-013](#td-013--chat-slash-commands--flow-dispatch) (chat slash dispatch) and
> [TD-014](#td-014--chat-hitl-episodes-ask_user-forms--flow-proposals) (chat HITL
> episodes — ask_user pause/resume **and** flow proposals) are both **done**. The
> chat ↔ flows integration is complete; the previously-deferred chat work
> (attachments `TD-012`, message actions `TD-015`, usage `TD-016`, full markdown
> renderer `TD-017`/`TD-019`) is now **all done**.
