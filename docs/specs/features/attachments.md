# Feature Spec: Chat Attachments + Viewer

> **Status**: Implemented (session view). Landing-composer uploads deferred.
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Overview

Users can attach files (images, PDF, text/CSV/Markdown, docx/xlsx) to a chat
message. Files are uploaded ahead of send and staged as chips in the composer;
sending passes their ids to the backend, which resolves them into multimodal
content for the model. Attachments on past turns render as chips that open a
viewer — images and PDFs inline, other types as a download.

## 2. Goals & Non-Goals

**Goals**
- [ ] Attach one or more files in an open conversation (`/chat/:id`): pick →
      upload → staged chip (image preview, progress, remove).
- [ ] Block send until uploads finish; send passes `attachment_ids`.
- [ ] Render attachments on persisted user/assistant turns as chips.
- [ ] View a sent image/PDF inline (fetched authenticated); download any type.
- [ ] Client-side type (accept list) + size (10 MB) pre-checks; backend is the gate.

**Non-Goals**
- **Landing-composer uploads** (before a conversation row exists) — deferred; the
  attach button only appears in an open conversation.
- Inline thumbnails for *persisted* images in the transcript (they open in the
  viewer instead — avoids many authenticated fetches on list render).
- Editing/removing an attachment after it's been sent.
- Drag-and-drop into the composer (picker only for now).

## 3. User Flow

1. In an open chat, click the paperclip → pick file(s). Each appears as a chip
   (image thumbnail or file icon) with an upload spinner, then settles. ✕ removes.
2. Type a message and send. The send button is disabled while any upload is in
   flight. The turn is sent with the attachment ids; the model sees the content.
3. Past turns show attachment chips. Clicking one opens a full-screen viewer:
   image inline, PDF in an embedded viewer, other types offer a download. Esc /
   backdrop closes.

## 4. Acceptance Criteria

- [ ] Picking a supported file under 10 MB uploads it and shows a staged chip;
      an oversized/unsupported file shows an error chip and isn't sent.
- [ ] Send is blocked while uploads are in flight; once ready, the message sends
      with the attachment ids and the assistant responds to the content.
- [ ] A reopened conversation shows each turn's attachments as chips.
- [ ] Clicking an image/PDF chip opens it inline (authenticated fetch); other
      types offer a download; an expired attachment shows a placeholder.
- [ ] Composer + chips + viewer remain usable from narrow → wide widths.

## 5. Gating & Edge Cases

- **No conversation yet (landing):** no attach button (deferred — see Non-Goals).
- **Upload fails:** the chip flips to an error state (logged `ATT_001`); it's
  excluded from the sent ids; the user can remove + retry.
- **Content fetch fails / expired:** the viewer shows "couldn't load" / "expired"
  (logged `ATT_002`); no crash.
- **Model can't see the type:** the backend rejects with a `detail`; surfaced via
  the run error path. (Client-side capability gating is a possible follow-up.)

## 6. UI / Theming

- Theme tokens only. Paperclip attach button in the composer's control row;
  staged chips above the textarea; the viewer is a themed full-screen overlay.

## 7. Deferred / live-verify

- **Landing-composer uploads;** drag-and-drop; persisted-image inline thumbnails;
  client-side model-capability gating.
- **Live-verify (needs a desktop run + backend):** multipart upload through the
  native HTTP adapter (also pragna2-tracker TD-004), blob GET through the adapter, and PDF
  rendering in the Tauri webview `<iframe>` via a blob URL.
