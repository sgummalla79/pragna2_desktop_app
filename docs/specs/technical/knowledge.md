# Technical Spec: Knowledge (Settings)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Overview

The Knowledge feature is a frontend-only TypeScript implementation layered over the pragna backend's `/api/knowledge-libraries` endpoints, organised as Clean Architecture. A domain types module defines camelCase shapes; an application port (`IKnowledgeRepository`) and a thin pass-through service (`KnowledgeService`) sit above an axios-backed repository (`KnowledgeRepository`) that translates camelCase ↔ snake_case via boundary mappers. TanStack Query hooks expose the service to React, owning cache keys and invalidation. The presentation layer renders the page, the per-library cards, and the documents manager. File uploads post `FormData` straight through axios as the request body without a caller-set `Content-Type`; the desktop's native-HTTP axios adapter strips any JSON `Content-Type` for `FormData` so the transport generates the multipart boundary itself.

## 2. Architecture & Layer Placement

- **Domain**: `src/domain/types/knowledge.types.ts` — entity/value shapes (`KnowledgeLibrary`, `KnowledgeSource`), lifecycle status unions (`KnowledgeLibraryStatus`, `KnowledgeSourceStatus`), and request payload shapes (`CreateLibraryPayload`, `IngestSourcePayload`, `UploadSourcePayload`). `src/domain/utils/slugify.ts` — a pure helper. No outward dependencies.
- **Application**: `src/application/ports/IKnowledgeRepository.ts` — the repository port (abstraction). `src/application/services/KnowledgeService.ts` — a use-case-level service that depends only on the port.
- **Adapters / Infrastructure**:
  - `src/infrastructure/repositories/KnowledgeRepository.ts` — concrete `IKnowledgeRepository` over an injected `AxiosInstance`.
  - `src/infrastructure/repositories/mappers/mapKnowledge.ts` — snake_case API shapes + boundary mappers.
  - `src/infrastructure/http/tauriHttpAdapter.ts` — the hardened native-HTTP axios adapter (shared transport; relevant to multipart upload).
- **Presentation**:
  - `src/presentation/hooks/knowledge/useKnowledgeLibraries.ts` — TanStack Query hooks + cache keys.
  - `src/presentation/views/settings/KnowledgeView/KnowledgeView.tsx` — page + inline create form.
  - `src/presentation/views/settings/KnowledgeView/KnowledgeLibraryCard.tsx` — one expandable library card + archive action.
  - `src/presentation/components/knowledge/LibraryDocumentsManager.tsx` — documents list + add-document form (paste/upload).
  - `src/constants/errors.ts` — `KNW_001`..`KNW_007` catalog entries.

## 3. Data Flow

```
[KnowledgeView / Card / DocumentsManager]
  -> [useQuery / useMutation hook]
    -> [KnowledgeService.method()]
      -> [IKnowledgeRepository.method()]   (port)
        -> [KnowledgeRepository.method()]  (axios via tauriHttpAdapter)
          -> mappers (toApi* on the way out, mapKnowledge* on the way back)
            -> pragna backend /api/knowledge-libraries/*
```

On mutation success, the hook invalidates the relevant TanStack Query key, which re-runs the corresponding `useQuery`.

## 4. Module & File Layout

```
src/
  domain/
    types/
      knowledge.types.ts          ← KnowledgeLibrary, KnowledgeSource, status unions, payloads
    utils/
      slugify.ts                  ← slugify(value)
  application/
    ports/
      IKnowledgeRepository.ts     ← repository port (abstraction)
    services/
      KnowledgeService.ts         ← pass-through use-case service
  infrastructure/
    repositories/
      KnowledgeRepository.ts      ← axios-backed IKnowledgeRepository
      mappers/
        mapKnowledge.ts           ← snake_case API shapes + boundary mappers
    http/
      tauriHttpAdapter.ts         ← native-HTTP axios adapter (shared; multipart handling)
  presentation/
    hooks/
      knowledge/
        useKnowledgeLibraries.ts  ← query/mutation hooks + cache keys
    views/
      settings/
        KnowledgeView/
          KnowledgeView.tsx       ← page + CreateLibraryForm
          KnowledgeLibraryCard.tsx← expandable card + archive
    components/
      knowledge/
        LibraryDocumentsManager.tsx ← documents list + AddDocumentForm
  constants/
    errors.ts                     ← KNW_001..KNW_007
```

## 5. Method Specifications

### `KnowledgeService` (`src/application/services/KnowledgeService.ts`)

Constructed with `(repo: IKnowledgeRepository)`. Every method is a thin pass-through to the port.

#### `listLibraries() -> Promise<KnowledgeLibrary[]>`

| Field | Detail |
|---|---|
| **Purpose** | Return the user's active knowledge libraries. |
| **Inputs** | None. |
| **Output** | `Promise<KnowledgeLibrary[]>` — mapped domain libraries. |
| **Errors** | Propagates the repository's axios error (rejected promise). |
| **Side Effects** | None (GET). |
| **Invariants** | Delegates verbatim to `repo.listLibraries()`. |

#### `createLibrary(payload: CreateLibraryPayload) -> Promise<KnowledgeLibrary>`

| Field | Detail |
|---|---|
| **Purpose** | Create a library; the embedding model is pinned by the backend, not supplied by the client. |
| **Inputs** | `payload: CreateLibraryPayload` (`slug`, `name`, optional `description`). |
| **Output** | `Promise<KnowledgeLibrary>` — the created library. |
| **Errors** | Propagates the repository's axios error (e.g. duplicate slug → 409). |
| **Side Effects** | None at this layer (POST happens in the repository). |
| **Invariants** | Delegates to `repo.createLibrary(payload)`. |

#### `archiveLibrary(id: string) -> Promise<void>`

| Field | Detail |
|---|---|
| **Purpose** | Archive (soft-delete) a library; frees the slug and cascades sources + chunks. |
| **Inputs** | `id: string` — library UUID. |
| **Output** | `Promise<void>`. |
| **Errors** | Propagates the repository's axios error. |
| **Side Effects** | None at this layer. |
| **Invariants** | Delegates to `repo.archiveLibrary(id)`. |

#### `listSources(libraryId: string) -> Promise<KnowledgeSource[]>`

| Field | Detail |
|---|---|
| **Purpose** | List one library's documents (metadata only — never the text). |
| **Inputs** | `libraryId: string`. |
| **Output** | `Promise<KnowledgeSource[]>`. |
| **Errors** | Propagates the repository's axios error. |
| **Side Effects** | None (GET). |
| **Invariants** | Delegates to `repo.listSources(libraryId)`. |

#### `ingestSource(libraryId: string, payload: IngestSourcePayload) -> Promise<KnowledgeSource>`

| Field | Detail |
|---|---|
| **Purpose** | Ingest a document body — pasted text OR an existing attachment id. |
| **Inputs** | `libraryId: string`; `payload: IngestSourcePayload` (`slug`, `displayName`, optional `summary`, and exactly one of `text` / `attachmentId`). |
| **Output** | `Promise<KnowledgeSource>`. |
| **Errors** | Propagates the repository's axios error. |
| **Side Effects** | None at this layer. |
| **Invariants** | Delegates to `repo.ingestSource(libraryId, payload)`. (The UI only sends `text`; `attachmentId` is supported by the type but unused by the current page.) |

#### `uploadSource(libraryId: string, payload: UploadSourcePayload) -> Promise<KnowledgeSource>`

| Field | Detail |
|---|---|
| **Purpose** | Upload a document file; the backend extracts its text, then stores + embeds it. |
| **Inputs** | `libraryId: string`; `payload: UploadSourcePayload` (`slug`, `displayName`, optional `summary`, `file: File`). |
| **Output** | `Promise<KnowledgeSource>`. |
| **Errors** | Propagates the repository's axios error (e.g. 415 unsupported type). |
| **Side Effects** | None at this layer (multipart POST in the repository). |
| **Invariants** | Delegates to `repo.uploadSource(libraryId, payload)`. |

#### `deleteSource(libraryId: string, sourceId: string) -> Promise<void>`

| Field | Detail |
|---|---|
| **Purpose** | Delete a document from a library (cascades its chunks). |
| **Inputs** | `libraryId: string`; `sourceId: string`. |
| **Output** | `Promise<void>`. |
| **Errors** | Propagates the repository's axios error. |
| **Side Effects** | None at this layer. |
| **Invariants** | Delegates to `repo.deleteSource(libraryId, sourceId)`. |

### `IKnowledgeRepository` (`src/application/ports/IKnowledgeRepository.ts`)

The port abstraction. Same seven method signatures as `KnowledgeService`, each documented with its endpoint mapping:

| Method | Endpoint |
|---|---|
| `listLibraries(): Promise<KnowledgeLibrary[]>` | `GET /api/knowledge-libraries` |
| `createLibrary(payload: CreateLibraryPayload): Promise<KnowledgeLibrary>` | `POST /api/knowledge-libraries` |
| `archiveLibrary(id: string): Promise<void>` | `DELETE /api/knowledge-libraries/{id}` (204) |
| `listSources(libraryId: string): Promise<KnowledgeSource[]>` | `GET /api/knowledge-libraries/{id}/sources` |
| `ingestSource(libraryId, payload: IngestSourcePayload): Promise<KnowledgeSource>` | `POST /api/knowledge-libraries/{id}/sources` |
| `uploadSource(libraryId, payload: UploadSourcePayload): Promise<KnowledgeSource>` | `POST /api/knowledge-libraries/{id}/sources/upload` (multipart) |
| `deleteSource(libraryId, sourceId): Promise<void>` | `DELETE /api/knowledge-libraries/{id}/sources/{sourceId}` (204) |

| Field | Detail |
|---|---|
| **Purpose** | Define the data-access contract the application layer depends on (Dependency Inversion). |
| **Inputs / Output** | As per the signatures above. Paths use a `/knowledge-libraries` prefix; the `/api` base is the axios instance's `baseURL`. |
| **Errors** | Implementations reject with the transport's error (axios `AxiosError`). |
| **Side Effects** | Network I/O in the implementation, not the interface. |
| **Invariants** | Any conforming implementation is substitutable (Liskov); the axios-backed `KnowledgeRepository` is the shipped one. |

### `KnowledgeRepository` (`src/infrastructure/repositories/KnowledgeRepository.ts`)

Constructed with `(http: AxiosInstance)`. Implements `IKnowledgeRepository`. Request paths are relative (`/knowledge-libraries...`); the `/api` portion is the injected instance's `baseURL`.

#### `listLibraries()`

| Field | Detail |
|---|---|
| **Purpose** | `GET /knowledge-libraries`, map each row to a domain `KnowledgeLibrary`. |
| **Inputs** | None. |
| **Output** | `Promise<KnowledgeLibrary[]>` via `data.map(mapKnowledgeLibrary)`. |
| **Errors** | Axios error on non-2xx / network failure. |
| **Side Effects** | HTTP GET. |
| **Invariants** | Returns one domain object per API row. |

#### `createLibrary(payload)`

| Field | Detail |
|---|---|
| **Purpose** | `POST /knowledge-libraries` with `toApiCreateLibraryPayload(payload)`; map the response. |
| **Inputs** | `payload: CreateLibraryPayload`. |
| **Output** | `Promise<KnowledgeLibrary>` via `mapKnowledgeLibrary(data)`. |
| **Errors** | Axios error (e.g. 409 duplicate slug, 422 validation). |
| **Side Effects** | HTTP POST (JSON body). |
| **Invariants** | Body is snake_case; `description` is omitted when `undefined`. |

#### `archiveLibrary(id)`

| Field | Detail |
|---|---|
| **Purpose** | `DELETE /knowledge-libraries/{id}`. |
| **Inputs** | `id: string`. |
| **Output** | `Promise<void>` (response body ignored). |
| **Errors** | Axios error on non-2xx. |
| **Side Effects** | HTTP DELETE. |
| **Invariants** | Backend treats delete as archive (soft-delete, 204). |

#### `listSources(libraryId)`

| Field | Detail |
|---|---|
| **Purpose** | `GET /knowledge-libraries/{libraryId}/sources`; map each row. |
| **Inputs** | `libraryId: string`. |
| **Output** | `Promise<KnowledgeSource[]>` via `data.map(mapKnowledgeSource)`. |
| **Errors** | Axios error on non-2xx / network failure. |
| **Side Effects** | HTTP GET. |
| **Invariants** | Returns metadata only (text never present in the response shape). |

#### `ingestSource(libraryId, payload)`

| Field | Detail |
|---|---|
| **Purpose** | `POST /knowledge-libraries/{libraryId}/sources` with `toApiIngestSourcePayload(payload)`; map the response. |
| **Inputs** | `libraryId: string`; `payload: IngestSourcePayload`. |
| **Output** | `Promise<KnowledgeSource>` via `mapKnowledgeSource(data)`. |
| **Errors** | Axios error (e.g. 409 duplicate slug, 422 validation). |
| **Side Effects** | HTTP POST (JSON body). |
| **Invariants** | Body is snake_case; `summary` / `text` / `attachment_id` omitted when `undefined`. |

#### `uploadSource(libraryId, payload)`

| Field | Detail |
|---|---|
| **Purpose** | `POST /knowledge-libraries/{libraryId}/sources/upload` as multipart; map the response. |
| **Inputs** | `libraryId: string`; `payload: UploadSourcePayload`. |
| **Output** | `Promise<KnowledgeSource>` via `mapKnowledgeSource(data)`. |
| **Errors** | Axios error (e.g. 415 unsupported type, 413 too large, 422 validation). |
| **Side Effects** | HTTP POST (multipart/form-data body). |
| **Invariants** | Builds a `FormData` with fields `slug`, `display_name`, optional `summary`, and `file` (the `File`), then passes the `FormData` straight through as the axios body. **No `Content-Type` is set by the repository.** The native-HTTP adapter strips any caller/transformer-set JSON `Content-Type` for `FormData` bodies so the HTTP plugin generates the `multipart/form-data; boundary=…` header itself. See §9 and pragna2-tracker TD-004. |

#### `deleteSource(libraryId, sourceId)`

| Field | Detail |
|---|---|
| **Purpose** | `DELETE /knowledge-libraries/{libraryId}/sources/{sourceId}`. |
| **Inputs** | `libraryId: string`; `sourceId: string`. |
| **Output** | `Promise<void>` (response body ignored). |
| **Errors** | Axios error on non-2xx. |
| **Side Effects** | HTTP DELETE. |
| **Invariants** | Backend cascades the document's chunks (204). |

### Mappers (`src/infrastructure/repositories/mappers/mapKnowledge.ts`)

#### `mapKnowledgeLibrary(r: ApiKnowledgeLibraryResponse) -> KnowledgeLibrary`

| Field | Detail |
|---|---|
| **Purpose** | Translate a snake_case API library row to the camelCase domain shape. |
| **Inputs** | `r: ApiKnowledgeLibraryResponse` (`id`, `slug`, `name`, `description`, `embedding_model`, `embedding_dimensions`, `status`, `created_at`, `modified_at`). |
| **Output** | `KnowledgeLibrary` (`embeddingModel`, `embeddingDimensions`, `createdAt`, `modifiedAt`, etc.). |
| **Errors** | None (pure mapping). |
| **Side Effects** | None. |
| **Invariants** | Field-for-field rename; `description` may be `null`; `status` passes through (`active`/`archived`). |

#### `mapKnowledgeSource(r: ApiKnowledgeSourceResponse) -> KnowledgeSource`

| Field | Detail |
|---|---|
| **Purpose** | Translate a snake_case API source row to the camelCase domain shape. |
| **Inputs** | `r: ApiKnowledgeSourceResponse` (`id`, `library_id`, `slug`, `display_name`, `summary`, `token_count`, `content_hash`, `source_attachment_id`, `status`, `created_at`, `modified_at`). |
| **Output** | `KnowledgeSource` (`libraryId`, `displayName`, `tokenCount`, `contentHash`, `sourceAttachmentId`, …). |
| **Errors** | None (pure mapping). |
| **Side Effects** | None. |
| **Invariants** | Field-for-field rename; `summary` and `sourceAttachmentId` may be `null`; `status` passes through (`pending`/`ready`/`failed`). |

#### `toApiCreateLibraryPayload(p: CreateLibraryPayload) -> Record<string, unknown>`

| Field | Detail |
|---|---|
| **Purpose** | Serialise a create payload to the snake_case API body. |
| **Inputs** | `p: CreateLibraryPayload`. |
| **Output** | `{ slug, name, description? }`. |
| **Errors** | None. |
| **Side Effects** | None. |
| **Invariants** | `description` key present only when `p.description !== undefined`; embedding model is never sent (backend-pinned). |

#### `toApiIngestSourcePayload(p: IngestSourcePayload) -> Record<string, unknown>`

| Field | Detail |
|---|---|
| **Purpose** | Serialise an ingest payload to the snake_case API body. |
| **Inputs** | `p: IngestSourcePayload`. |
| **Output** | `{ slug, display_name, summary?, text?, attachment_id? }`. |
| **Errors** | None. |
| **Side Effects** | None. |
| **Invariants** | `summary`, `text`, `attachment_id` keys present only when their source field `!== undefined`. |

### `slugify` (`src/domain/utils/slugify.ts`)

#### `slugify(value: string) -> string`

| Field | Detail |
|---|---|
| **Purpose** | Produce a best-effort kebab-case slug seed from free text / a filename. |
| **Inputs** | `value: string`. |
| **Output** | Lowercased string with runs of non-`[a-z0-9]` collapsed to a single hyphen and leading/trailing hyphens trimmed. |
| **Errors** | None (pure). |
| **Side Effects** | None. |
| **Invariants** | Used only to pre-fill an editable slug field; the backend is the authority on slug validity. |

### Hooks (`src/presentation/hooks/knowledge/useKnowledgeLibraries.ts`)

Cache keys (exported):
- `KNOWLEDGE_LIBRARIES_KEY = ['knowledge-libraries']`
- `librarySourcesKey(libraryId) = ['knowledge-libraries', libraryId, 'sources']`

All hooks resolve the service via `useServices().knowledgeService`.

#### `useKnowledgeLibraries()`

| Field | Detail |
|---|---|
| **Purpose** | Query the user's libraries. |
| **Inputs** | None. |
| **Output** | `useQuery` result of `KnowledgeLibrary[]`. |
| **Errors** | Query error exposed via `isError` / `error`. |
| **Side Effects** | GET on mount/refetch; `staleTime: 30_000` ms. |
| **Invariants** | `queryKey: KNOWLEDGE_LIBRARIES_KEY`. |

#### `useCreateLibrary()`

| Field | Detail |
|---|---|
| **Purpose** | Mutation to create a library. |
| **Inputs** | `CreateLibraryPayload` (mutation variable). |
| **Output** | `useMutation<KnowledgeLibrary, Error, CreateLibraryPayload>`. |
| **Errors** | Rejects with the underlying error; caller surfaces via `messageFrom`. |
| **Side Effects** | On success, invalidates `KNOWLEDGE_LIBRARIES_KEY` (re-runs the list query). |
| **Invariants** | Does not optimistically update; relies on invalidation. |

#### `useArchiveLibrary()`

| Field | Detail |
|---|---|
| **Purpose** | Mutation to archive a library. |
| **Inputs** | `id: string` (mutation variable). |
| **Output** | `useMutation<void, Error, string>`. |
| **Errors** | Rejects with the underlying error. |
| **Side Effects** | On success, invalidates `KNOWLEDGE_LIBRARIES_KEY`. |
| **Invariants** | — |

#### `useLibrarySources(libraryId: string | null | undefined)`

| Field | Detail |
|---|---|
| **Purpose** | Query one library's documents. |
| **Inputs** | `libraryId` (nullable). |
| **Output** | `useQuery` result of `KnowledgeSource[]`. |
| **Errors** | Query error via `isError` / `error`. |
| **Side Effects** | GET when enabled; `staleTime: 30_000` ms. |
| **Invariants** | `queryKey: librarySourcesKey(libraryId ?? '')`; `enabled: !!libraryId` (disabled when falsy). |

#### `useIngestSource(libraryId: string)`

| Field | Detail |
|---|---|
| **Purpose** | Mutation to ingest a pasted-text/attachment document. |
| **Inputs** | `IngestSourcePayload` (mutation variable); `libraryId` from hook arg. |
| **Output** | `useMutation<KnowledgeSource, Error, IngestSourcePayload>`. |
| **Errors** | Rejects with the underlying error. |
| **Side Effects** | On success, invalidates `librarySourcesKey(libraryId)`. |
| **Invariants** | — |

#### `useUploadSource(libraryId: string)`

| Field | Detail |
|---|---|
| **Purpose** | Mutation to upload a document file (multipart). |
| **Inputs** | `UploadSourcePayload` (mutation variable); `libraryId` from hook arg. |
| **Output** | `useMutation<KnowledgeSource, Error, UploadSourcePayload>`. |
| **Errors** | Rejects with the underlying error. |
| **Side Effects** | On success, invalidates `librarySourcesKey(libraryId)`. |
| **Invariants** | — |

#### `useDeleteSource(libraryId: string)`

| Field | Detail |
|---|---|
| **Purpose** | Mutation to delete a document from a library. |
| **Inputs** | `sourceId: string` (mutation variable); `libraryId` from hook arg. |
| **Output** | `useMutation<void, Error, string>`. |
| **Errors** | Rejects with the underlying error. |
| **Side Effects** | On success, invalidates `librarySourcesKey(libraryId)`. |
| **Invariants** | — |

## 6. Error Handling Strategy

Transport errors surface as axios `AxiosError`s (the native-HTTP adapter constructs them: `ERR_NETWORK` on transport failure; `ERR_BAD_REQUEST` for 4xx, `ERR_BAD_RESPONSE` for 5xx, both carrying `.response`). The repository and service do not catch — errors propagate to the TanStack Query mutation/query state. The presentation components translate the error into a user-facing message via a local `messageFrom(err, fallback)` helper that prefers `err.response.data.detail` (the backend's `detail` field) and otherwise falls back to a `KNW_*` catalog message.

| Error | Layer | Propagation |
|-------|-------|------------|
| `AxiosError` (`ERR_NETWORK` / `ERR_BAD_REQUEST` / `ERR_BAD_RESPONSE`) | Infrastructure (`tauriHttpAdapter`) | Propagated unchanged through repository + service to the hook's `error` / rejected `mutateAsync`. |
| Backend `detail` string | Backend → infrastructure response body | Surfaced verbatim by `messageFrom` when present, in preference to the catalog. |
| `KNW_001` "Failed to load knowledge libraries." | Presentation (KnowledgeView) | Shown when the libraries query `isError`. |
| `KNW_002` "Failed to create the library." | Presentation (CreateLibraryForm) | Fallback when create rejects and no `detail`. |
| `KNW_003` "Failed to remove the library." | Presentation (KnowledgeLibraryCard) | Fallback when archive rejects and no `detail`. |
| `KNW_004` "Failed to load documents." | Presentation (LibraryDocumentsManager) | Shown when the sources query `isError`. |
| `KNW_005` "Failed to add the document." | Presentation (AddDocumentForm, paste-text mode) | Fallback when ingest rejects and no `detail`. |
| `KNW_006` "Failed to upload the file." | Presentation (AddDocumentForm, file mode) | Fallback when upload rejects and no `detail`. |
| `KNW_007` "Failed to delete the document." | Presentation (LibraryDocumentsManager) | Fallback when delete rejects and no `detail`. |

## 7. Configuration & Constants

| Constant | Source | Description |
|----------|--------|-------------|
| `KNOWLEDGE_FILE_ACCEPT = '.pdf,.txt,.md,.markdown,.csv,.docx,.xlsx'` | `LibraryDocumentsManager.tsx` (module constant) | Native file-picker `accept` hint; mirrors the backend's `KNOWLEDGE_INGESTIBLE_MIME_TYPES`. The backend is the real gate (415); not inlined into JSX logic. |
| `KNW_001`..`KNW_007` | `src/constants/errors.ts` | User-facing fallback messages + log-correlation codes. |
| `KNOWLEDGE_LIBRARIES_KEY`, `librarySourcesKey` | `useKnowledgeLibraries.ts` | TanStack Query cache keys (exported). |
| `staleTime: 30_000` | `useKnowledgeLibraries.ts` | Query freshness window (ms). |
| API base URL / `/api` prefix | injected `AxiosInstance.baseURL` (env/config) | Not hardcoded in the repository; repository paths are relative. |
| Embedding model | Backend (pinned at library creation) | Never sent by the client; displayed read-only. |

## 8. Testing Plan

Unit tests for the Knowledge layer are deferred under pragna2-tracker TD-003 (not yet shipped). Planned coverage:

| Test | Type | What It Verifies |
|------|------|-----------------|
| `KnowledgeRepository.listLibraries/createLibrary/archiveLibrary` | unit (mocked axios) | Correct method/path/body; mapper applied to the response. |
| `KnowledgeRepository.uploadSource` | unit (mocked axios) | Builds `FormData` with `slug`/`display_name`/`summary`/`file`; posts to `/sources/upload`; does not set `Content-Type`. |
| `mapKnowledgeLibrary` / `mapKnowledgeSource` | unit | snake_case → camelCase mapping, `null` handling. |
| `toApiCreateLibraryPayload` / `toApiIngestSourcePayload` | unit | Optional keys omitted when `undefined`. |
| `slugify` | unit | Lowercasing, non-alphanumeric collapse, hyphen trim; edge cases (empty, all-symbols). |
| `useCreateLibrary` / `useArchiveLibrary` / `useIngest/Upload/DeleteSource` | unit (mocked service + QueryClient) | Correct query-key invalidation on success. |
| `tauriHttpAdapter` multipart path | unit | Strips JSON `Content-Type` for `FormData`; passes the body through untouched. |

## 9. Dependencies & External Integrations

- **`@tanstack/react-query`** — query/mutation state, cache keys, and invalidation.
- **`axios`** — HTTP client; the instance uses the custom native-HTTP adapter (no webview `fetch`).
- **`@tauri-apps/plugin-http`** (`tauriHttpAdapter.ts`) — the hardened native-HTTP transport. Requests run in Rust (no browser CORS). Critically for upload: when the axios body is a `FormData`, the adapter detects it (`config.data instanceof FormData`), deletes any `Content-Type` header (case-insensitive) so the HTTP plugin generates the `multipart/form-data; boundary=…` itself, and passes the `FormData` straight through as `BodyInit` (axios `transformRequest` leaves `FormData` untouched). `validateStatus` is honoured so 4xx/5xx still become `AxiosError`s with `.response`.
- **Web File API + HTML5 drag-and-drop** — the add-document upload control uses a hidden `<input type="file" accept={KNOWLEDGE_FILE_ACCEPT}>` plus an `onDrop`/`onDragOver` drop zone; the dropped/selected `File` is sent as-is in the `FormData`. Drag-and-drop bypasses the `accept` filter.
- **Backend** — pragna `/api/knowledge-libraries/*` endpoints; the embedding model is pinned server-side and the source text is extracted/stored/embedded server-side.

## 10. Open Questions / Risks

- [ ] **pragna2-tracker TD-004** — The multipart upload path (FormData → native-HTTP adapter → backend) has not been verified end-to-end against the running backend from the dev environment. Risk: an undiscovered boundary/streaming issue in the packaged build. Done when a real document uploads successfully on a packaged macOS build and the source appears in the library.
- [x] **pragna2-tracker TD-005** *(Done 2026-06-09.)* `validateKnowledgeFile` (extension vs the
  accept list + size vs `KNOWLEDGE_MAX_FILE_BYTES` = 25 MB) runs in
  `LibraryDocumentsManager.handleFilePick` on **both** the picker and drag-drop
  paths; rejected files aren't accepted and show an inline message. The backend
  remains the real gate (413/415).

---

_Link to Feature Spec: [features/knowledge.md](../features/knowledge.md)_
