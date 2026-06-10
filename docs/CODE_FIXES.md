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
