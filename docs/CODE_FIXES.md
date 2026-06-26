# Code Fixes Log

A running log of **bug fixes** (corrections to broken behavior — not new features). Every fix to
existing code is recorded here per the `CLAUDE.md` rule "Document Every Bug Fix".

**Purpose:** the desktop app (`pragna2_desktop_app`) and the web app (`pragna2_sgummalla_works`)
share architecture and many components, so a defect found on one side very often exists on the other.
This log is the hand-off the team uses to apply the same fix to the web app when needed.

Each entry: **date · area/file · the bug + root cause · the fix · web-app applicability.**

---

## CF-050 — Regenerating a generated-PDF answer re-sends an orphaned tool_call → backend 400 ("response could not be completed")

- **Date:** 2026-06-26
- **Tracker:** nexus-kit-tracker #230.
- **Area / file:** `src/infrastructure/agui/sanitizeToolCalls.ts` (new), `src/infrastructure/agui/TauriHttpAgent.ts` (`run()` override). Extends **CF-049** (edit path, `truncateLocalFrom`) and **CF-047** (this is the precise trigger CF-047 gated-but-couldn't-reproduce).
- **Found by:** Repro — generate a PDF → click **Regenerate** on the PDF card → "The response could not be completed due to an unexpected error. Please try again." Same OpenAI `400 invalid_request_error` (unanswered `tool_call_id`) as CF-049's edit case.
- **Bug + root cause:** Same root class as CF-049 (the in-memory seed re-attaches an assistant turn's `tool_calls` for badges, but the backend folds the tool **result inline** into `PersistedToolCall.result` and returns **no `role:'tool'` message** — so every historical tool turn is an assistant `tool_calls` with no answering tool message; the BE normally repairs the pair from its checkpoint, and a truncation severs that repair). **Why CF-049 didn't cover it:** a PDF turn renders as two assistant rows — the `tool_calls` machinery row and the final answer/attachment row. Regenerate is offered only on the **answer** row (no `tool_calls`, so CF-047's `isToolCallRow` gate doesn't hide it). `onRegenerate` truncates from that answer row, but the orphaned `tool_calls` row sits **before** it, so `truncateLocalFrom` (CF-049) cannot remove it — the orphan survives into the resend → 400.
- **Fix:** Sanitize the **outgoing** AG-UI history at the transport boundary. New pure `sanitizeToolCallPairs(messages)` keeps only fully-paired tool calls (an assistant declaring a `tool_call` id AND a `role:'tool'` message answering it): it strips unanswered `tool_calls` (keeping the assistant prose), drops a bare unanswered tool-call row, and drops orphan tool results. `TauriHttpAgent.run()` applies it to `input.messages` (a clone built by `prepareRunAgentInput`) before `requestInit`, so the POSTed body never carries a dangling `tool_call` while the agent's in-memory `messages` — and thus the rendered transcript's historical tool-call badges — are untouched (no flicker). Structure-agnostic: fixes regenerate, edit, and ordinary follow-ups regardless of one- vs two-message tool-turn persistence; the FE no longer relies on the backend to repair the pairing. Tests: `sanitizeToolCalls.test.ts` (8, pure fn incl. regenerate regression) + `TauriHttpAgent.run.test.ts` (3, body sanitized / in-memory untouched / valid pair preserved).
- **Web-app applicability:** **CHECK — likely present.** `pragna2_sgummalla_works` shares the seed/no-tool-row pattern; it uses the stock `HttpAgent` (browser fetch), so port `sanitizeToolCallPairs` and apply it at its agent's outgoing boundary (override `run`/`requestInit` or sanitize before `runAgent`). Track under `target:web-fe`.

## CF-049 — Editing a message that generated a PDF re-sends an orphaned tool_call → backend 400 ("response could not be completed")

- **Date:** 2026-06-26
- **Tracker:** nexus-kit-tracker #230.
- **Area / file:** `src/presentation/views/chat/utils/messageTruncation.ts` (new), `src/presentation/views/chat/hooks/useChatSession.ts` (new `truncateLocalFrom`), `src/presentation/views/chat/ChatSessionView.tsx` (edit + regenerate + regenerate-with-model handlers). Related: **CF-047** (same error string, regenerate path — gated the button but couldn't pin the trigger; this is the underlying mechanism), CF-015 (`pruneOrphanedOptimisticMessage`, the sibling in-memory-history prune).
- **Found by:** Repro — prompt that generates a PDF (a collapsed `create_pdf` tool turn) → **edit** that user message → save & submit → UI shows "The response could not be completed due to an unexpected error. Please try again." Live `nexus-kit-api` log: OpenAI `400 invalid_request_error` — *"An assistant message with 'tool_calls' must be followed by tool messages responding to each 'tool_call_id'. The following tool_call_ids did not have response messages: call_du4…"* at `messages.[7]`.
- **Bug + root cause:** Edit/regenerate first call the backend `messages/truncate-from` (deletes the message + successors **server-side only**) then re-send. But the agent's in-memory `agent.messages` was **never pruned** to match — `truncate.mutate` only invalidates the messages query (an async refetch that hasn't resolved when `send()` fires in the same `onSuccess`). ag-ui streams the whole stale in-memory list as the turn's history. A collapsed PDF turn is seeded (`persistedToAGUIMessage`) as an assistant message carrying `tool_calls` but **no paired `role:'tool'` result** (the BE persists such a turn as a single assistant message — see `useReconcileMessages.isCollapsedToolTurn`), so the re-sent history contains an **orphaned assistant tool-call**. Ordinary follow-ups survive because the BE repairs the orphan from its own checkpoint; `truncate-from` deletes those rows, removing the repair source, so the orphan reaches the provider → 400. (This is the precise trigger CF-047 could not reproduce in isolation.)
- **Fix:** Restore the invariant "in-memory history mirrors the persisted log before a re-send." New pure helper `truncateMessagesFrom(messages, messageId)` drops the target message + everything after it; new hook method `truncateLocalFrom(messageId)` commits it to `agent.messages` and re-syncs. The three truncate-then-resend handlers (`onEdit`, `onRegenerate`, `onRegenerateWithModel`) call it in `onSuccess` **before** the resend. The orphaned assistant tool-call is no longer in the outgoing history. Display-correct: the truncated turn *should* vanish from the transcript, matching the eventual refetch (no badge flicker — unlike a universal strip-before-send, which would flicker the historical PDF badge on every normal follow-up). Tests: `messageTruncation.test.ts` (7, pure helper incl. orphan-removal regression) + `useChatSession.truncateLocal.test.tsx` (4, hook-level: edit + regenerate drop the orphan, earlier tool turn preserved, no-op when id absent).
- **Web-app applicability:** **CHECK — likely present.** `pragna2_sgummalla_works` shares `useChatSession` + `ChatSessionView` + the seed/no-prune-on-truncate pattern, so the same edit-a-PDF-turn 400 almost certainly reproduces there; port `truncateMessagesFrom` + `truncateLocalFrom` and wire the same three handlers (track under `target:web-fe`).

## CF-048 — Blocked (non-http) markdown link renders a literal " [blocked]" marker (nexus-kit-tracker #227)

- **Date:** 2026-06-26
- **Area / file:** `src/presentation/views/chat/components/MarkdownMessage.tsx`, `src/constants/markdown.ts`. Refs tracker #227 (FE) + #228 (BE root cause).
- **Found by:** A generated-PDF reply rendered "view and download it here **[blocked]**". Captured the real assistant content live (`nexus-kit-api`): the model emits a phantom link `[…](sandbox:/mnt/data/Q3_Status.pdf)` — an OpenAI-sandbox path that resolves to nothing here (the real file is the persisted attachment / DocumentCard).
- **Bug + root cause:** The markdown sanitizer (Streamdown's bundled `rehype-harden`) allows only `http(s)` URLs under its `["*"]` wildcard, so it **blocks** the `sandbox:` scheme. Its default `linkBlockPolicy: "indicator"` keeps the dead link and appends a literal `" [blocked]"` to the link text — the marker the user saw. `MarkdownMessage` rebuilds Streamdown's default rehype chain (to append the `sketchon` plugin), so it owns the harden options.
- **Fix:** Override harden's `linkBlockPolicy` to `"text-only"` (externalised as `MARKDOWN_BLOCKED_LINK_POLICY`, no-hardcoding) when rebuilding the rehype chain, so a blocked link degrades to its **plain child text** — no dead anchor, no `[blocked]` marker. Legitimate `http(s)` links are untouched (still clickable). Regression test: `sandbox:` link → clean text, no `[blocked]`, no anchor; `https` link → still a working anchor (red without the override, green with it). NOTE: the phantom-link **root cause is backend** — the model shouldn't emit a `sandbox:` link; filed as #228 (`target:backend`), not fixed here per the no-cross-repo rule.
- **Web-app applicability:** **CHECK — likely present.** `pragna2_sgummalla_works` shares the markdown renderer + Streamdown config; apply the same `linkBlockPolicy` override (track under `target:web-fe`).

## CF-047 — Regenerate offered on a tool-call row triggers a mid-turn re-run failure (nexus-kit-tracker #226)

- **Date:** 2026-06-26
- **Area / file:** `src/presentation/views/chat/components/ChatMessage.tsx`. Refs tracker #226.
- **Found by:** Clicking **Regenerate** on a generated-PDF (tool/activity) row surfaced "The response could not be completed due to an unexpected error. Please try again." — a **backend run-failure message** surfaced verbatim by the FE (`classifyRunErrorEvent`); the string is not in the FE.
- **Bug + root cause:** The Regenerate affordance rendered on **every** non-streaming assistant message (no answer-vs-intermediate gate). A tool turn spans **multiple** assistant rows (the empty-content `tool_calls` row + the final answer); `onRegenerate` truncates from the *clicked* message, so regenerating a non-answer row re-runs the conversation from a **mid-turn boundary**. Regenerate is only meaningful on the turn's final text reply. (The exact BE failure was **not reproducible in isolation** — the BE tolerated both an orphaned tool row and a dangling `tool_calls` in direct live tests — so the precise trigger is BE-side/state-dependent; regardless, regenerating a tool-call row is never a valid action.)
- **Fix:** Suppress the Regenerate action on any assistant message that carries `tool_calls` (`isToolCallRow`); it renders only on the final answer (no tool calls). The DocumentCard / agent + model badges still render. Tests: tool-call row → no Regenerate (card still renders); final text answer → Regenerate present.
- **Web-app applicability:** **CHECK — likely present.** `pragna2_sgummalla_works` shares `ChatMessage` / `MessageActions`; apply the same gate (track under `target:web-fe`).

## CF-046 — Activity umbrella omitted output-tool calls (document / propose-flow), so a create_pdf turn showed no activity (nexus-kit-tracker #225)

- **Date:** 2026-06-26
- **Area / file:** `src/presentation/views/chat/components/AssistantTurn.tsx`, `src/presentation/views/chat/utils/assistantTurns.ts`. Refs tracker #225.
- **Found by:** A `create_pdf_short` turn rendered the answer + DocumentCard but **no Activity umbrella** — the user could not see in the activity log that a tool was called. Confirmed live that the BE **persists** the tool call (`tool_calls` on the assistant row), so the omission was purely presentational.
- **Bug + root cause:** `AssistantTurn` folded only **plain** tool calls into the umbrella (`isPlainToolCall`), deliberately excluding **output/interactive** tools — document tools (`create_pdf_*`) and propose-flow — which rendered only their card (FEAT-002 design intent: "the card is the deliverable, don't duplicate it"). For a document-only turn that left the umbrella empty, hiding the fact that a tool ran.
- **Fix:** Fold **every** tool call into the umbrella as an activity step regardless of tool type; output/interactive messages still render their card **outside** (the document / flow-proposal card is the deliverable, the umbrella row is the audit log). Intentionally revises the FEAT-002 behavior. Tests: document-tool call shows in the umbrella AND its card renders outside (no false "no reply" notice); propose-flow shows in the umbrella AND its card.
- **Web-app applicability:** **CHECK — likely present.** `pragna2_sgummalla_works` shares `AssistantTurn`; apply the same (track under `target:web-fe`).

## CF-045 — Persisted message log not ordered by `messageIndex`; a tool turn's activity umbrella can mis-group (nexus-kit-tracker #224)

- **Date:** 2026-06-25
- **Area / file:** `src/infrastructure/repositories/ConversationRepository.ts` (`getMessages`). Refs tracker #224.
- **Found by:** Investigating a report that a tool turn's "Activity" umbrella disappears after settle/reload. The report's stated FE root cause (the FE discards empty-content assistant messages) was **disproved** — verified by reproduction tests through the real FE rebuild (`useChatSession` → `groupChatMessages` → `AssistantTurn`) and by a **live capture against the real backend** (`nexus-kit-api`, `GET /conversations/{id}/messages` for a real `create_pdf_short` turn). The empty-content tool row is preserved end-to-end and rendered (TD-018 rehydration + `AssistantTurn` pushing a tool step regardless of empty content). The live capture surfaced the actual latent gap below.
- **Bug + root cause:** `IConversationRepository.getMessages` is **documented** ("ordered by `messageIndex`") but the impl returned `data.map(mapMessage)` — trusting the backend response **array order** rather than enforcing the contract; `messageIndex` was mapped but never used to sort. A tool turn persists as **two assistant rows** — the empty-content `tool_calls` row then the narration row — that carry an **identical `created_at`** (confirmed live: both rows shared `…08.946474+00:00`). Since the timestamp is not a stable tiebreaker, a timestamp-ordered transport could surface the sibling rows out of order; out of order, `groupChatMessages` splits the tool row from its answer and the activity umbrella is mis-grouped (answer alone, plus a separate empty tool-only "no reply" turn). Latent today — the backend currently returns `message_index` order — but a real contract violation.
- **Fix:** Sort the mapped messages by ascending `messageIndex` in `getMessages` via a pure, non-mutating helper `sortByMessageIndex`. Honors the documented port contract and removes the same-timestamp ordering hazard. Regression test added: the messages endpoint serves the rows **out of order** (narration before the tool row, sibling rows sharing `created_at`) and the repo re-sorts to `messageIndex` order with the empty-content tool row's `tool_calls` intact.
- **Web-app applicability:** **CHECK — likely present.** `pragna2_sgummalla_works` shares the repository/mapper architecture; its `getMessages` equivalent should apply the same `messageIndex` sort. Track + apply under `target:web-fe` (its own session, per the no-cross-repo rule).

## CF-043 — "Network Request Failed" in the desktop app against a backend on any non-8000/8001 port (Tauri HTTP allow-list hardcoded)

- **Date:** 2026-06-25
- **Area / file:** `src-tauri/capabilities/default.json` (the `http:default` permission `allow` list). Refs tracker #211.
- **Found by:** Running the Tauri desktop app against the rebranded `nexus-kit-api` backend on **:8181** — every API call failed with "Network Request Failed". (Browser-fallback e2e/dev did NOT show it: only the native Tauri HTTP plugin enforces the capability allow-list; a plain browser bypasses it, so the gap is invisible outside a real desktop window.)
- **Bug + root cause:** The Tauri HTTP capability allow-list **hardcoded the local backend ports** (`http://localhost:8000/*`, `http://127.0.0.1:8000/*`, `:8001`). The native HTTP plugin blocks any request whose URL is not in this list, so once the local backend moved to a different port (here :8181, the all-in-one/external-DB `nexus-kit` container) the desktop app could no longer reach it — surfacing as a generic "Network Request Failed" with no further detail. A No-Hardcoding violation: the reachable port set could change without a redeploy and was pinned in config.
- **Fix:** Replace the four pinned-port entries with **wildcard-port** entries — `http://localhost:*/*` and `http://127.0.0.1:*/*` — so the desktop app can reach a locally-run backend on **any** port (dev / e2e / all-in-one Docker), independent of which port the BE binds. Scoped to loopback hosts only (no broadening of remote-host access; the Auth0 + `*.sgummallaworks.com` entries are unchanged). Same class of rebrand-driven breakage as CF-042 (hardcoded `/pragna` discovery path).
- **Web-app applicability:** **N/A — desktop-only.** The web app makes ordinary browser `fetch` calls (no Tauri capability allow-list), so it has no equivalent port gate. No web-app change needed.

## CF-041 — Generated-document (create_pdf) attachment never surfaces a DocumentCard until manual reload

- **Date:** 2026-06-23
- **Area / file:** `src/presentation/views/chat/hooks/useReconcileMessages.ts` (+ `useReconcileMessages.test.ts`).
- **Found by:** e2e Scenario 19 (`create_pdf` document tool, live LLM) run against the real BE — the run produced the PDF and the BE linked it to the assistant message, but no DocumentCard ever rendered (deterministic, 3/3).
- **Bug + root cause:** A tool-using assistant turn that produces an attachment (e.g. `create_pdf_short`) **streams multiple in-memory messages** — user + tool-call + tool-result + assistant-text (observed: 4) — but the BE **persists them collapsed into ONE assistant message** carrying the attachment (observed: 2). Attachments live ONLY on the persisted message log (live AG-UI messages don't carry them; `useReconcileMessages` swaps in-memory → persisted to pick them up). But the hook's **guard 3** ("never replace when in-memory count exceeds persisted count" — a stale-snapshot protection added for CF-013 / CF-013b) saw `in-memory (4) > persisted (2)` and **permanently blocked the swap**. So the persisted-only attachment never reached `attachmentsByMessageId`, and the DocumentCard appeared only after a manual navigation/refresh (which loads `/messages` fresh — which is why the seeded, fresh-load Scenario 20 always passed while the live Scenario 19 never did).
- **Fix:** Added a narrow, **content-matched exception** (`isCollapsedToolTurn`): when `in-memory > persisted` AND both tails are assistant messages whose whitespace-normalised text matches (equal, or one a prefix of the other), reconcile anyway — that signals the BE collapsed the SAME final turn, not a stale snapshot. A stale snapshot's tail is an OLDER, different-content turn, so CF-013b / #158 / the back-to-back-attachment-turn case stay guarded (a dedicated regression test asserts non-replacement there). Widened the hook's `persisted` param to carry `role` + `content`. 3 new unit tests (collapsed-turn replace, trailing-chunk tolerance, stale-different-content non-replace); 787 total pass. Refreshed Scenario 19's stale viewer assertions while fixing this (PDFs render to a pdf.js `<canvas>`, not a blob `<iframe>` — see CF-036; Download is a button, not a link). **Validation note:** this reconcile fix is verified by the 3 unit tests + the deterministic Scenario 20 (which exercises the same render+card+viewer path). Scenario 19 itself stays `test.fixme` — it depends on the live model *choosing* to call `create_pdf`, which is non-deterministic (confirmed: gpt-4o sometimes answers in prose with a fake download link and never calls the tool), so it is NOT a reliable regression gate.
- **Web-app applicability:** **CHECK — almost certainly present.** `pragna2_sgummalla_works` shares this exact reconciliation hook and the `create_pdf` flow. Any generated-document turn there will hit the same guard-3 block and hide the DocumentCard until reload. Apply the same content-matched exception to its `useReconcileMessages`.

## CF-042 — All chat slash-commands silently broken against a non-`/pragna` backend (discovery endpoint hardcoded)

- **Date:** 2026-06-23
- **Area / file:** `src/constants/api.ts` (new `CHAT_API_PATH`), `src/infrastructure/repositories/PragnaFlowRepository.ts` (+ `PragnaFlowRepository.test.ts`).
- **Found by:** e2e Scenario 03 (slash-exposed flow dispatch) run against the rebranded `nexus-kit` BE (chat route prefix `/api/nexus-kit` instead of `/api/pragna`).
- **Bug + root cause:** `PragnaFlowRepository.listSlashFlows()` hardcoded the discovery path `'/pragna/flows'` (resolving to `/api/pragna/flows`). The chat route prefix is **brand-specific**; against a BE that serves a different prefix the GET **404s**, so the FE's `slashFlowNames` set is empty → **no `/command` is ever recognised** → every slash message falls through to plain chat, where the default agent *proposes* a flow instead of dispatching it. The streaming dispatch had already been made configurable (`VITE_CHAT_API_BASE_URL`), but this discovery read was missed, so it stayed pinned to `/pragna`.
- **Fix:** Derive `CHAT_API_PATH` (the chat surface's path segment relative to the `/api` axios baseURL) from the same configurable `CHAT_API_BASE_URL`, and call `${CHAT_API_PATH}/flows` in the repository — so one env var drives BOTH the streaming dispatch and slash discovery. Unit test updated to assert against `CHAT_API_PATH` rather than a literal prefix.
- **Web-app applicability:** **CHECK.** The web app likely fetches discovery via a relative `/api/pragna/flows` (it uses the Vite dev proxy), so it is less exposed today, but the same hardcoded brand prefix is present — point it at a rebranded BE and slash commands break identically. Externalise the prefix the same way if the web app must support non-`/pragna` deployments.

## CF-039 — Windows app icon appears square (no rounded corners) (pragna2-tracker #198)

- **Date:** 2026-06-22
- **Area / file:** `src-tauri/build.rs`; `src-tauri/icons/icon.ico`, `32x32.png`, `64x64.png`, `128x128.png`, `128x128@2x.png`; `branding.salesforce/icon.png`
- **Bug + root cause:** Two separate issues combined to produce the square icon: (1) `branding.salesforce/icon.png` (and the default icon PNGs/ICO) were RGB with no alpha channel — the blue background extended to sharp square corners with no transparency. (2) `build.rs` only declared `cargo:rerun-if-changed` for `tauri.conf.json` and `tauri.windows.conf.json`, not for the `.ico` files. Cargo therefore reused the stale cached `resource.lib` (with the old embedded icon) even after the icon on disk was updated — the new `.ico` was never compiled into the binary until `tauri.conf.json` was separately touched.
- **Fix:** Applied a 17% rounded-rectangle alpha mask to `branding.salesforce/icon.png`, converting it from RGB to RGBA with transparent corners. Regenerated all `src-tauri/icons` PNGs and `icon.ico` from the same fixed source. Added `cargo:rerun-if-changed=icons/icon.ico` and `cargo:rerun-if-changed=icons-brand/icon.ico` in `build.rs` so future icon regeneration automatically triggers a Rust recompile and re-embed.
- **Web-app applicability:** **No** — the web app has no `.ico` or Tauri resource embedding; this is desktop-only.

## CF-040 — Overlay header title crammed against, and floating above, the macOS traffic lights (pragna2-tracker #199)

- **Date:** 2026-06-22
- **Area / file:** `src/constants/windowChrome.ts` (`TRAFFIC_LIGHT_CLEARANCE_PX`, new `OVERLAY_TITLEBAR_MIN_HEIGHT_PX`), `src/presentation/hooks/useOverlayTitleBarInset.ts` (+ its test).
- **Found by:** Manual use — in the PDF viewer (`AttachmentViewer`) the filename "Document.pdf" sat tight against the macOS traffic lights and read as vertically off (floating above the lights), looking non-native.
- **Bug + root cause:** The shared overlay-header inset (`useOverlayTitleBarInset`) only set `paddingLeft` = `TRAFFIC_LIGHT_SAFE_INSET_PX`. Two shortfalls: (1) horizontal — `TRAFFIC_LIGHT_CLEARANCE_PX` was only 10px, so after the ~74px-wide light group the title started at ~84px with barely any breathing room. (2) vertical — the native lights are centered on `TRAFFIC_LIGHT_Y` (28px from the window top), but the header was ~40px tall with `items-center`, so its content centered at ~20px — ~8px **above** the lights' center. The title therefore floated above the lights instead of sitting on their line.
- **Fix:** (1) Bump `TRAFFIC_LIGHT_CLEARANCE_PX` 10 → 16 for a native-feeling gap (flows through the derived `TRAFFIC_LIGHT_SAFE_INSET_PX`). (2) Add derived `OVERLAY_TITLEBAR_MIN_HEIGHT_PX = 2 × TRAFFIC_LIGHT_Y` and return it as `minHeight` from `useOverlayTitleBarInset`, so the header's vertical center coincides with the lights' center and the title/lights/header actions share one line. Both applied **only** on macOS-overlay chrome (`usesMacOverlayChrome`) — browser-fallback/e2e/Windows get `undefined`, unchanged. Fix lands in the shared hook, so it also corrects the same latent misalignment in the other overlay headers (`AgentFormModal`, `FlowDetailView`). Hook test asserts both `paddingLeft` + `minHeight`.
- **Note:** In the same branch the PDF/attachment viewer was reworked from a full-screen overlay into a right-anchored **Sheet** (matching the flow YAML editor — see the `pdf-view-download-surface` specs), so the viewer no longer consumes `useOverlayTitleBarInset`. This alignment fix now serves the remaining overlay-header surfaces (`AgentFormModal`, `FlowDetailView`); the Sheet's own header sits clear of the traffic lights.
- **Web-app applicability:** **No.** This is desktop-only chrome — the web app has no overlay title bar / native traffic lights, and the hook already returns `undefined` off macOS-overlay chrome. No web-fe change.

## CF-036 — Generated PDF opens to a BLANK viewer window (macOS WKWebView) (pragna2-tracker #195)

- **Date:** 2026-06-22
- **Area / file:** `src/presentation/views/chat/components/AttachmentViewer.tsx`; new `src/presentation/views/chat/components/PdfCanvasViewer.tsx`, `src/infrastructure/pdf/pdfjs.ts`; `src/presentation/views/chat/hooks/useAttachmentBlob.ts` (now also returns the raw `Blob`).
- **Found by:** Manual use — a `create_pdf_long` Salesforce report generated fine on the backend (verified: a valid 41-page PDF, 105,941 bytes, served `/attachments/{id}/content` → 200 OK repeatedly), but opening the card showed a **blank** full-window viewer.
- **Bug + root cause:** The viewer rendered the PDF as `<iframe src="blob:…#toolbar=0">`. **macOS WKWebView (Tauri's webview) does not render a PDF from a `blob:` URL inside an iframe** — it paints a blank frame. The bytes were correct; the webview simply won't display them this way. (Chromium-based WebView2 on Windows *would* render it, so this is a macOS-specific failure.)
- **Fix:** Render the PDF to a `<canvas>` with pdf.js (`pdfjs-dist`), which works in every webview. `PdfCanvasViewer` loads the document from the fetched bytes (`getDocument({data})`), renders pages fit-to-width and lazily (IntersectionObserver) so long reports stay light, and is `React.lazy`-loaded so the heavy pdf.js bundle is code-split out of the main chunk and the synchronous module graph. `useAttachmentBlob` now also exposes the raw `Blob` for the renderer. Component test updated to assert the canvas path (no iframe).
- **Web-app applicability:** **Likely (different webview, same anti-pattern).** The web app runs in a real browser where blob-iframe PDFs *do* render, so it may not show blank — but it shares the `AttachmentViewer`/blob-iframe approach and would benefit from the same robust canvas viewer (and is exposed if ever wrapped in a WKWebView). Track under web-fe.

## CF-037 — PDF/attachment Download button does nothing (silent no-op in WKWebView) (pragna2-tracker #196)

- **Date:** 2026-06-22
- **Area / file:** `src/presentation/views/chat/components/DocumentCard.tsx`, `src/presentation/views/chat/components/AttachmentViewer.tsx`; new `src/infrastructure/platform/saveFile.ts` (+ `index.ts` re-export); `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`, `src-tauri/capabilities/default.json`.
- **Found by:** Manual use — clicking **Download** on a generated PDF did nothing (no file, no error).
- **Bug + root cause:** Both download paths used a synthetic `<a download>` click on an object URL (`downloadBlob`, and the viewer's `<a href={blobUrl} download>`). **WKWebView ignores the HTML5 `download` attribute on blob anchors**, so the click is a silent no-op. The catch block only logged — no user-facing feedback — so a failure was invisible.
- **Fix:** New platform-layer `saveBytes(blob, filename)` (the only place allowed to call OS save APIs): in the Tauri runtime it shows a native "Save As" dialog (`@tauri-apps/plugin-dialog` `save()` — which auto-scopes the chosen path) and writes it (`@tauri-apps/plugin-fs` `writeFile`); in a plain browser it falls back to the blob-anchor `downloadBlob`. Gated on `isTauriRuntime()` (not OS) per the Platform Abstraction rule, so the e2e/browser fallback keeps working. `DocumentCard` + `AttachmentViewer` now route downloads through it with success/error **toasts** (cancel is silent). Rust registers the two plugins; capabilities grant `dialog:allow-save` + `fs:allow-write-file`. 5 unit tests in `saveFile.test.ts`.
- **Web-app applicability:** **Likely partial.** The web app's blob-anchor download works in a real browser, so the *symptom* may be absent there — but the silent-failure (log-only, no toast) error handling is shared and should get user-facing feedback. The native-dialog path is desktop-only. Track under web-fe.

## CF-038 — A finished background (create_pdf_long) document card only appears after switching chats (pragna2-tracker #197)

- **Date:** 2026-06-22
- **Area / file:** `src/presentation/hooks/episodes/useEpisodes.ts` (`useOpenEpisode`), new `src/presentation/views/chat/hooks/useSurfaceFinishedEpisode.ts`, `src/presentation/views/chat/ChatSessionView.tsx`, new `src/constants/episodes.ts`.
- **Found by:** Manual use — after a long PDF generated (~6 min in a background episode), the DocumentCard did **not** appear; it showed up only after switching to another chat and back.
- **Bug + root cause:** `useOpenEpisode` had `staleTime: 30_000` and **no `refetchInterval`** — it was invalidated exactly once (on the chat run's `running→settled` edge, via `useRefetchOpenEpisodeOnSettle`), fetched the now-`active` doc episode, and then **never re-checked while the user stayed on the page**. The only other refresh was `onRunFinalized` from the attached SSE stream, but a multi-minute stream is fragile (can drop before `RUN_FINISHED`). So the `active → completed` transition (and the posted-back PDF message) went unobserved until a chat switch remounted and re-polled.
- **Fix:** (1) `useOpenEpisode` now polls (`refetchInterval`) on `OPEN_EPISODE_ACTIVE_POLL_MS` **only while** the episode is `active`. (2) New stream-independent `useSurfaceFinishedEpisode` watches the open-episode query and, on the `active → not-active` transition (the query returns `null` once terminal), invalidates the messages + conversation-list queries so the card surfaces on its own. Wired into `ChatSessionView` alongside the existing settle/auto-attach hooks (the auto-attach dedups by episode id, so polling causes no double-stream). 4 unit tests in `useSurfaceFinishedEpisode.test.tsx`.
- **Web-app applicability:** **Likely affected** — the web app shares `useOpenEpisode` (ported from it) + the `create_pdf_long` background-episode + attach pattern, with the same no-poll behaviour. Apply the same polling + surface-on-close safety net (track under web-fe).

## CF-035 — A FAILED run showed the benign "no reply" notice instead of reading as an error (pragna2-tracker #191)

- **Date:** 2026-06-22
- **Area / file:** `src/presentation/views/chat/components/AssistantTurn.tsx`, `src/presentation/views/chat/ChatSessionView.tsx`.
- **Bug + root cause:** When an assistant/flow run **failed** (e.g. a flow episode aborting on the LangGraph step limit → HTTP 500), `useChatSession` correctly set `status: 'error'` + an `error` message and the global error banner rendered — but `AssistantTurn` had no access to that state, so its completed-turn fallback still rendered `NO_REPLY_NOTICE` ("The assistant returned no reply…"). That conflated a **failed run** with a benign **empty reply** (the #155/#156 case), so the user read "no reply" and assumed the model declined, when the run had actually crashed.
- **Fix:** Thread a `runFailed` flag into `AssistantTurn` — `status === 'error'` scoped to the **last** turn (the error belongs to the latest run; older empty turns keep their legitimate notice). `showNoReplyNotice` now also requires `!runFailed`, so a failed turn shows its activity umbrella but not the misleading notice; the existing global error banner remains the failure signal (no duplicate messaging). Regression test added (same tools-only-empty shape with `runFailed` → notice suppressed).
- **Web-app applicability:** **Likely** — the web app shares `AssistantTurn` + the `NO_REPLY_NOTICE` pattern and the `status: 'error'` session model; apply the same `runFailed` suppression there (track under web-fe). A richer per-turn error message (vs. relying on the banner) is deferred to BE #190 surfacing a clean failure reason.

## CF-034 — Importing malformed YAML silently wipes the flow canvas instead of erroring (pragna2-tracker #187)

- **Date:** 2026-06-22
- **Area / file:** `src/presentation/views/settings/FlowDetailView/FlowYamlActions.tsx` (`confirmImport`); root in `buildEditorGraph.ts`.
- **Bug + root cause:** `buildEditorGraph(yamlText)` wraps its `yaml.load` in `try { … } catch { /* keep doc = {} */ }` (`buildEditorGraph.ts` ~L135–142), so malformed YAML never throws — it returns an empty graph. `confirmImport` relied on `buildEditorGraph` throwing to show the `FLW_010` "couldn't read that YAML" alert; because it swallows, pasting/dropping a syntactically broken document **silently replaced the canvas with an empty graph** (data loss) instead of erroring.
- **Fix:** Parse-guard `confirmImport` with `js-yaml`'s `load` BEFORE calling `buildEditorGraph` — on a thrown `YAMLException` or a non-mapping result, show `FLW_010` and return without hydrating, leaving the canvas untouched. Mirrors the guard already in `FlowYamlEditorSheet`'s Apply-to-Canvas (CF-033 batch). Regression test added (a YAML syntax error short-circuits before `buildEditorGraph` and leaves the canvas untouched).
- **Web-app applicability:** **Likely** — the web app shares `buildEditorGraph` (same swallow) and a YAML import path; a malformed import there silently wipes the canvas too. Add the same parse-guard (track under web-fe). A deeper fix would be to stop swallowing in `buildEditorGraph` itself, but that changes its contract for the other callers (e.g. `FlowEditor` hydration), so the call-site guard is the targeted fix.

## CF-033 — Dialogs opened inside the flow editor are invisible/unclickable ("dead" MCP & Knowledge panel buttons) (pragna2-tracker #189; blocks #41)

- **Date:** 2026-06-22
- **Area / file:** `src/components/ui/dialog.tsx` (`DialogOverlay`, `DialogContent`).
- **Bug + root cause:** The shared Radix `Dialog` rendered its overlay and content at **`z-50`**. The full-page flow editor (`FlowDetailView`) is a `fixed inset-0 z-[300]` surface. Radix portals the dialog to `document.body`, so a dialog opened from inside the editor (e.g. the MCP **ConnectorPanel** "Add a connector", the **KnowledgePanel** library picker, **DecisionPanel**, the **NodePanel** delete-confirm) rendered at `z-50` — **behind** the `z-[300]` editor — so it was invisible and its buttons did nothing ("dead"). The Sheets in the same editor avoided this by using `z-[400]`/`z-[399]`; the dialogs never got the same treatment. This blocked testing tracker #41 (MCP node config).
- **Fix:** Raised the shared dialog to the top-modal layer — `DialogOverlay` → `z-[399]`, `DialogContent` → `z-[400]` — matching the Sheet layering, so dialogs render above the editor (and other chrome ≤ z-300). Components with their own higher z (e.g. `AddConnectorWizard` at `z-[700]`) are unaffected. Regression test (`dialog.test.tsx`) asserts the z-index classes (jsdom has no real stacking).
- **Web-app applicability:** **Likely** — `pragna2_sgummalla_works` shares the same `ui/dialog.tsx` (z-50) and a full-page flow editor; any dialog opened from inside that editor has the identical hidden-behind-the-editor defect. Apply the same z bump (track under web-fe).

## CF-032 — Agent Flow → Import YAML: pasting a large YAML overflows the sheet, no scrollbar, cannot import

- **Date:** 2026-06-22
- **Area / file:** `src/presentation/views/settings/FlowDetailView/FlowYamlActions.tsx` (Import sheet paste area, ~`:200`–`:214`).
- **Bug + root cause:** The shared `Textarea` base class is `field-sizing-content` (`src/components/ui/textarea.tsx`), so the control auto-grows to fit its content with **no max height**. The Import sheet wrapped it in a plain `flex flex-col` region with no bounded/scrollable container (unlike the sibling **YAML view sheet** in the same file, which correctly uses `min-h-0 flex-1 overflow-y-auto`). Pasting a large YAML grew the textarea taller than the `SheetContent` (which is `fixed top/bottom`, i.e. viewport-bounded, with no overflow handling), pushing the footer's **Replace canvas** button off-screen. Nothing had `overflow`, so no scrollbar appeared and the import could not be completed; the per-keystroke content re-measure on a huge value also made the sheet feel frozen.
- **Fix:** Made the paste area mirror the proven YAML-view-sheet pattern, scoped to this component (no change to the shared `sheet.tsx`/`textarea.tsx`): wrapper → `flex min-h-0 flex-1 flex-col gap-1.5`; textarea → `field-sizing-fixed min-h-0 flex-1 resize-none overflow-auto …`. `field-sizing-fixed` overrides the base `field-sizing-content` (verified `twMerge` keeps `field-sizing-fixed`), so the textarea fills the available height and scrolls internally instead of growing unbounded; the footer stays on-screen at any paste size. Regression test added asserting the textarea carries `field-sizing-fixed`/`overflow-auto`/`flex-1`/`min-h-0` and not `field-sizing-content`.
- **Web-app applicability:** **Likely** — if `pragna2_sgummalla_works` has the same Flow editor Import-YAML sheet built on a `field-sizing-content` textarea without a bounded scroll region, it has the identical overflow/cannot-import defect. Apply the same bounded `flex-1 min-h-0` wrapper + `field-sizing-fixed` textarea there (track under web-fe).

## CF-031 — `tsc -b` build fails on `Releases/V1` — stale `@ts-expect-error` directives in `vite.config.ts` (pragna2-tracker #177)

- **Date:** 2026-06-21
- **Area / file:** `vite.config.ts:70`, `:72`.
- **Bug + root cause:** Two `// @ts-expect-error process is a nodejs global` directives guarded the `process.env.TAURI_DEV_HOST` / `process.env.VITE_API_PROXY_TARGET` accesses. The underlying type issue they suppressed no longer occurs (`process` is now resolved via the available Node types in the config's type context), so each directive suppresses nothing and TypeScript raises `TS2578: Unused '@ts-expect-error' directive`. Because `tsc -b` (the real build/typecheck) treats that as an error, the build exits non-zero on a clean `origin/Releases/V1` tree — pre-existing, not introduced by recent work.
- **Fix:** Removed both stale `@ts-expect-error` directives. TS2578 only fires when there is no underlying error to suppress, so removal is safe — confirmed `npx tsc -b` exits 0 afterward.
- **Web-app applicability:** **Check** — `pragna2_sgummalla_works` has its own `vite.config.ts`. If it carries the same `@ts-expect-error process …` directives over `process.env` access, it likely has the identical stale-directive build failure; remove them there too (track under web-fe).

## CF-030 — tool-only turn renders a blank body when the final assistant message is empty (pragna2-tracker #156)

- **Date:** 2026-06-19
- **Area / file:** `src/presentation/views/chat/components/AssistantTurn.tsx`, `src/constants/chat.ts` (`NO_REPLY_NOTICE`).
- **Bug + root cause:** When the backend completes a tool call but the final assistant message has `content: ""` (the BE root cause is #155 — the LLM emits no text after the tool result), `answerMessageId()` returns `null` (no text + no tool-calls qualifies as an answer). `AssistantTurn` then puts nothing in `outside` and renders only the activity umbrella — the body below is blank, so the user has no signal the tool ran and returned. Correct for a *streaming* in-progress turn (the answer may still arrive); wrong for a *completed* turn that genuinely produced no reply.
- **Fix:** When the turn is NOT streaming, has activity steps (umbrella shown), and nothing rendered in the transcript (`outside.length === 0` — no answer id, no output card), render a subtle muted fallback notice (`NO_REPLY_NOTICE`, externalised in `constants/chat.ts` per the no-hardcoding rule) instead of a blank. The streaming guard prevents the notice flashing mid-turn. Pinned with an `answerMessageId` unit test (empty final after tool → null) + four `AssistantTurn` render tests (notice shows on completed tool-only/empty-final turns; suppressed while streaming and for normal answered turns).
- **Web-app applicability:** **Likely** — the web app shares `AssistantTurn`/`answerMessageId`/the activity-umbrella architecture. Apply the same non-streaming `outside`-empty fallback + shared `NO_REPLY_NOTICE` copy there (track under web-fe). The BE empty-reply root cause is #155.

## CF-029 — duplicate assistant reply after a tool/delegation resume (pragna2-tracker #158)

- **Date:** 2026-06-19
- **Area / file:** `src/presentation/views/chat/hooks/useReconcileMessages.ts`, `src/presentation/views/chat/hooks/useChatSession.ts`, `src/presentation/views/chat/ChatSessionView.tsx`.
- **Bug + root cause:** A raw episode/delegation resume (`runEpisodeStream` — the Phase F client-delegation path that bypasses `onRunInitialized`/`onRunFinalized`) flips `status` to `'idle'` in its `finally` **before** the `/messages` refetch (`qc.invalidateQueries`) resolves. In that window `useReconcileMessages` fires against a **stale** persisted snapshot from a prior turn. When that stale snapshot happens to have the **same count** as in-memory but a different last id (stream id vs BE UUID), the `messages.length > persisted.length` count guard (CF-013/CF-013b) passes and only the id-mismatch branch runs — wiping the just-completed delegation turn with an old seed. The BE then re-processes the same user message → a duplicate assistant reply.
- **Fix:** Option A — a `reconcileBlocked` gate. `useChatSession` exposes a `reconcileBlocked` boolean (backed by a depth **counter** so overlapping/nested resumes stay balanced); `runEpisodeStream` calls `blockReconcile()` before going idle and `unblockReconcile()` only **after `await`-ing** the `/messages` invalidate in `finally`. `useReconcileMessages` early-returns while blocked. So the reconciler only ever runs once the fresh persisted snapshot has landed — never against the stale one. Two regression tests added (no replace while blocked even on same-count/id-mismatch; replaces once unblocked).
- **Web-app applicability:** **Check / likely N/A for now** — `runEpisodeStream` is the desktop-only Phase F client-delegated (stdio) resume path; the web app omits the delegation capability header. But the web app shares `useReconcileMessages`/`useChatSession`, so if it ever gains a raw-episode resume that settles status before its refetch, the same gate is needed. Track under web-fe; apply the `reconcileBlocked` guard if/when that path exists.

## CF-028 — branded macOS app icon is a square tile, not a native rounded squircle (pragna2-tracker #151)

- **Date:** 2026-06-18
- **Area / file:** `scripts/make-mac-icon.mjs` (new), `scripts/apply-branding.mjs`, `scripts/tauri-with-brand.mjs`, `package.json` (+`sharp` devDep).
- **Bug + root cause:** `tauri icon <source>` generates every platform's icons from one full-bleed SQUARE source. macOS does not auto-round app icons — they ship pre-shaped as a rounded rect with ~10% padding — so a brand whose icon is a full-bleed COLOURED tile (e.g. Salesforce: white cloud on a `#00A1E0` blue tile) rendered as a hard square tile in the Dock/Finder, not the native squircle.
- **Fix:** `make-mac-icon.mjs` (sharp) reshapes ONLY the macOS `icon.icns` into a squircle (Apple grid: 824/1024 body, ~22.37% corner radius, transparent padding) from the square brand source, then runs `tauri icon` on the squircle and copies just `icon.icns`. Wired into `apply-branding.mjs` (the brand-overlay path). **Windows is untouched by design:** macOS reads `icon.icns`; Windows reads `icon.ico` + `Square*Logo.png`, which keep the full-bleed square `tauri icon` produced — verified no `.ico`/`Square*` files change.
- **SCOPE NOTE (review catch):** an earlier draft also squircled the DEFAULT Pragna `src-tauri/icons/icon.icns`, sourcing it from `ios/AppIcon-512@2x.png`. That iOS variant is forced **opaque white-background**, so it produced a thick **white tile** around the (otherwise transparent) Pragna logo. The default Pragna macOS icon is a **transparent-background logo** (no tile) and must stay that way — the squircle/tile treatment only applies to brands that ship a filled colour tile. Reverted the default icns; removed the default `icons:mac` script.
- **Web-app applicability:** **N/A** — desktop-only Tauri OS packaging; the web app has no OS app icon.

## CF-026 — reasoning timeline folds a PRIOR completed turn into the live activity umbrella on return-to-streaming (pragna2-tracker #148)

- **Date:** 2026-06-18
- **Area / file:** `src/presentation/views/chat/utils/assistantTurns.ts` (`groupChatMessages`), `src/presentation/views/chat/ChatSessionView.tsx`.
- **Bug + root cause:** **Product bug (not a test fix).** When a chat is mid-stream and the user switches away and back, the session remounts (keyed by conversationId) and re-attaches to the live episode. The re-seeded message list lacks the in-flight USER turn (not yet persisted / not replayed by the episode stream), so the previously-completed assistant turn ends up ADJACENT to the resuming assistant run. `groupChatMessages` merges consecutive assistant messages into one turn, so the prior turn's answer + reasoning were folded into the live "Drafting…" activity umbrella.
- **Fix:** `groupChatMessages` gains an optional `endsTurn(message)` predicate that closes a turn after an assistant message even with no following user/system message. `ChatSessionView` passes `endsTurn = (m) => finishReason is a terminal stop ('stop'|'length'|'other')` — a persisted, completed turn — so a completed turn is never merged with a later adjacent one. `'tool_calls'` (mid-turn) and `null`/legacy are NOT terminal, so genuine multi-message turns aren't split. No-op for normal transcripts (a user message already separates turns). Unit tests added for the boundary; verified live by e2e `scenario-31`.
- **Web-app applicability:** **Likely** — the web app shares the same `groupChatMessages`/`AssistantTurn`/remount-and-re-attach architecture. Apply the same `endsTurn` boundary there (track under web-fe).

## CF-027 — e2e test-correctness fixes (NOT product masking): flow-space drag assert, model-agnostic revise-loop count, post-reload multi-tab check (pragna2-tracker #139 / #140 / #141)

- **Date:** 2026-06-18
- **Area / file:** `e2e/helpers/canvas.ts`, `e2e/tests/flow-design-drag-start.spec.ts` (#139); `e2e/tests/scenario-06-revise-loop.spec.ts` (#140); `e2e/tests/scenario-13-multi-tab.spec.ts` (#141); `e2e/tests/scenario-31-agent-switch.spec.ts` (deterministic prompts).
- **Bug + root cause:** These were **test defects, not product defects** — each spec asserted the wrong thing; the product behaviour is correct (verified):
  - **#139** asserted the End node "stays put" in SCREEN pixels (`boundingBox`). React Flow auto-pans the viewport during a node drag, shifting every node's screen pixels — End's GRAPH position is unchanged. Fix: assert End's flow-space position (`nodeFlowPosition`, parses the node's `transform`). This is a STRICTER check (Δ<1px in graph space) — it would still catch a real "End moved" regression; it just no longer false-fails on a viewport pan.
  - **#140** asserted `>= 2` assistant bubbles for the revise-loop. BE logs confirm BOTH flow nodes ran (`haiku-drafter` AND `haiku-reviewer`) — the loop is functional; gpt-4o simply surfaced 1 visible bubble (drafted an acceptable haiku, routed to "pass"). Relaxed to `>= 1` (still asserts the flow dispatched + produced a substantive haiku-like reply). NOT masking a broken loop — node execution verified in the BE logs.
  - **#141** asserted Tab B sees the in-flight user message ~mid-stream, within 10s of opening. The FE has no live cross-tab push — a second tab reflects PERSISTED state at its own fetch/reload time. Moved the assertion to AFTER Tab B's reload (the spec's stated contract: "a second tab refreshing sees the same conversation"). The post-reload consistency (reply body + title) is unchanged.
  - **scenario-31** prompts were research-shaped ("capital of France"), which made the model emit a `propose_flow_*` tool call → on OpenAI the NEXT turn 400s on the dangling tool_call (a real **BE** bug, filed as pragna2-tracker #150) → empty replies. Switched to format-only prompts ("reply with X") so the agent answers directly; the agent-switch + attribution is exercised regardless of seeded flows.
- **Web-app applicability:** the web app's parallel specs likely share #139/#141's measurement assumptions; apply the same corrections if its suite has them. #150 is the backend's to fix.

## CF-025 — e2e flow-editor model picker hardcoded to `/Claude Sonnet 4.6/` → flow-authoring specs fail for any other seeded provider (pragna2-tracker #149)

- **Date:** 2026-06-18
- **Area / file:** `e2e/helpers/env.ts`, `e2e/helpers/flow-author.ts`, `e2e/tests/flow-editor.spec.ts`, `e2e/README.md`.
- **Bug + root cause:** The e2e model selection matched the flow-editor agent-node model option by a hardcoded display-name regex (`MODEL_PICKER_LABEL` defaulted to `/Claude Sonnet 4\.6/`), used by `configureChatAgent` and `flow-editor.spec.ts`. When the test user is seeded with any other provider/model (Gemini, OpenAI, …) the `getByRole('option', { name })` never matched → the 9 flow-authoring specs timed out at the model-selection step. A baked-in model name in test logic — the suite is run with a different provider each time, so this violated the No-Hardcoding rule (looked like a regression, was a hardcoding defect).
- **Fix:** `MODEL_PICKER_LABEL` is now `RegExp | null` (no hardcoded default; only set when `E2E_MODEL_LABEL` is provided). New shared helper `selectModelOption(page, label)` selects by name when a label is given, else the FIRST available option (whatever model is seeded) — both call sites use it. Also documented the `:8001` setup prerequisite (seed a model + default agent via `seed-model.sh` first — a fresh all-in-one container has none → empty dropdown) in `e2e/README.md`. Verified: 13/13 authoring specs pass with a Gemini seed; live chat specs pass with an OpenAI seed (provider-agnostic).
- **Web-app applicability:** **Likely** — the web FE (`pragna2_sgummalla_works`) has a parallel Playwright suite ported from/to this one. If its flow-editor model selection pins a model name the same way, apply the same `selectModelOption` + nullable-label fix there (track separately under the web-FE component).

## CF-024 — brand wrapper scripts use `execFileSync('pnpm', …)` → `pnpm tauri:brand dev|build` fails on Windows (pragna2-tracker #143)

- **Date:** 2026-06-18
- **Area / file:** `scripts/tauri-with-brand.mjs`, `scripts/apply-branding.mjs`, new `scripts/run-pnpm.mjs`.
- **Found by:** Reviewing the branding build commands for Windows.
- **Root cause:** Both scripts spawned the pnpm CLI with `execFileSync('pnpm', […])` (no shell). On Windows `pnpm` is `pnpm.cmd`, and `execFile(Sync)` cannot launch a `.cmd`/`.bat` without `shell: true` — Node blocks it since CVE-2024-27980 (and even pre-CVE it would `ENOENT` because execFile does not apply PATHEXT). So `pnpm tauri:brand dev` / `build` and the `tauri icon` generation inside `apply-branding.mjs` would fail on Windows. (Worked on macOS, where `pnpm` is a real executable on PATH.) The misleading "resolves the .bin/.cmd shim via pnpm" comment was wrong — execFile does no such resolution.
- **Fix:** Added `scripts/run-pnpm.mjs` exporting `runPnpm(args, cwd)` that calls `execFileSync('pnpm', args.map(quoteArg), { shell: true, stdio: 'inherit', cwd })` — `shell: true` runs through cmd.exe (Windows) / `/bin/sh` (macOS/Linux), which resolves the `.cmd` shim and PATH; whitespace-containing args are quoted so paths like `C:\Users\Jane Doe\…` survive. Both wrapper scripts now call `runPnpm`. Verified on macOS (`apply-branding.mjs` regenerates the brand icon set via the new runner) and node `--check` on all three scripts.
- **Web-app applicability:** **N/A** — these are desktop-only Tauri build scripts; the web app has no equivalent.

---

## CF-023 — `@brand/logo.svg?raw` import fails to resolve in the Vite dev server → dev crashes when the OAuth loopback modules load (pragna2-tracker #142)

- **Date:** 2026-06-18
- **Area / file:** `src/infrastructure/branding/brandAssets.ts`, `vite.config.ts`, `vitest.config.ts`, `src/vite-env.d.ts`.
- **Found by:** Running the branded app (`pnpm tauri:brand dev` / `pnpm dev`) and navigating far enough to load the OAuth loopback modules: `[plugin:vite:import-analysis] Failed to resolve import "@brand/logo.svg?raw" from "src/infrastructure/branding/brandAssets.ts"`.
- **Root cause:** The `@brand` overlay is a **regex** `resolve.alias` (`/^@brand\/logo\.svg/`). It resolves `@brand/logo.svg?react` (the svgr plugin handles that query) and resolves everything correctly in `vite build`, but the `?raw` query does **not** resolve through the regex alias in the Vite **dev server**. `brandAssets.ts` is only imported transitively by the loopback success pages, so earlier dev runs (login page only) never loaded it and the failure was latent.
- **Fix:** Removed the `@brand/logo.svg?raw` import. The brand logo markup is now injected as a build constant `__BRAND_LOGO_OVERLAY_SVG__` (read from `branding/logo.svg` in `vite.config.ts`, mirroring `__BRAND_NAME__` / the favicon data URI). `brandAssets.ts` uses `__BRAND_HAS_OVERLAY_LOGO__ ? __BRAND_LOGO_OVERLAY_SVG__ : DEFAULT_LOOPBACK_LOGO`. Declared in `vite-env.d.ts`, defined empty in `vitest.config.ts`. Verified by transforming `brandAssets.ts` through a live dev server (no resolve error) and default + branded builds.
- **Web-app applicability:** **Likely N/A today** (the web app doesn't yet have this Tauri-loopback branding). If the build-time branding overlay is ported there, avoid `?raw` imports through a regex alias — inject raw asset content as a build constant instead.

---

## CF-022 — `service_from_error_text`: provider name always `null` for `--profile` connectors → `mcp-adaptor auth --provider <service>` could not be driven (pragna2-tracker #129)

- **Date:** 2026-06-17
- **Area / file:** `src-tauri/src/domain/mcp.rs` (new `service_from_error_text()`), `src-tauri/src/platform/mcp_registry.rs` (call classification), `src-tauri/src/application/mcp_host.rs` (enrichment fallback).
- **Found by:** Analysis of `claude-web-app` mcp-adaptor pattern — connectors launched as `mcp-adaptor serve --profile sumangummalla` bundle multiple servers (`gus`, `codesearch`, `google_workspace`, etc.) in one process. The launch args carry no `--server`/`--provider` flag, so `service_from_args()` always returned `None`, `DelegatedCallOutcome::AuthRequired { service: None }` was the only possible outcome, and `mcp-adaptor auth --provider <service>` could never be invoked from the Re-authenticate card.
- **Root cause:** `service_from_args` was the only derivation path. It works for single-server connectors (`mcp-adaptor serve --server gus`) but not for profile-based ones. For profile connectors the provider name is embedded verbatim in the mcp-adaptor error text: `"failed to fetch required token for provider 'gus'"` — it was never extracted.
- **Fix:** Added `service_from_error_text(text)` to `domain/mcp.rs` — matches the `"for provider '<name>'"` pattern (case-insensitive) in the error string and returns the provider name. Updated `mcp_registry::call()` to call this at the point of auth-classification (where the error text is available). `mcp_host::call()` retains `service_from_args` as a fallback for when the pattern is absent (non-adaptor or single-server connectors). 4 new tests in `domain::mcp::tests`. 16/16 Rust tests pass.
- **Web-app applicability:** **N/A** — stdio delegation is desktop-only.

---

## CF-021 — `AUTH_ERROR_RESULT_SIGNALS` missing `invalid_grant` / `token refresh failed` → mcp-adaptor 400 refresh failure classified as `auth_signal=false`, Re-authenticate card never shown (pragna2-tracker #128)

- **Date:** 2026-06-17
- **Area / file:** `src-tauri/src/domain/mcp.rs` (`AUTH_ERROR_RESULT_SIGNALS` constant, lines 63–84).
- **Found by:** Console log during live GUS MCP tool call: `[mcp_stdio_call] isError result (auth_signal=false): [{"type":"text","text":"failed to get MCP client: ... token refresh failed with status 400: {\"error\":\"invalid_grant\"..."}]`. The Re-authenticate card never appeared; the LLM narrated the error in prose.
- **Bug:** When a GUS session token expires, the `mcp-adaptor` attempts a silent token refresh. If the refresh token is also expired/revoked, the adaptor returns an `isError=true` MCP result whose text contains `"invalid_grant"` (OAuth RFC 6749 §5.2 error code), `"token refresh failed"`, and `"failed to fetch required token"`. `is_auth_error_signal()` in `mcp.rs` returned `false` for all of these because none appeared in `AUTH_ERROR_RESULT_SIGNALS`. As a result, `mcp_registry::call` returned `DelegatedCallOutcome::Success` (not `AuthRequired`), the desktop sent a plain `tool_result` to `/resume-tool` instead of the structured `{"auth_required": ...}` signal, the BE's text-signal fallback also missed (same gap — tracked as pragna2-tracker #127 for the API team), and no `connector_reauth` interrupt was raised. The #122/#124 re-auth pause flow was fully bypassed.
- **Root cause:** The signal list was authored to cover OIDC/session patterns but missed the OAuth token-refresh failure code `invalid_grant` and the mcp-adaptor-specific wrapper messages. The failure arrives as a **400** on the refresh endpoint (not a 401 on the API call), so the existing `"401"` signal never matched.
- **Fix:** Added `"invalid_grant"` to `AUTH_ERROR_RESULT_SIGNALS` in `src-tauri/src/domain/mcp.rs`. Keyed on the standard OAuth RFC 6749 §5.2 error code embedded in the mcp-adaptor error JSON body — NOT on vendor-specific prose (`"token refresh failed"`, `"failed to fetch required token"`), which the API team deliberately excluded (nexus-kit-api #127 adds only `"invalid_grant"` for the same reason: too broad). The full mcp-adaptor error string matches via the embedded `"invalid_grant"` code. Test updated to assert the full error matches AND that bare vendor prose without the standard code does NOT match. 16/16 Rust tests pass.
- **Web-app applicability:** **N/A** — `AUTH_ERROR_RESULT_SIGNALS` and the stdio delegation path are desktop-only (Rust / Tauri). BE companion fix: nexus-kit-api #127 (merged, v1.0.13).

---

## CF-020 — Delegated stdio `call` discarded `result.isError` → aggregator auth errors narrated by the LLM, never paused

- **Date:** 2026-06-17
- **Tracker:** pragna2-tracker #124 (`type:feature`, `target:desktop-fe`) — the per-service
  re-auth feature; this is its bug-fix portion. BE counterpart #123; root cause #122.
- **Area / files:** `src-tauri/src/platform/mcp_registry.rs` (`McpRegistry::call`),
  `src-tauri/src/domain/mcp.rs` (`DelegatedCallOutcome`, `AUTH_ERROR_RESULT_SIGNALS`,
  `is_auth_error_signal`, `service_from_args`), `src-tauri/src/application/mcp_host.rs`
  (`call` enriches `service`), `src-tauri/src/adapters/mcp_commands.rs` (`mcp_stdio_call`
  returns the tagged outcome); FE `src/presentation/views/chat/hooks/useChatSession.ts`
  (`runDelegation`).
- **Bug + root cause:** the client-delegated stdio tool path flattened the tool result with
  `flatten_result(&result)` and **discarded `result.isError`**. So when an aggregator's
  **downstream-service** token expired (e.g. GUS returns an `isError` body containing
  `INVALID_SESSION_ID`/`401`), the desktop relayed it to the backend as a normal
  `tool_result`; the agent then **narrated the auth error in prose** instead of the run
  pausing for re-authentication — the exact #122 symptom, on the desktop side of the
  delegated path. (This mirrors the backend's `_flatten_result_content` discarding `isError`,
  the #122 root cause fixed in nexus-kit-api #123.)
- **The fix:** `call` now **classifies** the outcome — an `isError` body (or a raised call
  error) whose text matches the conservative `AUTH_ERROR_RESULT_SIGNALS` list (mirrored from
  the BE) yields `DelegatedCallOutcome::AuthRequired { service, reason }`, with `service`
  derived from the connector's stored `--server`/`--provider` launch arg. `runDelegation`
  relays that as the structured `{ auth_required: { service, reason, authorization_url } }`
  result on `/resume-tool`, so the backend pauses with a per-service `connector_reauth`
  card. Non-auth `isError` bodies and normal results are unchanged (still relayed as
  `tool_result`). A `[mcp_stdio_call]` diagnostic logs the raw classified outcome so a real
  expired-token run confirms which channel carries the signal (see tech spec §10 / M10).
- **Web-app applicability:** **N/A for `pragna2_sgummalla_works`** — the client-delegated
  stdio host is a **desktop-only** capability (`mcpStdio` throws `NotInTauriError` in a
  browser; the web FE never runs a local MCP server), so this exact Rust path does not exist
  there. The analogous *backend* defect was already fixed in nexus-kit-api #123. No web-FE
  action required.

---

## FEAT-003 — Flow editor: description / YAML import-export / enable-disable + full-page

- **Date:** 2026-06-16
- **Tracker:** pragna2-tracker #121 (`type:feature`, `target:desktop-fe`)
- **Area / files:** `src/presentation/views/settings/FlowDetailView/FlowMetaBar.tsx` (new),
  `FlowYamlActions.tsx` (new), `FlowEditor.tsx`, `FlowDetailView.tsx`; `constants/flows.ts` (new),
  `constants/errors.ts` (FLW_009/FLW_010); data layer `domain/types/flow.types.ts`
  (`UpdateFlowPayload`), `application/ports/IFlowRepository.ts`, `application/services/FlowService.ts`,
  `infrastructure/repositories/FlowRepository.ts` (`updateFlow` → `PATCH /flows/{id}`),
  `presentation/hooks/flows/useFlows.ts` (`useUpdateFlow`); `FlowsView/FlowCard.tsx` (use shared regex).
- **Why (the bug behind the feature):** Clicking **Expose** on a flow returned *"Cannot expose flow
  as /slash without description populated"* — and the desktop flow editor had **no way to set a
  description**, no YAML import/export, and no enable/disable. So a flow could never be exposed as a
  `/slash` command on desktop, which is also why the chat `/` popover was always empty (the popover
  code is correct — there was simply nothing exposed). The web app's `FlowEditorView` has all of
  these; the desktop editor had shipped deliberately reduced.
- **What shipped:**
  1. **Editor meta bar (`FlowMetaBar`)** — Description input (writes store `meta`, persisted on Save
     via the YAML round-trip), inline Expose-as-/slash + slash-name, and an immediate **enable/disable**
     toggle (`useUpdateFlow` → `PATCH /flows/{id}` with `enabled`). Inline hints: description-required
     before exposing, kebab-validation on the slash name.
  2. **YAML import/export (`FlowYamlActions`)** — import (paste/file → `buildEditorGraph` → replace
     canvas + mark dirty; malformed → inline error) and export (download `<api_name>.yaml`).
  3. **Full-page editor** — `FlowDetailView` is now a `fixed inset-0` surface covering the settings
     sidebar (matching the agent create/edit form), with its header cleared of the macOS traffic
     lights via `useOverlayTitleBarInset()` (CF-019).
- **Backend:** No change needed — `PATCH /api/flows/{id}` already accepts `display_name`/`description`/
  `enabled` (`UpdateFlowRequest`), and `validate-yaml` / `from-yaml` already enforce the
  description-before-slash rule.
- **Tests:** `FlowRepository.test.ts` (`updateFlow` body mapping, omitted fields not sent);
  `FlowMetaBar.test.tsx` (description→store, enabled toggle PATCH, expose-without-description hint,
  Save gating); `FlowYamlActions.test.tsx` (export filename + fallback, import replace+dirty,
  malformed→error). Full suite green; `tsc -b` + `lint:platform` pass.
- **Web-app applicability:** **NOT a port — the web app already has these** (`FlowEditorView` meta
  row + YAML import/export). This entry brings the **desktop** to parity. (The full-page-vs-sidebar
  treatment is a desktop UX choice; the web app's editor is its own route.)

---

## CF-001 — Radix Select dropdown renders behind modal overlays (unclickable)

- **Date:** 2026-06-10
- **Area / file:** `src/components/ui/select.tsx` (`SelectContent`)
- **Found by:** Tier-2 e2e specs `scenario-28-agent-connector-attach` /
  `scenario-30-agent-knowledge-attach` (Playwright). The attach `<Select>` option was found and
  "visible, enabled, stable" but the click was intercepted by the dialog overlay.
- **Bug:** Inside any modal that renders a full-screen dialog overlay at `z-[700]` (AgentFormModal,
  ProviderModal, EditConnectorModal, AddConnectorWizard — all use
  `Dialog.Overlay className="fixed inset-0 z-[700] …"`), opening a Radix `Select` showed its dropdown
  **behind** the overlay, so the options were not clickable by mouse. The agent editor's "Attach a
  connector…" / "Attach a library…" pickers were effectively unusable with a pointer.
- **Root cause:** `SelectContent` was `z-50`. Radix portals both the Select content and the dialog
  overlay to `<body>` (same stacking context), so the overlay's `z-[700]` painted above the dropdown's
  `z-50` regardless of DOM order. (Keyboard selection still worked, masking the defect in manual use.)
- **Fix:** Raise `SelectContent` to `z-[800]` (above the `z-[700]` modal-overlay tier) so Select
  dropdowns always float above any dialog overlay they're opened from. One-line change to the shared
  primitive; fixes every affected modal at once.
- **Web-app applicability:** **LIKELY AFFECTED — check.** If the web app's `select.tsx` (or shadcn
  Select) content z-index is below its dialog overlay z-index, the same modals (provider/connector/
  agent editors) have unclickable Select dropdowns. Verify the web app's Select content z-index vs its
  `Dialog.Overlay` z-index and raise the Select above it if so.

---

## CF-002 — "process is not defined" crashes the chat view (missing Vite `process.env` shim)

- **Date:** 2026-06-10
- **Area / file:** `vite.config.ts`
- **Found by:** Tier-2 e2e specs `scenario-20-create-pdf-render` / `sketchon-diagram-render` — the
  page threw `PAGEERROR: process is not defined`, no `/api` calls fired, and the chat view rendered
  an empty body (full crash). Surfaced via a diagnostic that logged `pageerror`.
- **Bug:** Opening any chat conversation that renders markdown/diagrams crashes with
  `ReferenceError: process is not defined`. `satori` (bundled by `@sgummalla-works/sketchon` for the
  browser diagram renderer) reads `process.env.SATORI_*` / `process.env.JEST_*` **unguarded**, and
  the webview/browser has no `process` global, so the bare access throws and unwinds the whole chat
  view. Affects browser-fallback mode AND the Tauri webview (neither has `process`).
- **Root cause:** `vite.config.ts` had no `define` shim for `process.env`, so those bare references
  survived into the browser bundle.
- **Fix:** Add `processEnvShim(mode)` to Vite `define` **and** `optimizeDeps.esbuildOptions.define`
  (satori is a pre-bundled dep, so the dep-optimizer needs the shim too):
  `{ 'process.env.NODE_ENV': JSON.stringify(mode), 'process.env': '{}' }`. NODE_ENV stays correct
  (React prod build depends on it); every other `process.env.X` resolves to a safe `undefined`, which
  is what satori's feature checks expect. App code uses `import.meta.env`, never `process.env`.
- **Web-app applicability:** **ALREADY FIXED THERE (reverse direction).** The web app's
  `vite.config.ts` already carries this exact `processEnvShim` (same comment) — the **desktop was
  missing the web app's fix**. No web-app action needed; this entry records that the desktop has now
  caught up. Keep the two shims in sync if satori's env usage changes.

---

## CF-003 — create_pdf_long crashes on large tables (BACKEND PDF renderer LayoutError) [FIXED — backend hotfix]

- **Date:** 2026-06-10 (found) · 2026-06-11 (fixed)
- **Area / file:** **`nexus-kit-api`** (backend) — `src/infrastructure/pdf/renderer.py`
  (`_code_panel` / `_callout` / `_quote`). NOT a desktop-app file.
- **Found by:** Tier-2 live-LLM e2e specs `scenario-21-create-pdf-long` (both the
  `architecture_guidance` and `technical_requirements` cases). The doc card never appears.
- **Bug:** `create_pdf_long` (the fan-out long-document path) raises
  `reportlab.platypus.doctemplate.LayoutError: Flowable <Table …> too large on page N` — once a panel
  grew taller than the page frame (680–1148pt in a ~650pt frame) the build aborted and no
  PDF/attachment was produced.
- **Root cause (backend):** `_code_panel`, `_callout`, and `_quote` each wrapped their content in a
  **single-row, single-cell `Table`** purely for the background/border styling. reportlab can only
  split a table **between rows**, so a single row taller than the page can't break and throws.
- **Fix:** **DONE in `nexus-kit-api`** — branch `hotfix/pdf-large-table-layout`, commit `e7c6f3b`. Made
  the three panels **multi-row** so they split across pages: `_code_panel` lays out one line per row
  (panel inset only on the first/last rows so lines stay continuous); `_callout`/`_quote` put one
  flowable/paragraph per row (left bar + tint span all rows, inset on first/last only). Regression
  tests added (`test_renderer.py`: ~150-line code block + long multi-paragraph callout/quote across
  the previously-failing templates). BE suites green: unit 1444, pdf 56, integration 62. **Validated
  live:** create_pdf_long now renders both 15+ page docs with **zero `LayoutError`**, stored + linked
  (confirmed in the e2e DB). The desktop `scenario-21` specs still don't pass, but for a SEPARATE,
  newly-found FE bug (CF-005), not this renderer crash — they remain `test.fixme` referencing CF-005.
  *Residual (documented): a single markdown paragraph taller than one page (no blank-line breaks)
  still can't split a row — pathological for LLM output; future fix is a custom splittable Flowable.*
  **The `nexus-kit-api` hotfix branch is pushed but NOT merged to `Releases/V1` — that's a PR/review step.**
- **Web-app applicability:** **AFFECTS BOTH APPS (shared backend) — now fixed for both** once the
  `nexus-kit-api` hotfix merges. The web app uses the same renderer, so this resolves its
  `create_pdf_long` too.

---

## CF-004 — first chat turn aborted by React StrictMode double-invoke (e2e accommodation)

- **Date:** 2026-06-10
- **Area / file:** `src/main.tsx` (+ `e2e/scripts/setup-stack.sh` sets the flag)
- **Found by:** Tier-2 live-LLM chat specs — the first streaming turn logged
  `Agent execution failed: AbortError: signal is aborted without reason` and never produced a reply
  in browser mode.
- **Bug (DEV/TEST-ONLY — not a production defect):** React `StrictMode` double-invokes effects in
  development (mount → cleanup → mount). The chat session hook's unmount cleanup calls
  `agent.abortRun()` (`useChatSession.ts`), so StrictMode's synthetic unmount aborts the first
  streaming turn before its POST fires; it is then re-dispatched on the second mount. This is purely a
  dev aid — **StrictMode is a no-op in production builds**, so the real Tauri app never hits it — but
  it makes live-chat e2e (run against `pnpm dev`) racy.
- **Fix:** Gate `StrictMode` off when `import.meta.env.VITE_E2E_NO_STRICT_MODE` is set; the e2e
  `setup-stack.sh` boots the FE with that flag. Normal `pnpm dev` / `tauri dev` keep StrictMode ON.
  Running e2e without StrictMode is *more* prod-faithful (prod has it off), so no coverage is lost.
- **Note:** This is **not** an app-logic fix and changes no production behaviour (the flag is unset in
  every real build) — recorded here only because it is an app-code change made in response to a test
  failure, per the "Document Every Bug Fix" rule.
- **Web-app applicability:** **CHECK.** If the web app runs live-chat e2e against its dev server and
  also wraps the app in `StrictMode`, it will hit the same first-turn abort race; the same env-gated
  StrictMode toggle (or removing the abort-on-unmount during the eager-create handoff) applies.

---

## CF-005 — async create_pdf_long document never auto-surfaces in the chat [FIXED — desktop FE]

- **Date:** 2026-06-11
- **Area / file:** desktop FE — `src/presentation/hooks/conversations/useConversationMessages.ts`
  (+ the chat session refetch wiring in `useChatSession.ts`).
- **Found by:** Tier-2 live-LLM e2e `scenario-21-create-pdf-long` — after the CF-003 backend fix the
  PDF renders + is stored/linked, but the document card never appears in the chat (timed out even at a
  540s wait, well past the ~6min generation).
- **Bug:** `create_pdf_long` is asynchronous — the chat turn instantly ACKs ("captured the request")
  and finalizes, then the document is built in the background and posted back as a SEPARATE assistant
  turn minutes later. The desktop FE never surfaces that posted-back turn live: `useConversationMessages`
  is `staleTime: Infinity` with no `refetchInterval`, and the only message refetch fires at the (early)
  ack-run finalize — before the document exists. So the card appears only after a manual reload /
  navigation. (Verified the PDF IS produced + linked in the DB, so it's purely a surfacing/refetch
  gap, not missing data — a fresh fetch renders it, as the seeded `scenario-20` proves.)
- **Root cause:** no mechanism to refetch `/messages` (or stream the posted-back turn) when a pending
  long-document background episode completes.
- **Status / fix:** **FIXED (desktop, 2026-06-11).** Ported the web app's event-driven
  background-episode attach (NOT polling): `useOpenEpisode` (open-episode lookup) +
  `useRefetchOpenEpisodeOnSettle` (refetch the open-episode query on the run→settle transition) +
  `attach()` in `useChatSession` (streams the background episode via a swapped-URL `runAgent` to
  `POST /api/conversations/{cid}/episodes/{eid}/stream`) + **`replaceMessages` reconciliation** (the
  real lynchpin — the attach streams the posted-back assistant message with a LangChain *stream* id,
  while the PDF attachment is keyed by the *persisted BE UUID*; swapping in-memory messages for the
  persisted list after the run settles makes the attachment → `DocumentCard` lookup resolve) +
  `ChatSessionView` auto-attach effect + a "Generating your document…" label + the `LONG_PDF_*`
  constants. Unit tests added (`useEpisodes`, `useRefetchOpenEpisodeOnSettle`). **Validated live:**
  `scenario-21` ×2 un-`fixme`'d and green — the document card now surfaces with no manual reload.
  Tracked as pragna2-tracker TD-030 (done).
- **Discovery note:** the desktop had **deferred** this whole subsystem with only a generic
  `useChatSession` comment ("episode attach … and attachments are deferred (see pragna2-tracker)") —
  **no stable TD-ID**, a gap vs the repo's TODO rule. The comment is now corrected.
- **Web-app applicability:** **NONE — desktop-only gap.** The web app already has this subsystem
  (its `scenario-21` passes); CF-005 is the **desktop catching up to the web app** (same direction as
  CF-002). No web-app change needed.

---

## CF-006 — Stop button / navigation abort logs a spurious CHT_004 error

- **Date:** 2026-06-12
- **Area / file:** `src/presentation/views/chat/hooks/useChatSession.ts`
- **Bug:** After clicking the Stop button (or navigating away mid-stream), the console showed
  `[ERROR] CHT_004:run_failed` and `CHT_004:run_rejected` even though the cancellation was
  intentional. The UI didn't break (status reset to idle correctly), but the noise made it
  hard to spot real errors.
- **Platform scope:** Windows-only. On macOS, Tauri's NSURLSession transport propagates a
  standard `AbortError` on cancellation, which the old `/aborted/i` guard already caught
  correctly. On Windows, the WinHTTP/reqwest layer throws `Error: "Request cancelled"` instead,
  so only Windows exhibited the spurious log.
- **Root cause:** The abort-guard checked only `e.name === 'AbortError'` and `/aborted/i` —
  neither matches "cancelled", so the Windows error fell through to the logging path. The same
  gap affected the `attach` catch and the raw episode `runEpisodeStream` guard.
- **Fix:** Widened all three abort guards to `/aborted|cancel/i` so "Request cancelled" (Windows)
  and any future variant are treated as user-initiated unwinds and suppressed. No-op on macOS.
- **Web-app applicability:** The web app uses the browser's native `fetch` which throws a real
  `AbortError` on cancel. **No web-app change needed.**

---

## CF-007 — keychain prompt on every launch hard-errors when denied/cancelled

- **Date:** 2026-06-11
- **Area / file:** `src-tauri/src/lib.rs` (`secure_store_get`, `secure_store_set`),
  `src/infrastructure/platform/secureStore.ts` (`getRefreshToken`, `setRefreshToken`,
  `clearRefreshToken`)
- **Bug:** macOS shows *"app wants to use your confidential information stored in com.pragna2.app
  in your keychain"* on every launch (the startup refresh-token read, pragna2-tracker TD-009). If the user clicks
  **Deny/Cancel**, `secure_store_get` returned `Err`, which rejected the `invoke` promise and
  broke the session-restore / startup flow instead of just falling back to login. The prompt
  recurs every launch because dev builds are ad-hoc signed (no stable `signingIdentity` in
  `tauri.macos.conf.json`), so the keychain ACL never matches across rebuilds — a signing/dev
  concern, not fixed here; this entry addresses only the *denied-read crash*.
- **Root cause:** `secure_store_get` only special-cased `keyring::Error::NoEntry`; every other
  error — including a user-dismissed prompt / denied store, which `keyring` surfaces as
  `NoStorageAccess` or `PlatformFailure` — propagated as a hard error. The frontend wrapper had
  no `catch`, so the rejection bubbled into the auth bootstrap.
- **Fix:** (1) Rust read (`secure_store_get`): map `NoStorageAccess` / `PlatformFailure` to
  `Ok(None)` ("no saved session"), logged via `eprintln!` (not silent); malformed-entry errors
  still propagate. (2) Rust write (`secure_store_set`): map the same denial variants to `Ok(())`
  ("persistence skipped") so a denied write during login doesn't crash the flow — the session just
  won't survive relaunch. (3) Frontend: wrap `getRefreshToken` / `setRefreshToken` /
  `clearRefreshToken` `invoke`s in `try/catch`, degrading to `null` / no-op with a `console.warn`.
  Net effect: a dismissed keychain prompt degrades gracefully to interactive login on read and to
  skipped persistence on write. (Does **not** suppress the prompt itself — that needs stable code
  signing.)
- **Web-app applicability:** **NOT AFFECTED.** The keychain path is Tauri-only (`keyring` crate +
  `isTauriRuntime()`-guarded wrapper). The web app has no OS keychain and persists sessions via
  browser storage, so there is no equivalent denied-read crash to fix.

---

## CF-008 — macOS native title bar reappeared ("Tauri App") after a Windows config change

- **Date:** 2026-06-11
- **Area / file:** `src-tauri/tauri.macos.conf.json`, `src-tauri/tauri.windows.conf.json`
  (regression introduced by commit `5fbbebe`), guarded by
  `src/__tests__/tauriWindowConfig.test.ts`
- **Found by:** macOS dev build — the window showed the native title bar with the default **"Tauri
  App"** title and the chat sidebar dropped below it, instead of the intended overlay title bar with
  inset traffic lights. Windows UI work had silently broken the Mac chrome.
- **Bug:** On macOS the window lost `titleBarStyle: "Overlay"` + `hiddenTitle: true` (native title
  bar shown) and also reverted `title` to the Tauri default `"Tauri App"` and the size to Tauri
  defaults. Windows was fine because it uses `decorations: false`.
- **Root cause:** Tauri 2 merges `tauri.<platform>.conf.json` into `tauri.conf.json` using **JSON
  Merge Patch (RFC 7386)**: objects deep-merge, but **arrays are replaced wholesale**. `app.windows`
  is an array, so each platform file's `windows[0]` *replaces* the base window entirely on that
  platform — any key not physically present in the platform file reverts to a Tauri default. Commit
  `5fbbebe` moved `titleBarStyle`/`hiddenTitle` *out* of `tauri.macos.conf.json` into the shared
  base "so Windows dev picks them up"; on macOS the array-replace then dropped them (the base values
  never reach a platform that overrides `windows`), and the native title bar returned. The "Tauri
  App" title was the same array-replace dropping the base `title: "Pragna"` — it was always being
  lost on macOS, just masked while the title bar was hidden.
- **Fix:** Make each platform's `windows[0]` **self-contained** — repeat all shared keys (`title`,
  `width`, `height`, `minWidth`, `minHeight`) in every platform file alongside its platform-specific
  keys (`titleBarStyle`/`hiddenTitle`/`trafficLightPosition` on macOS; `decorations: false` on
  Windows). Nothing window-related is split across base + platform anymore, so the array-replace can
  never silently drop a setting. Added `tauriWindowConfig.test.ts` to fail loudly if the shared keys
  ever drift between files or the platform-critical chrome keys go missing (JSON can't carry a
  warning comment, so the invariant is enforced by a test). Side benefit: Windows now opens at the
  intended `1100×760` instead of Tauri's default `800×600`.
- **Web-app applicability:** **NOT AFFECTED.** This is a Tauri desktop-shell config concern
  (`tauri.*.conf.json` window definitions + platform-config merge semantics). The web app has no
  Tauri config and no native window chrome, so there is no equivalent bug.

---

## CF-009 — Agent Flows empty state was an inconsistent dashed box with no icon

- **Date:** 2026-06-11
- **Area / file:** `src/presentation/views/settings/FlowsView/FlowsView.tsx`
- **Bug:** With no flows defined, the Agent Flows page rendered a dashed-border box containing only
  the plain text "No flows yet…". Every sibling settings page (Agents, Connectors, Knowledge) shows
  a centred `size={40}` entity icon at `opacity-30` above the "No X yet" line — the Flows empty
  state was the odd one out, with no icon and a different container, so it read as a stray box rather
  than the intended empty state.
- **Root cause:** The empty state was hand-rolled (`rounded-xl border border-dashed … p-8`) instead
  of following the shared icon-empty-state pattern the other three pages use, and it never rendered
  the `FlowsIcon` (whose own docstring lists "the empty state" as an intended usage).
- **Fix:** Replace the dashed box with the sibling pattern — `<div className="py-16 text-center
  text-muted-foreground">` containing `<FlowsIcon size={40} className="mx-auto mb-3 opacity-30" />`
  above the text. Uses the same `FlowsIcon` glyph as the Settings menu item and page header, so the
  empty state now matches Agents/Connectors/Knowledge and the feature's iconography.
- **Web-app applicability:** **LIKELY AFFECTED — check.** The web app shares the settings views and
  the same FlowsView/empty-state pattern. If its Agent Flows page still uses a dashed-box text-only
  empty state, apply the same icon-empty-state treatment for consistency with its other settings
  pages.

---

## CF-010 — Sidebar footer rows ("Back to Chat" + avatar user name) didn't match the nav items above them

- **Date:** 2026-06-12
- **Area / file:** `src/components/ui/sidebar/SidebarBackItem.tsx`,
  `src/presentation/views/chat/components/AvatarMenu.tsx`
- **Bug:** Two pinned footer rows rendered out of sync with the navigation rows above them:
  1. **Left padding** — the settings sidebar's "Back to Chat" row used `px-2` while every
     `SidebarNavItem` uses `px-3`, so its icon/label sat 4px further left than the nav items.
  2. **Text color** — "Back to Chat" used full-strength `text-foreground` and the chat sidebar's
     avatar **user-name** used `text-foreground`, while their sibling nav items are dimmed
     (`text-sidebar-foreground/70` in settings, `text-foreground/80` in chat). The footers read
     brighter than the menu they belong to.
- **Root cause:** Both footer components were styled to mirror a generic "avatar footer button"
  rather than the actual nav-item row metrics/tokens, so padding, gap, and resting text color drifted
  from `SidebarNavItem` / the chat nav rows. The back item's 16px icon also lacked the nav items'
  20px icon-tile width, so even at matching padding the labels wouldn't line up.
- **Fix:** Align each footer row to its **own** sidebar's nav rows:
  - `SidebarBackItem` → `gap-3 px-3 h-8`, resting `text-sidebar-foreground/70` +
    `hover:text-sidebar-accent-foreground` (matches `SidebarNavItem` inactive), and the back arrow
    wrapped in a 20px (`w-5`) box so the icon edge and label align with the nav tiles.
  - `AvatarMenu` trigger → resting `text-foreground/80` + `hover:text-foreground` (matches the chat
    sidebar's nav rows). (Unrelated same-session change: the back icon was also swapped to a
    circular back-arrow badge — that's a deliberate UI choice, not part of this fix; see
    `web-app-parity.md`.)
- **Web-app applicability:** **LIKELY AFFECTED — apply.** The web app
  (`pragna2_sgummalla_works`) has the same components with the same mismatch:
  - `src/presentation/components/ui/Sidebar/SidebarBackItem.tsx` uses full
    `text-sidebar-foreground` + `gap-2.5 px-3.5 py-2.5 min-h-11`, whereas its `SidebarNavItem` uses
    `text-sidebar-foreground/70` + `gap-3 px-3 py-1.5 min-h-9` → dim the back row to `/70` (with the
    `hover:text-sidebar-accent-foreground` hover) and align its padding/height to the nav item.
  - `src/presentation/views/chat/AvatarMenu.tsx` uses `text-foreground` for the user name while its
    nav rows are dimmed → match the web chat sidebar's own nav-item color.
  Apply the same alignment + color-token sync on both. (Icon style may stay as the web app's
  `MessagesSquare` — UI-only, owner's choice.)

---

## CF-011 — Windows-native chrome activates in a plain browser (Windows UA) → crash / wrong layout

- **Date:** 2026-06-14
- **Area / file:** `src/infrastructure/platform/runtime.ts` (new `usesWindowsChrome()`),
  `src/infrastructure/platform/index.ts`, `src/App.tsx`,
  `src/presentation/views/chat/ChatView.tsx`,
  `src/presentation/views/chat/components/ChatSidebar.tsx`,
  `src/presentation/components/settings/SettingsSidebar/SettingsSidebar.tsx`.
- **Found by:** Desktop e2e suite (Playwright, browser-fallback). EVERY spec failed with a blank
  page. Diagnostic `pageerror` capture showed
  `TypeError: Cannot read properties of undefined (reading 'metadata')` thrown from
  `getCurrentWindow()` inside `WindowsTitleBar` at render. Playwright's `devices['Desktop Chrome']`
  sends a **Windows** user-agent (`Windows NT 10.0; Win64; x64`).
- **Bug:** All Windows-specific desktop chrome — the custom `WindowsTitleBar` (App.tsx) and the
  Windows sidebar/layout branches (ChatView, ChatSidebar, SettingsSidebar) — was gated solely on
  `isWindowsPlatform()`, a pure user-agent check (`navigator.userAgent.includes('Windows')`). In any
  plain browser sending a Windows UA (the e2e Desktop Chrome device, and any real browser on
  Windows) this rendered the Tauri-native chrome with **no Tauri runtime present**:
  `WindowsTitleBar` calls Tauri's `getCurrentWindow()` at render, which dereferences the absent
  `window.__TAURI_INTERNALS__` and throws, crashing the whole React tree → blank page → all specs
  fail. Even without the crash, the Windows branches hid macOS/default affordances the suite asserts
  (e.g. the "Search chats" title-bar button is `{!isWindows && …}`).
- **Root cause:** Windows-native chrome exists only because Tauri's `decorations: false` strips the
  native window frame; it is meaningful **only inside the Tauri runtime**. Gating it on OS detection
  alone (UA) wrongly activates it in browser contexts. Introduced 2026-06-11 by `80124e9`
  (UA-based `isWindowsPlatform()` + platform-conditional sidebar) and `51d7ec3` (WindowsTitleBar +
  App.tsx gating) — both predate the runtime-guard requirement.
- **Fix:** Add `usesWindowsChrome()` to the platform layer — `isWindowsPlatform() && isTauriRuntime()`
  — and use it everywhere the Windows-native chrome/layout was gated (App.tsx + the three view
  components). In the real Tauri Windows app the runtime is present, so behaviour is unchanged; in
  browser-fallback (and any plain browser on Windows) it falls through to the default web chrome —
  no Tauri call, no crash, and the layout the e2e suite expects. Keeps the platform check in the
  platform layer per the project's platform-abstraction rule.
- **Web-app applicability:** **UNLIKELY — verify.** The web app is browser-only and almost certainly
  has no `WindowsTitleBar` / Tauri window calls. If it has since copied any UA-based
  `isWindowsPlatform()` layout branching from the desktop, apply the same runtime-aware predicate;
  otherwise no action.

---

## CF-012 — First chat turn silently dropped in `tauri dev` ("Request cancelled", no reply)

- **Date:** 2026-06-14
- **Area / file:** `src/presentation/views/chat/hooks/useChatSession.ts` (subscriber-effect cleanup).
- **Found by:** Manual use in `pnpm tauri dev`: New chat → send the **first** message → no
  assistant reply, console shows `Agent execution failed: Error: Request cancelled`
  (`tauriHttpRequest.ts:46` → AG-UI `agent.ts` `runAgent`). The 2nd message onward works.
- **Bug:** On a brand-new chat the first turn is dispatched on mount, then **aborted mid-flight**, so
  no reply ever renders. Sequence (dev only): `ChatSessionView` mounts → the `useChatSession`
  subscriber effect subscribes, and the "fire pending first message" effect dispatches the run +
  sets its `firedFirstMessage` guard + clears the stashed message. React **StrictMode** (ON in
  `pnpm dev` / `tauri dev`, a no-op in prod) then synthetically tears the effects down → the
  subscriber cleanup calls `agent.abortRun()` → kills the in-flight first-turn fetch
  ("Request cancelled"). On the StrictMode re-mount the first-message effect sees its guard already
  set → does **not** re-dispatch, and the stashed message is already cleared → the turn is lost.
- **Root cause:** the cleanup aborted the run **synchronously on every effect teardown**, conflating
  StrictMode's synthetic unmount (and any benign same-agent effect re-run) with a real unmount /
  conversation switch. Latent since chat Phase 1 (commit `5613651`); never caught because the e2e
  suite disables StrictMode (`VITE_E2E_NO_STRICT_MODE=1`, commit `4968281`) and runs the browser
  transport, not the native `TauriHttpAgent` path — so neither the StrictMode teardown nor the
  native abort is exercised (cf. CF-011, pragna2-tracker TD-028).
- **Fix:** **Defer** the `abortRun()` one macrotask and **cancel** it if the SAME agent re-subscribes
  immediately (StrictMode's synthetic remount, or a benign re-run). A real unmount / conversation
  switch has no immediate same-agent re-subscribe, so the deferred abort still fires and stops the
  client fetch exactly as before. Result: a single first-turn dispatch survives and renders — no
  masking of the abort, no duplicate backend run. Tracked via a per-agent `pendingAbortRef`.
- **Web-app applicability:** **CHECK — likely N/A in this exact form.** The web app uses the browser
  transport (not `TauriHttpAgent`), but if it shares the `useChatSession` first-turn pattern
  (mount-dispatch + `firedFirstMessage` guard + abort-on-cleanup) it has the same StrictMode-teardown
  fragility on the first turn. Apply the same deferred-abort guard there if so.

---

## CF-013 — Second (and subsequent) user message wiped from UI until agent response arrives

- **Date:** 2026-06-16
- **Area / file:** `src/presentation/views/chat/ChatSessionView.tsx` (reconciliation effect, lines 178-187); extracted to `src/presentation/views/chat/hooks/useReconcileMessages.ts`.
- **Found by:** Manual use — after a successful first turn, submitting a second message caused the user message to be invisible. When the agent response eventually arrived it briefly flashed, then cleared, then both user message and agent response appeared together.
- **Bug:** `ChatConversation` had a reconciliation `useEffect` that swaps the in-memory message list for the persisted (server-fetched) snapshot whenever counts or last-message IDs differ. This reconciliation is necessary and correct for the tool-use / background-episode case, but it did not guard against the **optimistic-append window**: `send()` pushes the user message to `agent.messages` and calls `syncMessages()` while `status` is still `'idle'` (the `'running'` state arrives later via the backend's `RUN_INITIALIZED` event). The effect fires in the same React flush with `status === 'idle'` and sees `messages.length (N+1) !== persisted.length (N)`, triggering `replaceMessages()` — which wipes the just-appended user message. The run proceeds but the user message is invisible until the `/messages` refetch completes post-run.
- **Root cause:** The `'running'` status guard only protects mid-stream; there is no guard for the pre-run optimistic-append window (between `send()` and `RUN_INITIALIZED`).
- **Fix:** Extracted the reconciliation logic into `useReconcileMessages` hook. Added one guard before the mismatch check:
  ```typescript
  // CF-013: optimistic user message not yet persisted — run hasn't started; don't reconcile.
  if (lastInMemory.role === 'user' && messages.length > persisted.length) return;
  ```
  This is safe: tool-use and background-episode turns always end with an assistant message, so the guard never suppresses legitimate reconciliation. Nine unit tests added in `useReconcileMessages.test.ts` covering the CF-013 regression, the tool-use reconciliation path, all existing guards (running, empty lists, matching state), and the running→idle transition.
- **Web-app applicability:** **LIKELY AFFECTED — check.** If `pragna2_sgummalla_works` shares this reconciliation `useEffect` (same architecture, same `ChatConversation` pattern), it has the identical bug on every turn after the first. Apply the same `useReconcileMessages` hook (or the inline guard) to the web app.
- **Follow-up:** CF-013b — the role-specific guard (`role === 'user'`) was insufficient; see below.

---

## CF-013b — User message and agent response wipe and re-appear together after run completes

- **Date:** 2026-06-16
- **Area / file:** `src/presentation/views/chat/hooks/useReconcileMessages.ts` (CF-013 guard, line 44).
- **Found by:** Manual use — after CF-013 fix: user message 2 shown immediately (fixed), but once agent response arrived the user message briefly disappeared, then both user message and agent response appeared together.
- **Bug:** The CF-013 guard was `lastInMemory.role === 'user' && messages.length > persisted.length`. After `onRunFinalized` fires: `status` flips `'running'` → `'idle'`, the in-memory list is `[u1, a1, u2, a2]` (4), persisted is still `[u1, a1]` (2 — the `/messages` refetch has been invalidated but not resolved). The last in-memory message is `a2` (role `'assistant'`) — the CF-013 guard does **not** fire. `persisted.length (2) !== messages.length (4)` → `replaceMessages([u1, a1])` executes, wiping the just-completed turn from the UI.
- **Root cause:** The CF-013 guard checked the role of the last message; it needed to check only whether in-memory count exceeds persisted count (stale snapshot, regardless of what the last message is).
- **Fix:** Broadened the guard to count-only:
  ```typescript
  // CF-013 / CF-013b: in-memory is ahead of persisted — either optimistic pre-run
  // or a just-completed turn whose /messages refetch hasn't resolved yet. Wait.
  if (messages.length > persisted.length) return;
  ```
  Still safe for the original tool-use / stream-id-mismatch case: in that scenario counts are **equal** (same number of messages, just different IDs), so the guard never suppresses legitimate reconciliation. Added one CF-013b regression test to `useReconcileMessages.test.ts` (10 tests total, all passing).
- **Web-app applicability:** **LIKELY AFFECTED — check.** Same as CF-013.

---

## CF-019 — macOS overlay traffic lights overlap full-screen overlay headers

- **Date:** 2026-06-16
- **Tracker:** pragna2-tracker #120 (`type:bug`, `target:desktop-fe`)
- **Area / files:** `src/infrastructure/platform/runtime.ts` (+ `index.ts`) — new
  `isMacPlatform()` / `usesMacOverlayChrome()`; `src/constants/windowChrome.ts` — new
  `TRAFFIC_LIGHT_SAFE_INSET_PX`; `src/presentation/hooks/useOverlayTitleBarInset.ts` (new,
  reusable); applied in `src/presentation/views/settings/AgentsView/AgentFormModal.tsx` and
  `src/presentation/views/chat/components/AttachmentViewer.tsx`.
- **Found by:** Manual use (screenshot) — the macOS traffic-light buttons painted **on top of** the
  "Edit … Assistant" agent-editor header (its back button + title), making the title unreadable and
  the back button hard to hit.
- **Bug:** The macOS app runs with `titleBarStyle: "Overlay"` + `hiddenTitle: true`
  (`tauri.macos.conf.json` / `tauri.conf.json`), so the webview fills the whole window and the native
  traffic lights float over the **top-left** corner at `trafficLightPosition {x:22,y:28}`. The normal
  app chrome reserves a title row for them (via the sidebar / `SIDEBAR_TITLE_ROW_PX` + `AppTitleBar`),
  but a **full-screen overlay** (`fixed inset-0`, `z-[701]`/`z-[700]`) draws **over** that chrome and
  pins its own header to the very top — with no inset reserved for the lights. Two surfaces collide:
  the agent editor (`AgentFormModal`) and the attachment viewer (`AttachmentViewer`).
- **Root cause:** No shared mechanism reserved the traffic-light safe zone for content anchored to the
  window's top-left in a full-screen overlay. Centered dialogs (provider/connector modals,
  update-required screen) are unaffected — their content sits mid-window, so the lights only float over
  the dimmed backdrop (normal macOS behavior).
- **Fix:** A single reusable, platform-gated mechanism, applied to every offending header:
  1. `usesMacOverlayChrome()` (= macOS **and** Tauri runtime) — the only case where the overlay lights
     actually exist; mirrors the `usesWindowsChrome()` runtime-gating rationale (CF-011) so a plain
     browser / e2e Desktop Chrome — which can send any OS UA — never gets the inset.
  2. `TRAFFIC_LIGHT_SAFE_INSET_PX` — the left inset derived from `TRAFFIC_LIGHT_X` + the light-group
     width + clearance (no inline literal; lives in the chrome-geometry constants file).
  3. `useOverlayTitleBarInset()` — returns `{ paddingLeft }` on macOS-overlay chrome, else `undefined`.
     Spread onto a full-screen overlay's header `style`. Reuse this on any future full-screen overlay.
- **Tests:** `runtime.test.ts` 4-cell OS×runtime truth table for `usesMacOverlayChrome` + `isMacPlatform`;
  `useOverlayTitleBarInset.test.ts` (both branches, hook mocked platform); `AgentFormModal.test.tsx`
  header-inset applied/absent (hook mocked both ways). Full suite green; `lint:platform` passes (no
  OS detection outside the platform layer).
- **Web-app applicability:** **PROBABLY NOT AFFECTED — verify.** This is a **desktop-only / macOS-only**
  defect: it exists only because of the Tauri overlay title bar with native traffic lights. The web app
  (`pragna2_sgummalla_works`) runs in a normal browser with no overlay window controls, so its
  full-screen overlays have nothing to collide with. No port needed unless the web app is ever wrapped
  in a desktop shell with an overlay title bar.

---

## CF-018 — Select dropdowns overlap the trigger (option list renders on top of the control)

- **Date:** 2026-06-17
- **Area / file:** `src/components/ui/select.tsx` (shared `SelectContent` primitive).
- **Found by:** Manual use — across **every** `Select` (chat model picker, agent-form MCP connector
  picker, active/inactive selectors, all settings dropdowns) the option list opened **over** the
  trigger button instead of below it, overlapping the control.
- **Bug:** `SelectContent` defaulted to Radix `position="item-aligned"`, which positions the content so
  the *selected item* aligns with (sits on top of) the trigger — the list overlaps the control. This
  has been the default since the primitive was added (`d99a2c7`, 2026-06-09); it was **never fixed by a
  commit** on any branch (the earlier "fix" was an uncommitted local edit that didn't survive — a
  cross-machine / uncommitted-loss case; the standing "Sync Latest" rule applies).
- **Fix:** Default `position="popper"` so the list opens **below/above** the trigger (offset, no
  overlap) — the standard dropdown behavior. Also changed the popper viewport from
  `h-(--radix-select-trigger-height)` to **`min-h-`** so a multi-item list grows instead of being
  clipped to one row. `z-[800]` (CF-001, above modal overlays) is retained, so dropdowns inside dialogs
  still float correctly. Committed to the shared primitive → fixes all Selects at once, and committed
  (not left in the working tree) so it can't silently regress again.
- **Web-app applicability:** **LIKELY AFFECTED — check.** If `pragna2_sgummalla_works`'s `select.tsx`
  also defaults to `item-aligned`, every dropdown overlaps there too — set `position="popper"` +
  `min-h-` viewport the same way.

---

## FEAT-002 — Clean agent-activity rendering (one collapsible "umbrella" per turn, claude.ai-style)

- **Date:** 2026-06-17
- **Area / files:** `src/presentation/views/chat/components/ActivityDisclosure.tsx` (new, reusable),
  `AssistantTurn.tsx` (new), `ToolCallBadge.tsx`, `ReasoningPanel.tsx`, `ChatMessage.tsx`,
  `ChatSessionView.tsx`; utils `utils/toolDisplay.ts`, `utils/assistantTurns.ts` (new);
  constants `constants/toolLabels.ts` (new), `constants/chat.ts` (`PROPOSE_FLOW_PREFIX`).
- **Why:** The chat transcript dumped raw, developer-facing tool output — the internal tool name
  (`mcp_tavily_tavily_search`), raw args JSON, **and the raw result payload** (a wall of JSON) — both
  via the old `ToolCallBadge` (`call.result` in a `<pre>`) and via raw `tool`-role message content
  (`ChatMessage` rendered `{message.content}` for `role === 'tool'`). The user wanted the claude.ai
  model: all intermediate work folded under one collapsible umbrella, only the final answer in the
  transcript.
- **What shipped:**
  1. **No raw output.** `tool`-role messages are suppressed entirely (their content is the raw result);
     `ToolCallBadge` no longer renders the result, and shows a **friendly label** (`toolDisplayLabel`
     strips the `mcp_` prefix, collapses the duplicate connector word, title-cases →
     `mcp_tavily_tavily_search` → "Tavily Search") + the primary arg, with args as readable key/value
     lines (arrays/objects summarized by count — never raw JSON).
  2. **Reusable `ActivityDisclosure`** — the shared collapsible timeline (summary header → Clock node →
     `Working…`/`Done`). `ReasoningPanel` is now a thin wrapper over it.
  3. **`AssistantTurn` grouping** — `groupChatMessages` segments the flat list into user messages +
     assistant turns; each turn folds its reasoning + interim narration + every plain tool call into
     **one** `ActivityDisclosure`. The **final answer** (last assistant text with no trailing tool
     call) and **outputs/interactive cards** (generated-document PDFs, flow-proposal cards, HITL
     forms) render **outside** the umbrella via the existing `ChatMessage` (with a new `hideReasoning`
     prop so reasoning isn't duplicated). The umbrella is open + live while streaming, collapses to
     `Done` when finalized. Plain turns (no tools/reasoning) render no umbrella. **Agent flows are
     untouched** — their stage UI (proposal cards, HITL, episode stages) stays as-is.
- **Tests:** pure utils (`toolDisplay`, `assistantTurns`) + component render tests
  (`ActivityDisclosure`, `ToolCallBadge`, `AssistantTurn`); full suite green.
- **Web-app applicability:** **APPLIES — port to `pragna2_sgummalla_works`.** The web FE shares the
  same `ChatMessage`/`ToolCallBadge`/`ReasoningPanel`/`useChatSession` architecture and currently has
  the **identical** raw-JSON dump (its `ToolCallBadge` renders `call.result`; its `ChatMessage` likely
  renders raw `tool`-role content). Bring over: `ActivityDisclosure`, `toolDisplay`, `assistantTurns`,
  `AssistantTurn`, the `ChatMessage` tool-role suppression + `hideReasoning`, and the `ChatSessionView`
  grouping. Tracked for the web FE in **pragna2-tracker** (`target:web-fe`).

---

## CF-017 — Brand logo vanished after a reply (no idle "ready" indicator) — web-FE/claude.ai parity

- **Date:** 2026-06-17
- **Area / file:** `src/presentation/views/chat/components/ThinkingStrip.tsx`.
- **Bug:** The desktop `ThinkingStrip` returned `null` whenever `!active`, so the Pragna brand logo
  disappeared the moment a reply finished — there was no persistent "ready for your next message"
  indicator at the bottom of the conversation. The web FE (and claude.ai) keep the logo on screen: a
  **static** logo when idle, a **spinning** logo + status label while thinking.
- **Fix:** Made the strip persistent — always render; spin the logo + show the label only while
  `active`; when idle, a static logo with `aria-label="Ready for your next message"` and no text.
  (Matches the web FE's `ThinkingStrip` idle/thinking states; the desktop keeps its simpler styling —
  parity is functional, not pixel-for-pixel.) 3 component tests added.
- **Web-app applicability:** **N/A as a fix — the behavior ORIGINATES on the web FE** (this brought the
  desktop up to parity). No web-FE change needed.

---

## CF-016 — Agent silently "not responding" — FE ignored the backend's in-band `RUN_ERROR` event

- **Date:** 2026-06-16
- **Area / file:** `src/presentation/views/chat/hooks/useChatSession.ts` (run subscriber); new pure helper `src/presentation/views/chat/utils/runError.ts`.
- **Found by:** User report — "when an agent has MCP connectors configured, the agent is not responding." Backend (`nexus-kit-api`) Docker logs showed the run dying with an Anthropic `400` (`tools.2.custom.name` — MCP tool names contain dots; tracked as pragna2-tracker **#114**, a BE bug), and the BE **does** publish a terminal `RUN_ERROR` event on failure (its own comment: "so the FE's `onRunFailed` fires"). Yet the FE showed nothing.
- **Bug:** In `@ag-ui/client` 0.0.43, a terminal **`RUN_ERROR` *event*** is delivered to the `onRunErrorEvent` subscriber hook and **does not throw** — so it never reaches the `catchError → onError → onRunFailed` path. `onRunFailed` only fires on a *thrown* error (connection drop / abort rejection). The FE subscriber implemented `onRunFailed` but **not** `onRunErrorEvent`, so a backend-emitted `RUN_ERROR` was a no-op: `onRunFinalized` then flipped `status` to `idle`, leaving the turn with **no assistant reply and no error banner** — the silent "not responding" symptom. The BE's RUN_ERROR fix (added to stop a server-side silent hang) assumed an FE handler that didn't exist.
- **Root cause:** Missing `onRunErrorEvent` handler — the FE conflated "run failed" with "run *threw*". ag-ui surfaces background/in-band failures as a non-throwing event, which the FE dropped.
- **Fix:** Added an `onRunErrorEvent` handler that mirrors `onRunFailed`: stop the spinner, set `status='error'`, show the backend's (already sanitized) message — falling back to `ERRORS.CHT_004` when empty — and flag `lastRunFailedRef` so the optimistic user message is pruned on the next send (CF-015 / #111). A client-side abort arrives as `RUN_ERROR` `code:'abort'`; that path unwinds silently (no banner), same as `onRunFailed`'s `AbortError` branch (CF-006). The abort-vs-error decision is extracted to the pure `classifyRunErrorEvent` helper with 6 unit tests. All 133 chat-area tests pass.
- **Web-app applicability:** **LIKELY AFFECTED — check.** `pragna2_sgummalla_works` shares `useChatSession`; if its subscriber also lacks `onRunErrorEvent`, every backend `RUN_ERROR` (LLM 4xx/5xx, rate-limit, mid-stream failure) fails silently there too. Add the same handler. (Independent of transport — browser or Tauri.)
- **Note:** This is the *FE surfacing* fix. The *underlying* failure for the MCP case (Anthropic 400 from dotted tool names) is a backend bug tracked as pragna2-tracker #114; once that lands, this RUN_ERROR path stops triggering for MCP — but the FE must still surface RUN_ERROR for every other run failure.

---

## CF-015 — User message duplicated N× in the history sent per turn (pragna2-tracker #111)

- **Date:** 2026-06-16
- **Area / file:** `src/presentation/views/chat/hooks/useChatSession.ts` (`send` + `onRunFailed`/`onRunFinalized` subscriber hooks); new pure helper `src/presentation/views/chat/utils/messageDedup.ts`.
- **Found by:** Backend (pragna2-tracker #110, GitLab) — while investigating a Bedrock `RemoteProtocolError`, the BE logged the **same user message repeated 8×** inside one Bedrock request payload on thread `3fe045ec`. Filed for the desktop FE as **#111** per the no-cross-repo rule.
- **Bug:** `send()` optimistically pushes the user message into `agent.messages` (with a client `randomId()`) **before** `runAgent()`; ag-ui streams that whole list to the BE as the turn's history (`prepareRunAgentInput` sends `this.messages` verbatim). A **successful** run is later reconciled to the persisted log by `useReconcileMessages` (which swaps the optimistic copy for the server-id'd one). A **failed** run is **not** reconciled — and the reconciliation hook's CF-013b guard (`if (messages.length > persisted.length) return;`) deliberately skips while in-memory is ahead of persisted (the exact failed-orphan shape). So the orphaned optimistic copy lingers in `agent.messages`, and every retry of the message appends another copy → the same user message is re-sent N× in the outgoing history. The #110 `RemoteProtocolError` storm (repeated failures on one fresh thread) is what drove it to 8×.
- **Root cause:** Optimistic-append with no rollback on failure. The only pruning path (reconciliation against the persisted snapshot) is intentionally inert exactly when a run failed and left an un-persisted orphan, so failed-turn user messages accumulate across retries.
- **Fix:** Track the last optimistic user-message id (`pendingUserIdRef`) and whether its run failed (`lastRunFailedRef`, set in `onRunFailed`, cleared on a successful `onRunFinalized`). At the **start of the next `send`**, if the prior run failed, drop the orphan via the pure `pruneOrphanedOptimisticMessage(messages, orphanId)` helper before pushing the new optimistic message — guaranteeing exactly one copy per turn. Id-based (never content-based), so a legitimately repeated message is preserved; a succeeded message is never pruned (its id is cleared on finalize); harmless no-op in the sub-case where the BE *did* persist the user turn and reconciliation already removed the orphan. The failed message stays visible until the next send (no premature content loss), then is replaced. 6 unit tests in `messageDedup.test.ts`; all 127 chat-area tests pass.
- **Web-app applicability:** **LIKELY AFFECTED — check.** `pragna2_sgummalla_works` shares the same `useChatSession` optimistic-push + reconcile architecture (it originated the `replaceMessages` resync). If it also carries the CF-013b "in-memory ahead → skip reconcile" guard, it has the identical failed-orphan accumulation. Apply the same `pendingUserIdRef`/`lastRunFailedRef` + `pruneOrphanedOptimisticMessage` rollback there. (Web app uses the browser transport, but the duplication is transport-independent — it's in the shared message-state lifecycle.)
- **Possible BE-side residue (flag, do NOT fix here):** if the BE persists a user row on **each** failed/retried POST, the persisted `/messages` log itself may carry duplicate user rows independent of this FE fix. That is a `nexus-kit-api` concern — record it as a tracked item for the BE session rather than touching the BE from this repo.

---

## CF-014 — MCP "Failed to save local servers" hides the real Tauri/Rust error

- **Date:** 2026-06-16
- **Area / file:** `src/presentation/views/settings/LocalServersView/LocalServersView.tsx` (`handleSave` catch block, lines 159–168); new helper `src/infrastructure/errors/extractErrorMessage.ts`.
- **Found by:** Manual use — saving a local MCP server config always showed the generic "Failed to save local servers." message with no further detail, making it impossible to diagnose the actual failure.
- **Bug:** Tauri's `invoke()` rejects with a **plain string** (the Rust `Err(String)` value), not a JS `Error` object. The catch block checked `e instanceof Error` before reading `.message`, so for every Rust-originated error the `instanceof` check returned `false` and the generic fallback was shown instead of the real message (spawn failure, auth error, keychain error, backend 4xx, etc.).
- **Root cause:** Consistent pattern mismatch between how Tauri surfaces errors (plain string) and how the catch block expected them (Error instance). The `logger.fromError` call did wrap the string into an `Error`, but only after the user-visible `setError` had already discarded it.
- **Fix:** Extracted `extractErrorMessage(e, fallback)` helper to `src/infrastructure/errors/extractErrorMessage.ts` — handles `Error`, plain string, and unknown. Used in `handleSave`:
  ```typescript
  const msg = extractErrorMessage(e, 'Failed to save local servers.');
  setError(msg);
  logger.fromError('LSV_001:save', e instanceof Error ? e : new Error(msg));
  ```
  9 unit tests in `extractErrorMessage.test.ts` covering all branches, all passing.
- **Web-app applicability:** **CHECK — same pattern likely present.** Any catch block in `pragna2_sgummalla_works` that does `e instanceof Error ? e.message : fallback` after a `fetch`/API call has the same risk if the API layer throws plain strings. Apply `extractErrorMessage` wherever Tauri `invoke()` or fetch errors are caught.

---

## FEAT-001 — MCP auth re-authentication from within the app (GitLab #108)

- **Date:** 2026-06-16 (revised 2026-06-16)
- **Area / files:** `src-tauri/src/domain/mcp.rs`, `src-tauri/src/platform/mcp_registry.rs`, `src-tauri/src/application/mcp_host.rs`, `src-tauri/src/adapters/mcp_commands.rs`, `src-tauri/src/lib.rs`, `src/infrastructure/platform/mcpStdio.ts`, `src/presentation/views/settings/LocalServersView/LocalServersView.tsx`.
- **Feature:** Each configured local MCP server card now shows an **"Authenticate"** button. Clicking it runs `<binary> auth` (the mcp-adaptor OAuth browser flow) via a new Tauri command and shows a success or error inline on the card — no terminal required. This is always-visible (proactive re-auth), not conditional on a save error, because the expired-token error only appears in child-process stderr and is never reachable via the rmcp protocol-level error string.
- **Implementation:**
  - `mcp_host::auth(command)` use case — spawns `<command> auth` via `tokio::process::Command`, waits for exit-0.
  - `mcp_stdio_auth` Tauri command registered in `lib.rs`.
  - `mcpStdio.auth(command)` TypeScript wrapper.
  - `LocalServersView`: `commandByName` map (editorText → displayName → command); per-card `authenticatingId` + `authResult` state; `handleAuthenticate` callback; Authenticate button shown when command is known; success/error status rendered below the card row.
  - Removed `McpHostError::AuthExpired` domain variant and `AUTH_EXPIRED_SENTINEL` — the sentinel approach cannot work because rmcp's error is `"connection closed: initialize response"` (protocol level), never the child's stderr text `"failed to ensure valid token"`.
  - Spec docs: `docs/specs/features/mcp-auth-refresh.md` + `docs/specs/technical/mcp-auth-refresh.md`.
  - 7 TS component tests in `LocalServersView.test.tsx`; 583 total tests pass.
- **Web-app applicability:** N/A — local stdio MCP servers are desktop-only.
