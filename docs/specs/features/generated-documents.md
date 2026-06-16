# Feature Spec: Generated Documents (create_pdf cards + reader)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-10
> **Last Updated**: 2026-06-10

---

## 1. Overview

When the assistant generates a document (the backend `create_pdf_short` /
`create_pdf_long` tools attach a PDF to the assistant message), the chat now
surfaces it as a prominent **document card** — a full-width row with a file icon,
the title, a "Document · PDF" label, and a **Download** button — instead of a
small generic attachment chip. Clicking the card opens the document in the
existing attachment viewer. The raw `create_pdf` tool-call badge is suppressed,
since the card is the intended representation. Port of the web app's
`DocumentCard`.

Before this, generated PDFs (already plumbed onto assistant messages) rendered as
a tiny `AttachmentChip`, and the `create_pdf` tool showed a raw-JSON tool badge.

## 2. Goals & Non-Goals

**Goals**
- [x] Render assistant-generated documents as a prominent, clickable card.
- [x] Open a document in the viewer (image/PDF inline; else download).
- [x] Download a document directly from the card.
- [x] Suppress the `create_pdf_short` / `create_pdf_long` tool-call badges.
- [x] Handle expired documents gracefully.
- [x] Surface an **async `create_pdf_long`** document live — it acks instantly
  and generates in a background episode, then posts back as a later assistant
  turn; the chat auto-attaches to that episode's stream so the card appears with
  no manual reload, showing a "Generating your document…" label meanwhile
  (CF-005 / pragna2-tracker TD-030).

**Non-Goals**
- A dedicated split-view "canvas" reader pane (the desktop reuses its existing
  full-screen `AttachmentViewer` — see `docs/web-app-parity.md`).
- Per-section ("section i of N") progress text for `create_pdf_long` beyond the
  single "Generating your document…" label (the underlying `on_progress`
  events feed the thinking-strip, but a richer progress UI is out of scope).

## 3. User Flow

- The assistant replies and a document card appears beneath the message.
- Clicking the card's title opens the document in the viewer.
- Clicking **Download** saves the file (drops nothing — uses the fetched bytes).
- An expired document shows "[expired] <name>" and is non-interactive.

## 4. Acceptance Criteria

- [x] Assistant attachments render as `DocumentCard`s (user uploads stay chips).
- [x] The title drops a trailing `.pdf`; the label reads "Document · PDF" for
      PDFs, "Document · Document" otherwise.
- [x] Clicking the title calls the open handler with the attachment.
- [x] Download fetches the bytes via `attachmentService.fetchContent` and saves.
- [x] `create_pdf_short` / `create_pdf_long` tool badges do not render.
- [x] A non-document tool call still renders its normal badge.
- [x] Expired: "[expired]" prefix; open + download disabled.

## 5. Edge Cases

- **Download failure**: logged via `logger.fromError`; the button re-enables.
- **No open handler**: the title region is non-interactive (download still works).
- **Non-PDF document**: labelled generically and still downloadable.

## 6. Responsive Design

The card is full-width (`w-full`) with a truncating title and a fixed-size
Download button; it adapts from the narrowest chat column to wide displays
without overflow.
