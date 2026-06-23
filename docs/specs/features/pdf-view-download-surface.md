# Feature Spec: Reliable PDF viewing, downloading & auto-surfacing

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-22
> **Last Updated**: 2026-06-22 (viewer presented as a resizable slide-over Sheet)

---

## 1. Overview

Generated PDFs (from `create_pdf_short` / `create_pdf_long`) were effectively
unusable on the desktop app: the in-app PDF viewer opened a **blank** window, the
**Download** button did nothing, and for a long (background-episode) document the
**card only appeared after the user switched chats and back**. This feature makes
all three reliable: PDFs render in-app via pdf.js canvas, Download saves through a
native "Save As" dialog, and a finished background document surfaces on its own.

The root causes were platform limitations of Tauri's macOS webview (WKWebView)
plus a missing reactive refresh — the backend was healthy throughout (it produced
and served a valid, complete PDF).

The viewer is presented as a **right-anchored slide-over Sheet** — the same
floating, resizable rounded panel as the flow YAML editor — rather than a
full-screen takeover, so the document opens beside the chat and the conversation
stays in context. Its left edge drags to resize (shared `useSheetResize` hook);
Escape, the close button, or a backdrop click dismisses it.

## 2. Goals & Non-Goals

**Goals**
- [x] A PDF attachment opens to a readable, scrollable document (never blank).
- [x] Download writes a real file to disk the user chooses, with success/failure feedback.
- [x] A `create_pdf_long` document's card appears automatically when generation finishes.
- [x] All three work in the Tauri runtime (macOS + Windows) and degrade gracefully in the browser fallback (dev / e2e).

**Non-Goals**
- PDF editing, text selection, search, or thumbnails (view + download only).
- Changing how PDFs are generated or served (backend is unchanged).
- A web-app implementation (tracked separately for `pragna2_sgummalla_works`).

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| user | open a generated PDF in the app | I can read it without leaving the app or it being blank |
| user | download a generated PDF | I keep a copy on disk where I choose |
| user | wait for a long research PDF | its card shows up on its own when ready, without me switching chats |

## 4. Acceptance Criteria

- [x] Given a PDF attachment, when I open it, then it opens as a right-side slide-over Sheet (not full-screen) and its pages render on canvas (scrollable, fit-to-width), never a blank frame.
- [x] Given the viewer is open, when I drag its left edge, then the panel resizes (clamped to the viewport) and the PDF reflows fit-to-width.
- [x] Given the viewer is open in Tauri, when I click Download, then a native Save dialog appears and the chosen file is written; a success toast confirms it.
- [x] Given I cancel the Save dialog, then nothing is written and no error is shown.
- [x] Given a download fails (e.g. fetch/write error), then an error toast tells me it couldn't be saved (no silent failure).
- [x] Given a `create_pdf_long` document finishes while I stay on the conversation, then its DocumentCard appears within a few seconds, with no chat switch.
- [x] Given a plain browser (dev / e2e), then Download falls back to a normal browser download.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| WKWebView can't render blob-PDF in an iframe | Use pdf.js canvas instead — renders the same bytes |
| WKWebView ignores `<a download>` | Use native dialog + fs write in Tauri |
| User cancels the Save dialog | `{ saved: false }`, no write, no toast |
| Fetch or disk write fails | Error toast; logged via `logger` |
| Filename has no extension | Save dialog shows no type filter (any type allowed) |
| Background episode SSE stream drops mid-generation | Polling of the open-episode query still observes completion and refetches messages |
| Long PDF (dozens of pages) | Pages render lazily as they scroll near the viewport (kept light) |
| PDF bytes corrupt / unreadable | Viewer shows "Couldn't render this PDF." |

## 6. Out of Scope

- In-viewer zoom / rotate controls, print, and annotation.
- Server-side change to dedupe or validate generated PDFs.

## 7. Open Questions

- [ ] None outstanding for desktop. Web-app parity is tracked separately.

---

_Link to Technical Spec: [technical/pdf-view-download-surface.md](../technical/pdf-view-download-surface.md)_
