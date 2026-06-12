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
  Tracked as TD-030 (done).
- **Discovery note:** the desktop had **deferred** this whole subsystem with only a generic
  `useChatSession` comment ("episode attach … and attachments are deferred (see docs/TODO.md)") —
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
  in your keychain"* on every launch (the startup refresh-token read, TD-009). If the user clicks
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
