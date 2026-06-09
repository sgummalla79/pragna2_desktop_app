# Technical Spec: Configuration (Settings)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Overview

The Configuration feature is implemented entirely in the frontend (React + TypeScript) following Clean Architecture. It comprises two independent concerns. The **embedding (Voyage) key** flows through all four layers: a domain type (`EmbeddingKeyStatus`), an application port (`IEmbeddingKeyRepository`) and service (`EmbeddingKeyService`), an Axios-backed infrastructure repository (`EmbeddingKeyRepository`) talking to the `/api/auth/me/embedding-key` singleton, and presentation hooks/components built on TanStack Query. The **chat-action toggles** are a presentation-only concern persisted to `localStorage` via a `useSyncExternalStore`-based hook (`useChatPreferences`) with no backend involvement.

## 2. Architecture & Layer Placement

- **Domain**: `src/domain/types/embeddingKey.types.ts` — `EmbeddingKeyStatus` value type (`{ hasVoyageKey: boolean }`). No domain errors introduced (errors are catalog entries, see §6). Chat preferences are not modeled in the domain (UI-only).
- **Application**: `src/application/ports/IEmbeddingKeyRepository.ts` (port) and `src/application/services/EmbeddingKeyService.ts` (service). The service is a thin pass-through delegating to the port; it depends only on the abstraction (DIP).
- **Infrastructure**: `src/infrastructure/repositories/EmbeddingKeyRepository.ts` — Axios implementation of the port. Maps the snake_case API shape (`has_voyage_key`) to the domain type and back (`api_key` request body).
- **Presentation**:
  - `src/presentation/views/settings/ConfigurationView/ConfigurationView.tsx` — page composed of section cards.
  - `.../EmbeddingKeySection.tsx` — set/replace/clear card.
  - `.../ChatActionsSection.tsx` — toggle card.
  - `src/presentation/hooks/embeddings/useEmbeddingKey.ts` — `useEmbeddingKeyStatus`, `useSetEmbeddingKey`, `useClearEmbeddingKey` (TanStack Query).
  - `src/presentation/hooks/preferences/useChatPreferences.ts` — `useChatPreferences` (`localStorage` + `useSyncExternalStore`).
  - The service is obtained from `useServices()` (`ServiceContext`), so components depend on the service abstraction, not a concrete repository.

## 3. Data Flow

Embedding key (status / set / clear):

```
EmbeddingKeySection
  -> useEmbeddingKeyStatus()/useSetEmbeddingKey()/useClearEmbeddingKey()
  -> EmbeddingKeyService.getStatus()/setKey(apiKey)/clearKey()
  -> IEmbeddingKeyRepository
  -> EmbeddingKeyRepository (Axios) -> GET/PUT/DELETE /api/auth/me/embedding-key
  <- { has_voyage_key } -> mapStatus -> EmbeddingKeyStatus { hasVoyageKey }
  <- TanStack Query cache (queryKey ['embedding-key'])
```

Chat preferences (read / write):

```
ChatActionsSection -> useChatPreferences()
  read:  useSyncExternalStore(subscribe, getSnapshot) -> readPrefs() <- localStorage['pragna:chat-prefs']
  write: setPref(key, value) -> writePrefs() -> localStorage.setItem + dispatch 'pragna:chat-prefs:change'
         -> subscribe handler -> re-snapshot -> all mounted hooks re-render
```

## 4. Module & File Layout

```
src/
  domain/
    types/
      embeddingKey.types.ts            # EmbeddingKeyStatus
  application/
    ports/
      IEmbeddingKeyRepository.ts       # port (getStatus/setKey/clearKey)
    services/
      EmbeddingKeyService.ts           # pass-through application service
  infrastructure/
    repositories/
      EmbeddingKeyRepository.ts        # Axios implementation
  constants/
    errors.ts                          # ERRORS.CFG_001 / CFG_002 / CFG_003
  presentation/
    hooks/
      embeddings/
        useEmbeddingKey.ts             # useEmbeddingKeyStatus/useSetEmbeddingKey/useClearEmbeddingKey
      preferences/
        useChatPreferences.ts          # useChatPreferences (localStorage)
    views/settings/ConfigurationView/
      ConfigurationView.tsx            # page composition (default export)
      EmbeddingKeySection.tsx          # embedding-key card
      ChatActionsSection.tsx           # chat-action toggles card
```

## 5. Method Specifications

### `EmbeddingKeyService`

#### `getStatus(): Promise<EmbeddingKeyStatus>`

| Field | Detail |
|---|---|
| **Purpose** | Report whether the user has a per-user embedding key set. |
| **Inputs** | None. |
| **Output** | `Promise<EmbeddingKeyStatus>` — `{ hasVoyageKey }`. |
| **Errors** | Propagates the rejection from `IEmbeddingKeyRepository.getStatus` (Axios error); not caught here. |
| **Side Effects** | None (delegates to repository). |
| **Invariants** | Pure delegation; never mutates state. |

#### `setKey(apiKey: string): Promise<EmbeddingKeyStatus>`

| Field | Detail |
|---|---|
| **Purpose** | Set or replace the user's embedding key. |
| **Inputs** | `apiKey: string` — the key value (trimmed by the caller component). |
| **Output** | `Promise<EmbeddingKeyStatus>` — new status after the server probe/save. |
| **Errors** | Propagates the repository rejection (e.g. validation/HTTP error). |
| **Side Effects** | None within the service; the repository performs the network PUT. |
| **Invariants** | Pure delegation. |

#### `clearKey(): Promise<void>`

| Field | Detail |
|---|---|
| **Purpose** | Remove the user's embedding key. |
| **Inputs** | None. |
| **Output** | `Promise<void>`. |
| **Errors** | Propagates the repository rejection. |
| **Side Effects** | None within the service; the repository performs the network DELETE. |
| **Invariants** | Pure delegation. |

### `IEmbeddingKeyRepository` (port)

#### `getStatus(): Promise<EmbeddingKeyStatus>`

| Field | Detail |
|---|---|
| **Purpose** | Read whether a per-user key is set. Maps to `GET /api/auth/me/embedding-key`. |
| **Inputs** | None. |
| **Output** | `Promise<EmbeddingKeyStatus>`. |
| **Errors** | Implementation-defined; the Axios impl rejects on non-2xx. |
| **Side Effects** | Network read. |
| **Invariants** | Never returns the key value, only presence. |

#### `setKey(apiKey: string): Promise<EmbeddingKeyStatus>`

| Field | Detail |
|---|---|
| **Purpose** | Set/replace the key (server validates via a live probe). Maps to `PUT /api/auth/me/embedding-key`. |
| **Inputs** | `apiKey: string`. |
| **Output** | `Promise<EmbeddingKeyStatus>` — new status. |
| **Errors** | Implementation-defined; rejects on non-2xx (e.g. rejected key). |
| **Side Effects** | Network write. |
| **Invariants** | Returns the post-write status. |

#### `clearKey(): Promise<void>`

| Field | Detail |
|---|---|
| **Purpose** | Remove the key (embeddings fall back to the deployment key). Maps to `DELETE /api/auth/me/embedding-key` (204). |
| **Inputs** | None. |
| **Output** | `Promise<void>`. |
| **Errors** | Implementation-defined; rejects on non-2xx. |
| **Side Effects** | Network delete. |
| **Invariants** | No response body expected. |

### `EmbeddingKeyRepository` (Axios implementation)

Constructed with `constructor(private readonly http: AxiosInstance)`. The injected `http` instance has a baseURL already including `/api`, so the module-level `ENDPOINT = '/auth/me/embedding-key'`. Private helper `mapStatus(raw: ApiEmbeddingKeyStatus): EmbeddingKeyStatus` maps `{ has_voyage_key }` → `{ hasVoyageKey }`.

#### `getStatus(): Promise<EmbeddingKeyStatus>`

| Field | Detail |
|---|---|
| **Purpose** | `GET` the status and map to the domain type. |
| **Inputs** | None. |
| **Output** | `Promise<EmbeddingKeyStatus>`. |
| **Errors** | Rejects with the Axios error on non-2xx (no local catch). |
| **Side Effects** | `http.get<ApiEmbeddingKeyStatus>(ENDPOINT)`. |
| **Invariants** | Output is `mapStatus(response.data)`. |

#### `setKey(apiKey: string): Promise<EmbeddingKeyStatus>`

| Field | Detail |
|---|---|
| **Purpose** | `PUT` the key with body `{ api_key: apiKey }` and map the response. |
| **Inputs** | `apiKey: string`. |
| **Output** | `Promise<EmbeddingKeyStatus>`. |
| **Errors** | Rejects with the Axios error on non-2xx. |
| **Side Effects** | `http.put<ApiEmbeddingKeyStatus>(ENDPOINT, { api_key: apiKey })`. |
| **Invariants** | Request body uses snake_case `api_key`; output is `mapStatus(response.data)`. |

#### `clearKey(): Promise<void>`

| Field | Detail |
|---|---|
| **Purpose** | `DELETE` the key (expects 204, no body). |
| **Inputs** | None. |
| **Output** | `Promise<void>`. |
| **Errors** | Rejects with the Axios error on non-2xx. |
| **Side Effects** | `http.delete(ENDPOINT)`. |
| **Invariants** | Response body ignored. |

### Hooks — `useEmbeddingKey.ts`

Module-level constant `EMBEDDING_KEY_STATUS_KEY = ['embedding-key']` is the TanStack Query cache key. All three hooks resolve `embeddingKeyService` via `useServices()`.

#### `useEmbeddingKeyStatus()`

| Field | Detail |
|---|---|
| **Purpose** | Query the embedding-key status. |
| **Inputs** | None. |
| **Output** | TanStack `UseQueryResult<EmbeddingKeyStatus>` (`data`, `isLoading`, `isError`, …). |
| **Errors** | Surfaced as `isError`/`error`; the component renders CFG_001 on error. |
| **Side Effects** | Network fetch via `embeddingKeyService.getStatus()`; cached under `['embedding-key']` with `staleTime: 30_000` ms. |
| **Invariants** | Read-only; never sets the key. |

#### `useSetEmbeddingKey()`

| Field | Detail |
|---|---|
| **Purpose** | Mutation to set/replace the key. |
| **Inputs** | `mutateAsync(apiKey: string)`. |
| **Output** | `UseMutationResult<EmbeddingKeyStatus, Error, string>`. |
| **Errors** | Rejects to the caller (component catches and shows backend `detail` or CFG_002). |
| **Side Effects** | Calls `setKey`; on success writes the returned status into the `['embedding-key']` cache via `setQueryData`. |
| **Invariants** | On success the cache reflects the new server status (no refetch needed). |

#### `useClearEmbeddingKey()`

| Field | Detail |
|---|---|
| **Purpose** | Mutation to clear the key. |
| **Inputs** | None (`mutateAsync()`). |
| **Output** | `UseMutationResult<void, Error, void>`. |
| **Errors** | Rejects to the caller (component catches and shows backend `detail` or CFG_003). |
| **Side Effects** | Calls `clearKey`; on success writes `{ hasVoyageKey: false }` into the `['embedding-key']` cache. |
| **Invariants** | On success the cached status is `{ hasVoyageKey: false }`. |

### Hook — `useChatPreferences.ts`

Backed by `localStorage` (no backend). Module constants: `STORAGE_KEY = 'pragna:chat-prefs'`, `CHANGE_EVENT = 'pragna:chat-prefs:change'`, `DEFAULTS = { branchEnabled: true, regenWithModelEnabled: true }`. Internal helpers `readPrefs`, `writePrefs`, `subscribe`, `getSnapshot` (referentially-stable, memoized on serialized value to avoid `useSyncExternalStore` tearing), and `getServerSnapshot` (returns `DEFAULTS`).

#### `useChatPreferences(): UseChatPreferencesReturn`

| Field | Detail |
|---|---|
| **Purpose** | Read and update per-browser chat-UX toggles with live cross-tab + in-page sync. |
| **Inputs** | None. |
| **Output** | `{ prefs: ChatPreferences; setPref: <K extends keyof ChatPreferences>(key: K, value: ChatPreferences[K]) => void }`. |
| **Errors** | None thrown; malformed/absent storage falls back to `DEFAULTS` (try/catch in `readPrefs`). |
| **Side Effects** | `setPref` writes JSON to `localStorage['pragna:chat-prefs']` and dispatches the `CHANGE_EVENT`. Subscribes to `storage` (other tabs) and the custom event (same tab). |
| **Invariants** | Snapshot is referentially stable while serialized prefs are unchanged; both flags default to `true`; SSR/no-window path returns `DEFAULTS`. |

## 6. Error Handling Strategy

Embedding-key errors are not modeled as domain error types; they surface as rejected Promises that the presentation layer maps to the centralized error catalog (`src/constants/errors.ts`). The component helper `messageFrom(err, fallback)` in `EmbeddingKeySection.tsx` prefers the backend's `response.data.detail` string and falls back to the catalog message.

| Error | Layer | Propagation |
|-------|-------|------------|
| Axios rejection on `GET` status | Infrastructure → Application → Presentation | `useEmbeddingKeyStatus().isError`; body renders `ERRORS.CFG_001.message`, header shows "Status unavailable" badge. |
| Axios rejection on `PUT` setKey | Infrastructure → Application → Presentation | `useSetEmbeddingKey().mutateAsync` rejects; `handleSave` catches → `messageFrom(err, ERRORS.CFG_002.message)` (backend `detail` preferred). |
| Axios rejection on `DELETE` clearKey | Infrastructure → Application → Presentation | `useClearEmbeddingKey().mutateAsync` rejects; `handleRemove` catches → `messageFrom(err, ERRORS.CFG_003.message)` (backend `detail` preferred). |
| Malformed/absent `localStorage` prefs | Presentation | Caught in `readPrefs`; falls back to `DEFAULTS` silently (UI-only, non-error). |

Catalog entries (codes are for log correlation, messages for UI display):
- `CFG_001` — "Failed to load your embedding key status." (severity: error)
- `CFG_002` — "Failed to save the embedding key. Check the key and try again." (severity: error)
- `CFG_003` — "Failed to clear the embedding key." (severity: error)

## 7. Configuration & Constants

No business values are hardcoded in logic. Values are externalized as named module constants or sourced from injected configuration.

| Constant | Source | Description |
|----------|--------|-------------|
| `ENDPOINT = '/auth/me/embedding-key'` | `EmbeddingKeyRepository.ts` (named module const) | API path; the `/api` prefix comes from the injected Axios `baseURL`. |
| Axios `baseURL` (incl. `/api`) | Injected `AxiosInstance` (HTTP client config) | Not hardcoded in this feature; provided to the repository constructor. |
| `EMBEDDING_KEY_STATUS_KEY = ['embedding-key']` | `useEmbeddingKey.ts` (exported const) | TanStack Query cache key. |
| `staleTime: 30_000` | `useEmbeddingKey.ts` | Status query freshness window (ms). |
| `STORAGE_KEY = 'pragna:chat-prefs'` | `useChatPreferences.ts` (named const) | `localStorage` key for the chat-preferences JSON blob. |
| `CHANGE_EVENT = 'pragna:chat-prefs:change'` | `useChatPreferences.ts` (named const) | Custom in-page event for same-tab live sync. |
| `DEFAULTS` (both flags `true`) | `useChatPreferences.ts` (named const) | Default chat-preference values. |
| Error codes/messages `CFG_001`/`CFG_002`/`CFG_003` | `src/constants/errors.ts` (centralized catalog) | User-facing messages and log-correlation codes. |

## 8. Testing Plan

| Test | Type | What It Verifies |
|------|------|-----------------|
| `EmbeddingKeyRepository.getStatus maps has_voyage_key` | unit | `{ has_voyage_key: true }` → `{ hasVoyageKey: true }` (mocked Axios). |
| `EmbeddingKeyRepository.setKey sends api_key body` | unit | `PUT` body is `{ api_key }`; response mapped to domain type (mocked Axios). |
| `EmbeddingKeyRepository.clearKey calls DELETE` | unit | `DELETE` issued to `ENDPOINT`; resolves `void` (mocked Axios). |
| `EmbeddingKeyService delegates to repository` | unit | Each method forwards to the port (mocked repository). |
| `useSetEmbeddingKey updates cache on success` | unit | `setQueryData(['embedding-key'], status)` after mutation. |
| `useClearEmbeddingKey sets hasVoyageKey false` | unit | Cache set to `{ hasVoyageKey: false }` on success. |
| `EmbeddingKeySection error fallbacks` | unit | Save shows backend `detail` else CFG_002; clear else CFG_003; status error shows CFG_001. |
| `EmbeddingKeySection disables save when empty` | unit | Save disabled for empty/whitespace input and while pending; key trimmed on submit. |
| `useChatPreferences defaults` | unit | Absent/malformed storage → both flags `true`. |
| `useChatPreferences setPref persists + notifies` | unit | Writes JSON to `STORAGE_KEY` and dispatches `CHANGE_EVENT`; subscribers re-render. |

(Network I/O, Axios, and `localStorage` are mocked per the repo testing standards.)

## 9. Dependencies & External Integrations

- **TanStack Query** (`@tanstack/react-query`) — status query + set/clear mutations and cache.
- **Axios** (`AxiosInstance`, injected) — HTTP transport to the backend API.
- **lucide-react** — icons (`ChevronDown`, `ChevronRight`, `GitBranch`, `MessageSquare`, `RefreshCw`).
- **UI primitives** (`@/components/ui/*`): `Badge`, `Button`, `ConfirmButton`, `Input`, `Label`; `EntityIcon`.
- **Backend API** — `/api/auth/me/embedding-key` singleton:
  - `GET` → `{ has_voyage_key: boolean }`
  - `PUT` body `{ api_key: string }` → `{ has_voyage_key: boolean }` (server validates the key via a live probe)
  - `DELETE` → `204 No Content`
- **Browser `localStorage`** — chat-preferences persistence (no external service).

## 10. Open Questions / Risks

- [ ] Server-side embedding-key validation (the "live probe") and the exact `pa-…` key format are backend-owned and not verified in this repo; the frontend copy describes them but does not enforce them.
- [ ] The shape of backend error responses is assumed to be `{ response: { data: { detail: string } } }` (Axios). If the API changes the error envelope, `messageFrom` silently falls back to the catalog message.

---

_Link to Feature Spec: [features/configuration.md](../features/configuration.md)_
