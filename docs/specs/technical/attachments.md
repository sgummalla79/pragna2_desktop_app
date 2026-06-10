# Technical Spec: Chat Attachments + Viewer

> **Status**: Implemented (session view). Landing uploads deferred.
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Architecture

Clean-Architecture data layer + a composer/viewer surface, plus one transport
prerequisite. Attachments are uploaded standalone, then associated with a turn by
passing their ids in `forwardedProps.attachment_ids` on the chat run — the same
side-channel slash/HITL use. The backend resolves the ids into multimodal content
and links them to the persisted user message.

```
pick → useUploadAttachment → POST /api/conversations/{id}/attachments (multipart)
     → staged chip (id held in ChatInput) → send(text, attachmentIds)
     → useChatSession.send → agent.runAgent({ forwardedProps: { attachment_ids } })
persisted turn → message.attachments[] → AttachmentChip → AttachmentViewer
     → useAttachmentBlob → GET /api/attachments/{id}/content (blob) → object URL
```

## 2. Transport prerequisite (the de-risked change)

The native HTTP adapter (`tauriHttpAdapter.ts`) previously handled only
`text`/`json` `responseType` — a `blob` request would have been JSON-parsed and
corrupted. Added **`blob`** + **`arraybuffer`** handling (reads `res.blob()` /
`res.arrayBuffer()`). Required because the content endpoint needs a Bearer header,
so a bare `<img>`/`<iframe src>` 401s — all attachment bytes are fetched via the
authenticated client and turned into an object URL.

## 3. Data layer

- **`domain/types/attachment.types.ts`** — `Attachment { id, conversationId,
  messageId, filename, contentType, sizeBytes, uploadedAt, expired }`.
- **`IAttachmentRepository`** — `upload(conversationId, file): Promise<Attachment>`,
  `fetchContent(attachmentId): Promise<Blob>`.
- **`AttachmentRepository`** — `upload` POSTs multipart `FormData` (field `file`)
  to `/conversations/{id}/attachments` (the native adapter strips the JSON
  Content-Type for FormData so the transport sets the boundary — same as Knowledge
  uploads; no manual Content-Type). `fetchContent` GETs `/attachments/{id}/content`
  with `responseType: 'blob'`.
- **`mapAttachment`** (snake→camel) — also consumed by `mapConversation`'s
  `mapMessage` (messages now map their `attachments[]`; previously ignored).
- **`AttachmentService`** (thin) → DI as `attachmentService`.
- **`useUploadAttachment`** — mutation (no cache; result held in composer state).
- **`constants/attachments.ts`** — `ATTACHMENT_ACCEPT`, `ATTACHMENT_MAX_BYTES`
  (10 MB), `isImageType`/`isPdfType`. Externalised per the no-hardcoding rule.
- **Errors:** `ATT_001` upload, `ATT_002` content load, `ATT_003` unsupported.

## 4. Composer (`ChatInput`)

New `conversationId?` prop gates the feature (only an open conversation can
upload). `onSubmit` now passes `attachmentIds: string[]`. Internal
`PendingAttachment[]` staging: `stageFiles` validates size, makes an image
object-URL preview, uploads via `useUploadAttachment`, and flips the chip to
ready/errored. `canSend` also requires no upload in flight. `doSubmit` passes the
ready ids and clears staging (revoking object URLs; also revoked on remove +
unmount). `AttachmentChip` renders the staged chips (preview/icon, spinner, ✕).

## 5. Dispatch (`useChatSession`)

`send(text, attachmentIds?)` → `agent.runAgent(attachmentIds?.length ?
{ forwardedProps: { attachment_ids } } : undefined)`. (Slash dispatch + HITL are
unaffected — slash still rewrites the URL; episodes use `runRaw`.)

## 6. Persisted render + viewer

- `mapConversation.mapMessage` maps `attachments[]`; `PersistedMessage.attachments`
  added. `ChatSessionView` builds `attachmentsByMessageId` and passes
  `attachments` + `onOpenAttachment` to each `ChatMessage`.
- `ChatMessage` renders `AttachmentChip`s (right-aligned above the user bubble;
  below assistant content); clicking opens the viewer.
- `AttachmentViewer` (view-level overlay; one instance, `viewingAttachment`
  state in `ChatSessionView`) uses **`useAttachmentBlob`** (authed fetch → object
  URL, revoked on change/unmount) → `<img>` (image) / `<iframe src=#toolbar=0>`
  (PDF) / download link (other). Esc + backdrop close.

## 7. Deferred / live-verify

- **Deferred:** landing uploads (no conversation row yet); drag-and-drop;
  persisted-image inline thumbnails; client capability gating.
- **Live-verify (needs desktop + backend):** multipart upload through the native
  adapter (`TD-004`), blob GET through the adapter, PDF in the webview `<iframe>`
  via blob URL. If blob-in-iframe fails in the packaged webview, fall back to a
  Tauri temp-file + `convertFileSrc`.
