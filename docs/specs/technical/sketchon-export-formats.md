# Technical Spec: Sketchon diagram copy/download format menus

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-30
> **Last Updated**: 2026-06-30

---

## 1. Overview

Two changes, no backend involvement (sketchon renders client-side):

1. **Clipboard fix (CF-053).** Centralise all `navigator.clipboard` access in a
   new platform-layer module that issues `clipboard.write()` **synchronously**
   with a *pending* payload promise, so the WKWebView user-gesture activation is
   not spent by the SVG render + raster `await`s before the write. This restores
   the previously-silent "Copy as PNG".
2. **Format menus.** Replace the single Copy and single Download buttons on the
   diagram card with two dropdown menus (Copy: PNG/SVG-text; Download:
   PNG/SVG/JPG).

## 2. Architecture & Layer Placement

- **Domain / Application / Adapters (Rust):** unchanged.
- **Infrastructure / Platform:** new `src/infrastructure/platform/clipboard.ts`
  — the **only** place that calls `navigator.clipboard`. Re-exported from
  `platform/index.ts`. This is the sibling of `opener.ts` (CF-051): a webview
  capability with a platform-specific gotcha, isolated behind a small API so no
  presentation component reasons about the WKWebView activation rule.
- **Presentation:** `SketchonDiagram` gains the two menus, a generalised raster
  helper, and routes copies through the platform module.
  `MessageActions.copy` is routed through the same `copyText` (and now **logs**
  failures instead of swallowing them).

## 3. Key Modules & Signatures

### `src/infrastructure/platform/clipboard.ts`

```ts
/** Copy text. A ready string → writeText; a Promise<string> → write() with a
 *  text/plain ClipboardItem so the write fires synchronously (gesture-safe). */
export async function copyText(text: string | Promise<string>): Promise<void>;

/** Copy a PNG image. Prefer the Promise<Blob> form when the blob is produced by
 *  async work (rasterisation): the ClipboardItem is built and clipboard.write()
 *  is called immediately with the pending promise, preserving the WKWebView
 *  user-gesture activation. Re-throws clipboard errors (never swallows). */
export async function copyImagePng(png: Blob | Promise<Blob>): Promise<void>;
```

Constants (named, not inlined): `CLIPBOARD_PNG_MIME = 'image/png'`,
`CLIPBOARD_TEXT_MIME = 'text/plain'`.

### `src/presentation/views/chat/components/SketchonDiagram.tsx`

- `svgToRasterBlob(svg, mode, mime): Promise<Blob>` — generalises the old
  `svgToPngBlob`; `mime` selects PNG vs JPEG (`canvas.toBlob(_, mime, quality)`,
  `JPEG_QUALITY = 0.92` for JPEG only). Renders at `RASTER_SCALE = 2` on a solid
  theme-aware backing (`RASTER_BG.{light,dark}`) — mandatory for JPEG (no alpha)
  and keeps PNG self-contained when pasted.
- `DownloadFormat { label, ext, mime: string | null }` + `DOWNLOAD_FORMATS` —
  data-driven download menu (open/closed: a new format is a list entry). A
  `null` mime saves the SVG vector directly; any other rasterises.
- `download(fmt)` — one handler for all download formats; SVG path builds a
  `Blob`, raster path calls `svgToRasterBlob`. Saves via `triggerDownload(blob,
  filename)` (transient object-URL anchor). Filename = `slugifyTitle(title).ext`.
- `copyPng()` / `copySvg()` — both hand a **pending IIFE promise** to
  `copyImagePng` / `copyText` (gesture-safe). Both set the shared three-state
  `copyState` (`idle | copying | copied`, `COPIED_FEEDBACK_MS = 1800`) and log
  failures via `logger.fromError`.
- Menu state: `openMenu: 'copy' | 'download' | null` (one menu at a time);
  a `useEffect` closes it on outside `mousedown` or `Escape` (listener attached
  only while a menu is open). Menus are `role="menu"`/`menuitem`; triggers carry
  `aria-haspopup="menu"` + `aria-expanded`.

## 4. Data Flow — Copy as PNG (the fixed path)

```
click "Copy as PNG"
  → copyPng(): setCopyState('copying')
  → copyImagePng( IIFE_promise )      // called synchronously in the click
       └ new ClipboardItem({'image/png': IIFE_promise})
       └ navigator.clipboard.write([item])   // ISSUED here, gesture still live
  ... webview then awaits IIFE_promise:
       IIFE: renderTitledSvg() → svgToRasterBlob(svg, mode, 'image/png') → Blob
  → resolves → image on clipboard → setCopyState('copied')
```

The pre-fix order awaited the render + raster **before** `clipboard.write`, so by
the time `write` ran the activation was gone → `NotAllowedError` (swallowed).

## 5. Error Handling

- `clipboard.ts` re-throws all underlying clipboard errors (no swallow).
- `SketchonDiagram` copy/download handlers wrap the work in `try/catch` and call
  `logger.fromError(...)`; copy handlers also reset `copyState` to `idle`.
- `MessageActions.copy` now logs via `logger.fromError` instead of `catch {}`.

## 6. CSS

`.sketchon-card` no longer uses `overflow: hidden` (it would clip the dropdowns,
which drop down over the diagram). Corner rounding is preserved by rounding the
header top (`border-top-*-radius`) and the diagram container bottom
(`border-bottom-*-radius`). Menus use the shared `MENU_CLASS` / `MENU_ITEM_CLASS`
(theme tokens `bg-popover` / `border-border` / `hover:bg-accent`), mirroring the
message-action menu.

## 7. Tests

- `src/infrastructure/platform/clipboard.test.ts` — `copyText` string→`writeText`
  vs Promise→`write`(text/plain); `copyImagePng` blob/Promise→`write`(image/png);
  **write issued before the blob promise resolves** (gesture-safe contract);
  both propagate failures.
- `SketchonDiagram.test.tsx` — Copy menu shows PNG/SVG; _Copy as SVG_ calls
  `copyText` with a **pending promise** resolving to SVG markup; _Copy as PNG_
  routes to `copyImagePng` with a pending promise; Download menu shows
  PNG/SVG/JPG; Escape closes the menu. (`<img>`/`<canvas>`/`createObjectURL`
  stubbed for jsdom.)
- `MessageActions.test.tsx` — unchanged assertion (copy still calls
  `navigator.clipboard.writeText`, now via `copyText`).

## 8. Platform / Cross-OS Notes

- Works in WKWebView (macOS) and WebView2 (Windows) — both accept `image/png`
  and `text/plain` on `clipboard.write`, and the pending-promise pattern is
  supported in both. **JPEG is rejected on `write` by both**, hence
  download-only.
- No Tauri clipboard plugin is used; the webview Clipboard API is sufficient
  once the gesture timing is correct. The platform `lint:platform` gate is
  unaffected (it targets `navigator.userAgent`/`platform`/`__TAURI_INTERNALS__`).

---

_Link to Feature Spec: [features/sketchon-export-formats.md](../features/sketchon-export-formats.md)_
