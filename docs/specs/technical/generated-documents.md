# Technical Spec: Generated Documents (create_pdf cards + reader)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-10
> **Last Updated**: 2026-06-10

Related feature spec: `docs/specs/features/generated-documents.md`.

---

## 1. Architecture

Purely presentational, riding the data path that already exists: `mapMessage`
maps `attachments[]` onto persisted messages, and `ChatSessionView` already
passes `attachmentsByMessageId` + `onOpenAttachment` (→ `AttachmentViewer`) into
`ChatMessage`. This feature changes only how an **assistant** message's
attachments render (card vs. chip) and suppresses the document-tool badges. No
new hook, service, port, or backend contract.

```
ChatMessage (assistant)
  ├─ toolCalls.map → suppress DOCUMENT_TOOL_NAMES badges
  └─ attachments.map → <DocumentCard onOpen={onOpenAttachment} />
                          ├─ title region → onOpenAttachment → AttachmentViewer (existing)
                          └─ Download → attachmentService.fetchContent → downloadBlob()
```

## 2. Files

| File | Change |
|---|---|
| `src/constants/documentTools.ts` | **New.** `CREATE_PDF_SHORT_TOOL_NAME`, `CREATE_PDF_LONG_TOOL_NAME`, `DOCUMENT_TOOL_NAMES`. |
| `src/lib/download.ts` | **New.** `downloadBlob(blob, filename)` — object-URL + anchor + revoke. |
| `src/presentation/views/chat/components/DocumentCard.tsx` | **New.** The document card. |
| `src/presentation/views/chat/components/ChatMessage.tsx` | Suppress document-tool badges; render assistant attachments as `DocumentCard`s (was `AttachmentChip`s). User uploads still render as chips. |
| `*.test.ts(x)` | `download` (1), `DocumentCard` (5), `ChatMessage.documents` (3). |

## 3. Document-tool suppression

In the tool-call map, `if (DOCUMENT_TOOL_NAMES.has(call.name)) return null;`
runs before the proposal/badge branches — so a `create_pdf_short` /
`create_pdf_long` call never renders a `ToolCallBadge`; the `DocumentCard` (from
the message's attachment) is the representation. Mirrors the web app and the
backend `TOOL_CREATE_PDF_*` names.

## 3b. Async create_pdf_long surfacing (CF-005 / TD-030)

`create_pdf_long` acks instantly and generates the document in a **background
episode** (`seed_summary = LONG_PDF_EPISODE_SENTINEL = 'long_pdf'`), posting it
back as a later assistant turn + PDF. The chat surfaces it without a reload via:

```
ack run settles → useRefetchOpenEpisodeOnSettle invalidates the open-episode query
  → useOpenEpisode returns the active long_pdf episode
  → ChatSessionView auto-attach effect → useChatSession.attach(cid, eid)
      (agent.url := POST /api/conversations/{cid}/episodes/{eid}/stream; runAgent({}))
  → episode stream replays + streams live events through the agent subscriber chain
  → onRunFinalized refetches /messages
  → ChatSessionView reconciles in-memory→persisted via replaceMessages
      (streamed stream-id message → persisted BE-UUID, so attachmentsByMessageId resolves)
  → DocumentCard renders. "Generating your document…" label shows while attached.
```

Event-driven (NOT polling). Full write-up + the reconciliation rationale:
`docs/CODE_FIXES.md` CF-005. New units: `useEpisodes`, `useRefetchOpenEpisodeOnSettle`.

## 4. DocumentCard contract

```ts
interface DocumentCardProps {
  attachment: Attachment;
  onOpen?: (attachment: Attachment) => void;  // → AttachmentViewer
}
```

- Title = `filename` without a trailing `.pdf`; label = `Document · PDF`
  (`isPdfType`) else `Document · Document`.
- Download: `attachmentService.fetchContent(id)` → `downloadBlob(blob, filename)`;
  guarded by `expired`/`downloading`; failures logged, button re-enabled.
- Expired: `[expired]` prefix; open + download disabled.

## 5. Reuse vs. the web app

- **Reader.** The web app opens documents in a dedicated `PdfCanvas` slide-over
  driven by a `uiStore.openPdfDocument` action; the desktop reuses its existing
  full-screen **`AttachmentViewer`** (PDF in an `<iframe>` via `useAttachmentBlob`)
  — so no `PdfCanvas` / `usePdfDocument` are added (the desktop's
  `useAttachmentBlob` is the equivalent of the web app's `usePdfDocument`).
- **Download.** Factored into `src/lib/download.ts` (the web app has
  `src/lib/download.ts` too) for reuse + testability.

## 6. No-hardcoding / error handling

- Tool names live in `constants/documentTools.ts`; PDF detection uses the shared
  `isPdfType`. No inlined literals in logic.
- Download wraps `fetchContent` in try/catch/finally; `downloadBlob` revokes the
  object URL in `finally` so blobs never leak.

## 7. Testing

- **`download.test.ts`**: object URL created, anchor `download`/`href` set,
  clicked, URL revoked, anchor removed.
- **`DocumentCard.test.tsx`**: title without `.pdf`, PDF vs. generic label, open
  handler, download via `fetchContent`, expired disables + `[expired]` prefix.
- **`ChatMessage.documents.test.tsx`**: assistant attachment → `DocumentCard`;
  `create_pdf_short` badge suppressed (card still shows); non-document tool badge
  still renders.

## 8. Deviations from the web app

- **Reader is the full-screen `AttachmentViewer`, not a slide-over `PdfCanvas`**;
  no `uiStore.openPdfDocument` / `usePdfDocument` added (reuse `useAttachmentBlob`).
  Recorded in `docs/web-app-parity.md`.
- **`create_pdf_long` background-episode progress** (placeholder + live streaming)
  is not ported — the long document still surfaces as a card once attached.
