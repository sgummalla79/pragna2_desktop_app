# Code Fixes Log

A running log of **bug fixes** (corrections to broken behavior — not new features). Every fix to
existing code is recorded here per the `CLAUDE.md` rule "Document Every Bug Fix".

**Purpose:** the desktop app (`pragna2_desktop_app`) and the web app (`pragna2_sgummalla_works`)
share architecture and many components, so a defect found on one side very often exists on the other.
This log is the hand-off the team uses to apply the same fix to the web app when needed.

Each entry: **date · area/file · the bug + root cause · the fix · web-app applicability.**

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
- **Area / file:** **`pragna2-api`** (backend) — `src/infrastructure/pdf/renderer.py`
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
- **Fix:** **DONE in `pragna2-api`** — branch `hotfix/pdf-large-table-layout`, commit `e7c6f3b`. Made
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
  **The `pragna2-api` hotfix branch is pushed but NOT merged to `Releases/V1` — that's a PR/review step.**
- **Web-app applicability:** **AFFECTS BOTH APPS (shared backend) — now fixed for both** once the
  `pragna2-api` hotfix merges. The web app uses the same renderer, so this resolves its
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

## CF-005 — async create_pdf_long document never auto-surfaces in the chat [OPEN — desktop FE]

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
- **Status / fix:** **OPEN (desktop).** Recommended: while a `create_pdf_long` request is pending,
  poll `/messages` (a bounded `refetchInterval` until the document turn arrives) OR refetch on the
  long-doc episode-completion signal. Tracked as TD-030. `scenario-21` ×2 stay `test.fixme` on this
  until fixed. (The backend CF-003 fix is independent and already done.)
- **Web-app applicability:** **CHECK / likely a parity gap.** The web app's `scenario-21` presumably
  passes, so it has *some* surfacing mechanism (polling or episode-completion refetch) the desktop
  lacks. Compare the web app's create_pdf_long surfacing and port the missing piece.
