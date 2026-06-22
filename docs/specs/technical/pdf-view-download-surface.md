# Technical Spec: Reliable PDF viewing, downloading & auto-surfacing

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-22
> **Last Updated**: 2026-06-22

---

## 1. Overview

Three independent fixes restore PDF usability on the desktop app, none of which
touch the backend (verified healthy — it produced a valid 41-page PDF and served
`/attachments/{id}/content` with 200 OK throughout the failing session):

1. **Viewer** — replace the blank-in-WKWebView `<iframe src="blob:…">` with a
   pdf.js (`pdfjs-dist`) canvas renderer.
2. **Download** — replace the no-op `<a download>` blob anchor with a
   platform-aware save: native dialog + fs write in Tauri, blob-anchor in the
   browser.
3. **Auto-surface** — poll the open-episode query while a background document
   episode is `active`, and refetch messages on its `active → terminal`
   transition, so the card appears without a manual chat switch.

## 2. Architecture & Layer Placement

- **Domain**: unchanged.
- **Application/Ports**: unchanged (still `IAttachmentRepository.fetchContent`).
- **Infrastructure / Platform**: new `saveBytes` in `infrastructure/platform/`
  (the only place allowed to call OS/Tauri save APIs); new pdf.js config module
  in `infrastructure/pdf/`.
- **Adapters / Presentation**: new `PdfCanvasViewer` component (lazy-loaded),
  reworked `AttachmentViewer` + `DocumentCard`, new `useSurfaceFinishedEpisode`
  hook, polling added to `useOpenEpisode`.
- **Rust (src-tauri)**: register `tauri-plugin-dialog` + `tauri-plugin-fs`; grant
  `dialog:allow-save` + `fs:allow-write-file` capabilities.

## 3. Data Flow

```
View PDF:
  AttachmentViewer -> useAttachmentBlob.fetchContent() -> Blob
    -> <Suspense><PdfCanvasViewer blob/> -> pdfjs.getDocument({data}) -> page.render({canvas,viewport})

Download:
  DocumentCard / AttachmentViewer -> fetchContent() -> Blob
    -> platform.saveBytes(blob, filename)
       -> Tauri:   dialog.save() -> fs.writeFile(path, bytes)   (auto-scoped path)
       -> Browser: downloadBlob(blob, filename)                 (blob anchor)

Auto-surface (create_pdf_long):
  useOpenEpisode (refetchInterval while status==='active')
    -> on active -> null transition: useSurfaceFinishedEpisode
       -> invalidate ['conversations', id, 'messages'] + conversation list
       -> DocumentCard renders from refreshed messages
```

## 4. Module & File Layout

```
src/
  infrastructure/
    platform/
      saveFile.ts            # saveBytes() — native Save As / browser fallback
      saveFile.test.ts
      index.ts               # re-exports saveBytes
    pdf/
      pdfjs.ts               # GlobalWorkerOptions.workerSrc + getDocument re-export
  constants/
    episodes.ts              # OPEN_EPISODE_ACTIVE_POLL_MS
  presentation/
    hooks/episodes/useEpisodes.ts          # + refetchInterval while active
    views/chat/
      components/
        PdfCanvasViewer.tsx  # lazy canvas renderer (lazy/lazy pages)
        AttachmentViewer.tsx # canvas view + native-save buttons
        DocumentCard.tsx     # native-save download + toast
      hooks/
        useAttachmentBlob.ts          # now also returns the raw Blob
        useSurfaceFinishedEpisode.ts  # refetch messages on episode close
        useSurfaceFinishedEpisode.test.tsx
src-tauri/
  Cargo.toml                 # + tauri-plugin-dialog, tauri-plugin-fs
  src/lib.rs                 # + .plugin(dialog), .plugin(fs)
  capabilities/default.json  # + dialog:allow-save, fs:allow-write-file
```

## 5. Method Specifications

### `infrastructure/platform/saveFile.ts`

#### `saveBytes(blob: Blob, filename: string) -> Promise<SaveOutcome>`

| Field | Detail |
|-------|--------|
| **Purpose** | Save bytes to disk, choosing transport by runtime (single responsibility: persistence transport). |
| **Inputs** | `blob` — file bytes; `filename` — suggested name + dialog default. |
| **Output** | `{ saved: boolean; path?: string }` — `saved:false` only on dialog cancel. |
| **Errors** | Re-throws dialog/write/transport errors (never swallowed) so callers can toast. |
| **Side Effects** | Tauri: shows native dialog + writes file. Browser: triggers blob-anchor download. |
| **Invariants** | Tauri path uses `dialog.save()` (auto-scopes path) then `fs.writeFile`; gated on `isTauriRuntime()`, not OS. |

### `infrastructure/pdf/pdfjs.ts`

#### `getDocument` (re-export) + module side effect

| Field | Detail |
|-------|--------|
| **Purpose** | Single config point: set `GlobalWorkerOptions.workerSrc` (bundled via Vite `?url`) before first `getDocument`. |
| **Side Effects** | Assigns the worker URL at module load. |
| **Invariants** | Importing `getDocument` from here guarantees the worker is configured first. |

### `presentation/views/chat/hooks/useSurfaceFinishedEpisode.ts`

#### `useSurfaceFinishedEpisode(episode, conversationId) -> void`

| Field | Detail |
|-------|--------|
| **Purpose** | Refetch messages + conversation list when the open episode leaves `active`. |
| **Inputs** | `episode: EpisodeSnapshot \| null` (open-episode query data); `conversationId`. |
| **Output** | None. |
| **Side Effects** | `invalidateQueries(['conversations', id, 'messages'])` + `invalidateConversationListQueries`. |
| **Invariants** | Fires only on `wasActive && !isActive`; no-op when `conversationId` undefined. |

### `presentation/hooks/episodes/useEpisodes.ts` — `useOpenEpisode`

| Field | Detail |
|-------|--------|
| **Change** | Added `refetchInterval: q => q.state.data?.status === 'active' ? OPEN_EPISODE_ACTIVE_POLL_MS : false`. |
| **Invariant** | Polls only while a background episode is generating; idle/paused/absent → no polling. |

## 6. Error Handling Strategy

| Error | Layer | Propagation |
|-------|-------|------------|
| Dialog/fs write failure | Platform | Thrown from `saveBytes`; caller toasts + `logger.fromError`. |
| Fetch (`fetchContent`) failure | Infra/Adapter | Caught in card/viewer handler → error toast. |
| pdf.js load/render failure | Presentation | Caught in `PdfCanvasViewer` → "Couldn't render this PDF." + `logger`. |
| Dialog cancelled | Platform | `{ saved: false }` — not an error; silent. |

## 7. Configuration & Constants

| Constant | Source | Description |
|----------|--------|-------------|
| `OPEN_EPISODE_ACTIVE_POLL_MS` | `src/constants/episodes.ts` | Poll cadence (ms) while an episode is active. |
| `DEFAULT_PAGE_ASPECT_RATIO` | `PdfCanvasViewer.tsx` | US-Letter ratio placeholder before real page dims load (math constant). |
| `PAGE_RENDER_ROOT_MARGIN_PX` | `PdfCanvasViewer.tsx` | Lazy-render lookahead margin. |
| Save dialog filter | derived | Built from the filename extension (no hardcoded format). |
| Worker URL | Vite `?url` import | `pdfjs-dist/build/pdf.worker.min.mjs` bundled, offline. |
| Plugin capabilities | `capabilities/default.json` | `dialog:allow-save`, `fs:allow-write-file`. |

## 8. Testing Plan

| Test | Type | What It Verifies |
|------|------|-----------------|
| `saveFile.test.ts` | unit | Browser fallback calls `downloadBlob`; Tauri path calls `save`+`writeFile`; cancel → `{saved:false}`; extension-less filter; write error propagates. |
| `useSurfaceFinishedEpisode.test.tsx` | unit | Refetch on `active → null`; no refetch while active, on `null → null`, or with undefined conversationId. |
| `AttachmentViewer.test.tsx` | component | PDF routes through the canvas viewer (no iframe); native-save button calls `saveBytes`. |
| `DocumentCard.test.tsx` | component | Download fetches bytes then saves. |
| Full FE suite + `pnpm build` + `cargo check` + `lint:platform` | build/CI | Type/lint/compile gates pass; pdf.js worker bundles; Rust plugins compile. |

## 9. Dependencies & External Integrations

- New npm: `pdfjs-dist`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`.
- New crates: `tauri-plugin-dialog`, `tauri-plugin-fs`.
- pdf.js viewer is `React.lazy`-loaded so the heavy bundle is code-split out of
  the main chunk and the synchronous module graph (keeps tests + startup light).
- CSP is `null` (permissive) in `tauri.conf.json`, so the pdf.js worker blob
  needs no CSP change.

## 10. Open Questions / Risks

- **Visual confirmation in WKWebView** is required (canvas rendering is
  universally supported in WKWebView, unlike blob-iframe PDFs, so this is
  well-founded but should be eyeballed in `pnpm tauri dev`).
- Web-app (`pragna2_sgummalla_works`) shares this architecture and very likely
  has all three bugs — tracked for the web-fe session (see `docs/CODE_FIXES.md`).

---

_Link to Feature Spec: [features/pdf-view-download-surface.md](../features/pdf-view-download-surface.md)_
