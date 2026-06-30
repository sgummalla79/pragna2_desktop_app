# Feature Spec: Sketchon diagram copy/download format menus

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-30
> **Last Updated**: 2026-06-30

---

## 1. Overview

A rendered `sketchon` diagram card previously had a single **Copy as PNG** button
and a single **Download SVG** button. Two problems: (1) the PNG copy **silently
did nothing** in the macOS Tauri webview (see CF-053 — the clipboard write lost
its user-gesture activation behind two `await`s), and (2) users had no choice of
export format.

This feature replaces both single buttons with **two dropdown menus**:

- **Copy** → _Copy as PNG_ (a real image on the clipboard, pasteable into docs /
  chat / image editors) and _Copy as SVG_ (the SVG **markup** as clipboard text,
  pasteable into a code editor or `.svg` file).
- **Download** → _PNG image_, _SVG vector_, _JPG image_.

It also fixes the copy bug by centralising clipboard access in a new platform
layer (`src/infrastructure/platform/clipboard.ts`) that issues the clipboard
write synchronously within the click, preserving the gesture activation.

## 2. Goals & Non-Goals

**Goals**
- [x] Copy menu offers PNG (image) and SVG (markup-as-text); both actually land on the clipboard in the Tauri webview (macOS + Windows).
- [x] Download menu offers PNG, SVG, and JPG, each saved with the correct extension and a kebab-cased filename from the diagram title.
- [x] The export keeps the diagram **title** (rendered into the file even though the on-screen card shows the title in its header).
- [x] PNG/JPG exports are theme-aware, crisp (2× raster) and self-contained on a solid backing.
- [x] No silent failures — clipboard/download errors are logged.

**Non-Goals**
- Copying JPG to the clipboard — the webview clipboard only accepts `image/png` for images (WKWebView and WebView2 both reject `image/jpeg` on `write()`). JPG is therefore offered as a **download only**.
- Server-side changes (sketchon renders entirely client-side).
- A web-app implementation (tracked separately for `pragna2_sgummalla_works`).

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| user | copy a diagram as an image | I can paste it into a doc, chat, or slide |
| user | copy a diagram's SVG source | I can drop the vector into an editor / `.svg` file |
| user | download a diagram as PNG / SVG / JPG | I keep it on disk in the format I need |

## 4. Acceptance Criteria

- [x] Given a rendered diagram, when I click **Copy**, then a menu shows _Copy as PNG_ and _Copy as SVG_.
- [x] Given the Copy menu, when I click _Copy as PNG_, then a PNG image is placed on the clipboard (works in the macOS WKWebView — the gesture is not lost) and the button shows a transient "Copied!".
- [x] Given the Copy menu, when I click _Copy as SVG_, then the diagram's SVG markup is placed on the clipboard as text.
- [x] Given a rendered diagram, when I click **Download**, then a menu shows _PNG image_, _SVG vector_, and _JPG image_.
- [x] Given the Download menu, when I pick a format, then a file `<slug>.{png|svg|jpg}` is saved (slug from the diagram title, or `diagram`).
- [x] Given a PNG/JPG export, then it is rendered at 2× on a solid theme-aware backing (white in light mode, dark slate in dark mode).
- [x] Given a menu is open, when I click outside it or press Escape, then it closes.
- [x] Given a clipboard or download failure, then it is logged (never silently swallowed) and the button resets.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| WKWebView drops clipboard permission once the gesture is consumed | Clipboard write is issued synchronously with a pending blob/text promise, so the gesture survives (CF-053) |
| Clipboard unavailable (insecure context / denied) | Error logged via `logger.fromError`; button resets to idle; message not crashed |
| User tries to copy a JPG | Not offered — JPG is download-only (webview clipboard rejects `image/jpeg`) |
| Diagram has no title | Filename falls back to `diagram` |
| Spec still streaming / not yet rendered | Toolbar isn't shown until the diagram renders; export handlers no-op if the export spec isn't ready |
| Canvas 2D context / `toBlob` unavailable | Rasterise promise rejects; logged; no file written |

## 6. Out of Scope

- Copy/paste of the raw `sketchon` JSON spec.
- PDF export, zoom/print controls.

## 7. Open Questions

- [ ] None outstanding for desktop. Web-app parity is tracked separately.

---

_Link to Technical Spec: [technical/sketchon-export-formats.md](../technical/sketchon-export-formats.md)_
