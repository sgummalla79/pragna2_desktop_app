# Technical Spec: Providers (LLM Providers & Models)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Overview

The Providers feature is implemented entirely in the frontend (React + TypeScript) following Clean Architecture. Domain types model the provider catalogue (`LlmProvider`), the user's registrations (`UserProvider`, with embedded variants), and discovered models (`Model`). Three application-layer services — `LlmProviderService` (read-only catalogue), `ProviderService` (the user's registrations), and `ModelService` (the user's models) — sit behind three ports: `ILlmProviderRepository`, `IUserProviderRepository`, and `IModelRepository`. Axios-backed repositories in the infrastructure layer call the backend `/api/llm-providers/*`, `/api/user-providers/*`, and `/api/user-models` endpoints and translate the snake_case wire shape (including the R3.5+ `api_name` renames) to the camelCase domain via inline mappers plus the shared `mapModel`. The presentation layer exposes TanStack Query hooks (`useProviders` family + `useModels` family) consumed by the `ProvidersView` page and its children. Two query caches matter: `['llm-providers-with-registrations']` (the combined catalogue+registrations+models payload that drives the page) and `['models']`; every mutation invalidates the combined key so the page re-derives fresh state. Model edits are buffered in the connected panel and committed in a single all-or-nothing bulk PATCH. The connect form is driven by `CREDENTIAL_FIELDS` config and serialised by `serializeCredentials`.

## 2. Architecture & Layer Placement

- **Domain**: Type-only models — no behavior, no domain errors introduced. `src/domain/types/provider.types.ts` (`CredentialKind`, `LlmProvider`, `UserProvider`, `UserProviderWithModels`, `LlmProviderWithRegistrations`, `RegisterProviderPayload`, `ProviderWithModels`) and `src/domain/types/model.types.ts` (`Model`, `UpdateModelPayload`, `BulkUpdateEntry`, `RefreshModelsResult`).
- **Application**: Ports `ILlmProviderRepository`, `IUserProviderRepository` (both in `IProviderRepository.ts`), and `IModelRepository`; thin facade services `LlmProviderService`, `ProviderService`, `ModelService` that delegate to the injected repository. The services exist as a single injection point and for consistency with the rest of the service layer (the ports keep the UI depending on abstractions, satisfying DIP).
- **Adapters (infrastructure + presentation)**: `LlmProviderRepository`, `ProviderRepository`, `ModelRepository` (axios via the native-HTTP adapter) implement the ports; the model wire mapper lives in `mappers/mapModel.ts` (provider/user-provider mappers are module-private inside their repositories). Presentation: TanStack Query hooks, the `ProvidersView` page, `ProviderTile`, `ProviderModal`, `ProviderConnectForm`, `ConnectedPanel`, and `ModelGrid` (built on the generic `DataGrid`). Disconnect / Cancel use the shared `ConfirmButton`; the modal uses `useDirtyDialog`. Credential field config and serialisation live in `constants/providers.ts`; logos in `assets/providerLogos.ts`.

## 3. Data Flow

```
Load page:
ProvidersView -> useLlmProvidersWithRegistrations
  -> LlmProviderService.listWithRegistrations -> ILlmProviderRepository.listWithRegistrations
  -> LlmProviderRepository: GET /llm-providers/with-registrations -> mapLlmProviderWithRegistrations[]
  -> tiles render; selected provider derived from live query by selectedId

Connect:
ProviderConnectForm.onConnect -> ProvidersView.handleConnect
  -> serializeCredentials(credentialKind, values) -> apiKey
  -> useRegisterProvider.mutateAsync({ llmProviderId, apiKey })
  -> ProviderService.register -> IUserProviderRepository.register
  -> ProviderRepository.register: POST /user-providers { llm_provider_id, api_key } -> { provider, models }
  -> onSuccess: invalidate ['llm-providers-with-registrations'] + ['models'] -> modal re-derives to connected panel

Model edits (buffered) + bulk save:
ModelGrid.onCellChange -> ConnectedPanel.handleCellChange (buffer in pendingChanges, drop no-ops)
ConnectedPanel.handleSave -> useBulkUpdateModels.mutateAsync(BulkUpdateEntry[])
  -> ModelService.bulkUpdate -> IModelRepository.bulkUpdate
  -> ModelRepository.bulkUpdate: PATCH /user-models { updates: [{ id, ...snake_case }] } -> Model[]
  -> onSuccess: invalidate ['models'] + ['llm-providers-with-registrations']; buffer cleared, grid remounted

Refresh models:
ProviderModal Refresh -> ProvidersView.handleRefresh -> useRefreshModels.mutateAsync(userProviderId)
  -> ProviderService.refreshModels -> ProviderRepository.refreshModels
  -> POST /user-providers/{id}/refresh-models -> RefreshModelsResult
  -> onSuccess: invalidate ['models'] + ['llm-providers-with-registrations']

Toggle provider (tile pill):
ProviderTile pill -> ProvidersView onToggleEnabled -> useToggleProvider.mutate({ id, enabled })
  -> ProviderService.toggle -> ProviderRepository.toggle: PATCH /user-providers/{id} { enabled }
  -> onSuccess: invalidate ['llm-providers-with-registrations']

Disconnect:
ProviderModal ConfirmButton -> ProvidersView.handleDisconnect -> useDeleteProvider.mutateAsync(userProviderId)
  -> ProviderService.delete -> ProviderRepository.delete: DELETE /user-providers/{id} (204)
  -> onSuccess: invalidate ['llm-providers-with-registrations'] + ['models']; modal closed
```

## 4. Module & File Layout

```
src/
  domain/types/
    provider.types.ts            ← CredentialKind, LlmProvider, UserProvider(+WithModels),
                                    LlmProviderWithRegistrations, RegisterProviderPayload, ProviderWithModels
    model.types.ts               ← Model, UpdateModelPayload, BulkUpdateEntry, RefreshModelsResult
  application/
    ports/
      IProviderRepository.ts      ← ILlmProviderRepository (catalogue) + IUserProviderRepository (registrations)
      IModelRepository.ts         ← model port
    services/
      LlmProviderService.ts       ← facade over ILlmProviderRepository (listAll / listWithRegistrations)
      ProviderService.ts          ← facade over IUserProviderRepository (list/register/refresh/toggle/delete)
      ModelService.ts             ← facade over IModelRepository (list/update/bulkUpdate)
  infrastructure/
    http/
      axiosClient.ts              ← baseURL = API_BASE_URL (…/api); native-HTTP adapter in Tauri
      tauriHttpAdapter.ts         ← axios adapter over @tauri-apps/plugin-http
    repositories/
      LlmProviderRepository.ts    ← axios impl of ILlmProviderRepository (+ private provider/embedded mappers)
      ProviderRepository.ts       ← axios impl of IUserProviderRepository (+ private mapUserProvider)
      ModelRepository.ts          ← axios impl of IModelRepository (+ private toApiBody)
      mappers/
        mapModel.ts               ← ApiModelResponse (snake_case) → Model
  presentation/
    hooks/
      providers/useProviders.ts   ← provider query/mutation hooks + cache keys
      models/useModels.ts         ← model query/mutation hooks
      useDirtyDialog.ts           ← guards modal dismissal while edits pending
    views/settings/ProvidersView/
      ProvidersView.tsx           ← page (tile grid + loading/error/empty + modal orchestration)
      ProviderTile.tsx            ← one catalogue tile: logo/initial, badges, enable/disable pill
      ProviderModal.tsx           ← dialog dispatching to connect form vs connected panel
      ProviderConnectForm.tsx     ← CREDENTIAL_FIELDS-driven credential inputs + Connect
      ConnectedPanel.tsx          ← model edit buffer + Save/Cancel toolbar
      ModelGrid.tsx               ← MODEL_COLUMNS config over the generic DataGrid
  components/ui/
    data-grid.tsx                 ← generic readonly/editable/toggle grid; parent owns persistence
    confirm-button.tsx            ← Button gated behind a confirmation dialog (disconnect / cancel)
  constants/
    api.ts                        ← API_BASE_URL (env-sourced, …/api)
    errors.ts                     ← PRV_001..PRV_005, MDL_001..MDL_003, NET_*
    providers.ts                  ← CredentialKind config (CREDENTIAL_FIELDS), serializeCredentials,
                                    providerColor/providerInitial, ANTHROPIC_PROVIDER_NAME
  assets/
    providerLogos.ts              ← PROVIDER_LOGO_URLS (glob of logos/*.svg), MONO_BLACK_PROVIDERS
    logos/*.svg                   ← bundled provider brand logos
```

## 5. Method Specifications

### `LlmProviderService`

#### `listAll() -> Promise<LlmProvider[]>`

| Field | Detail |
|---|---|
| **Purpose** | Return the global provider catalogue (every platform-supported provider option). |
| **Inputs** | None. |
| **Output** | `Promise<LlmProvider[]>`. |
| **Errors** | Propagates axios errors from `repo.listAll()`. |
| **Side Effects** | None (delegates). |
| **Invariants** | Pure delegation. (Exposed via `useLlmProviders`, not used by `ProvidersView`, which uses `listWithRegistrations`.) |

#### `listWithRegistrations() -> Promise<LlmProviderWithRegistrations[]>`

| Field | Detail |
|---|---|
| **Purpose** | Return every provider with the current user's registrations and models embedded — the single call that drives the page. |
| **Inputs** | None. |
| **Output** | `Promise<LlmProviderWithRegistrations[]>` — each item has `userProviders: UserProviderWithModels[]` (empty when not connected). |
| **Errors** | Propagates axios errors from `repo.listWithRegistrations()`. |
| **Side Effects** | None (delegates). |
| **Invariants** | Pure delegation; replaces separate catalogue + registrations + models fetches. |

### `ProviderService`

#### `list() -> Promise<UserProvider[]>`

| Field | Detail |
|---|---|
| **Purpose** | List the user's connected providers (flat, no embedded models). |
| **Inputs** | None. |
| **Output** | `Promise<UserProvider[]>`. |
| **Errors** | Propagates axios errors from `repo.list()`. |
| **Side Effects** | None. |
| **Invariants** | Pure delegation. (Exposed via `useProviders`; the page uses the combined query instead.) |

#### `register(payload: RegisterProviderPayload) -> Promise<ProviderWithModels>`

| Field | Detail |
|---|---|
| **Purpose** | Register a provider and auto-discover its models in one transaction. |
| **Inputs** | `payload: { llmProviderId: string; apiKey: string }` — `apiKey` is the serialised credential (raw key, or JSON for AWS/GCP). |
| **Output** | `Promise<ProviderWithModels>` — `{ provider, models }`. |
| **Errors** | Propagates axios errors from `repo.register()` (caller maps to `PRV_003`). |
| **Side Effects** | Server-side: creates the `user_providers` row and one `user_models` row per discovered model. |
| **Invariants** | Delegates to `repo.register(payload)`. |

#### `refreshModels(providerId: string) -> Promise<RefreshModelsResult>`

| Field | Detail |
|---|---|
| **Purpose** | Reconcile the stored model list against the upstream provider; new models start `enabled=false`, removed models are archived, reappearing models are unarchived. |
| **Inputs** | `providerId: string` — the `user_providers` id. |
| **Output** | `Promise<RefreshModelsResult>` — `{ created, archived, unarchived, models }`. |
| **Errors** | Propagates axios errors from `repo.refreshModels()`. |
| **Side Effects** | Server-side: reconciles the provider's `user_models` rows. |
| **Invariants** | Delegates to `repo.refreshModels(providerId)`. |

#### `toggle(id: string, enabled: boolean) -> Promise<UserProvider>`

| Field | Detail |
|---|---|
| **Purpose** | Enable or disable a registered provider. |
| **Inputs** | `id: string` (user_providers id); `enabled: boolean`. |
| **Output** | `Promise<UserProvider>` — updated registration. |
| **Errors** | Propagates axios errors from `repo.toggle()`. |
| **Side Effects** | Server-side: flips `user_providers.enabled`. |
| **Invariants** | Delegates to `repo.toggle(id, enabled)`. |

#### `delete(id: string) -> Promise<void>`

| Field | Detail |
|---|---|
| **Purpose** | Delete a provider registration and cascade to its models. |
| **Inputs** | `id: string` (user_providers id). |
| **Output** | `Promise<void>`. |
| **Errors** | Propagates axios errors from `repo.delete()` (caller maps to `PRV_004`). |
| **Side Effects** | Server-side: archives the registration and cascade-disables its `user_models`. |
| **Invariants** | Delegates to `repo.delete(id)`. |

### `ModelService`

#### `list() -> Promise<Model[]>`

| Field | Detail |
|---|---|
| **Purpose** | List all of the user's models (archived rows excluded by default server-side). |
| **Inputs** | None. |
| **Output** | `Promise<Model[]>`. |
| **Errors** | Propagates axios errors from `repo.list()`. |
| **Side Effects** | None. |
| **Invariants** | Pure delegation. (The page reads models embedded in the combined query; `useModels` is the standalone path.) |

#### `update(id: string, payload: UpdateModelPayload) -> Promise<Model>`

| Field | Detail |
|---|---|
| **Purpose** | Partially update one model's user-controllable fields. |
| **Inputs** | `id: string`; `payload: UpdateModelPayload` — any of `enabled` / `availableForChat` / `availableForFlows` / `displayName` / `metadata`. |
| **Output** | `Promise<Model>` — updated model. |
| **Errors** | Propagates axios errors from `repo.update()`. |
| **Side Effects** | Server-side: mutates the `user_models` row. |
| **Invariants** | `modelName`, `userProviderId`, `archived` are immutable via this endpoint. (Exposed via `useUpdateModel`; the connected panel uses the bulk path.) |

#### `bulkUpdate(updates: BulkUpdateEntry[]) -> Promise<Model[]>`

| Field | Detail |
|---|---|
| **Purpose** | Apply many partial model updates in one server transaction. |
| **Inputs** | `updates: BulkUpdateEntry[]` — each is `{ id, ...UpdateModelPayload }`. |
| **Output** | `Promise<Model[]>` — updated rows in input order. |
| **Errors** | Propagates axios errors; all-or-nothing — one bad id / constraint failure rejects the whole batch. |
| **Side Effects** | Server-side: applies all updates atomically. |
| **Invariants** | Delegates to `repo.bulkUpdate(updates)`. |

### `LlmProviderRepository` (implements `ILlmProviderRepository`)

> Constructor: `(http: AxiosInstance)`. Paths are resource-relative; the axios `baseURL` already includes `/api`.

#### `listAll() -> Promise<LlmProvider[]>`

| Field | Detail |
|---|---|
| **Purpose** | `GET /llm-providers`; map each row via `mapLlmProvider`. |
| **Inputs** | None. |
| **Output** | `Promise<LlmProvider[]>`. |
| **Errors** | Axios error (4xx/5xx) rejects. |
| **Side Effects** | HTTP GET. |
| **Invariants** | `name` is sourced from the R3.5+ `api_name` field; `credential_kind` cast to `CredentialKind`. |

#### `listWithRegistrations() -> Promise<LlmProviderWithRegistrations[]>`

| Field | Detail |
|---|---|
| **Purpose** | `GET /llm-providers/with-registrations`; map each row via `mapLlmProviderWithRegistrations`. |
| **Inputs** | None. |
| **Output** | `Promise<LlmProviderWithRegistrations[]>`. |
| **Errors** | Axios error rejects. |
| **Side Effects** | HTTP GET. |
| **Invariants** | Each `current_user_providers` entry maps to `UserProviderWithModels`; embedded models are mapped with `archived: false` injected (server excludes archived rows from the embed). |

##### Module-private mappers (`LlmProviderRepository.ts`)

- `mapLlmProvider(raw)` → `LlmProvider`: `api_name` → `name`, `display_name` → `displayName`, `credential_kind` → `credentialKind`, plus `id` / `enabled`.
- `mapEmbeddedUserProvider(raw)` → `UserProviderWithModels`: `llm_provider_id` → `llmProviderId`, `provider_api_name` → `providerName`, `metadata ?? {}`, models mapped via `mapModel({ ...m, archived: false })`.
- `mapLlmProviderWithRegistrations(raw)` → spreads `mapLlmProvider(raw)` and maps `current_user_providers` → `userProviders`.

### `ProviderRepository` (implements `IUserProviderRepository`)

> Constructor: `(http: AxiosInstance)`.

#### `list() -> Promise<UserProvider[]>`

| Field | Detail |
|---|---|
| **Purpose** | `GET /user-providers`; map each via `mapUserProvider`. |
| **Inputs** | None. |
| **Output** | `Promise<UserProvider[]>`. |
| **Errors** | Axios error rejects. |
| **Side Effects** | HTTP GET. |
| **Invariants** | `provider_api_name` → `providerName` (R3.5+ rename); `metadata ?? {}`. |

#### `register(payload) -> Promise<ProviderWithModels>`

| Field | Detail |
|---|---|
| **Purpose** | `POST /user-providers` with `{ llm_provider_id, api_key }`; map `{ provider, models }`. |
| **Inputs** | `payload: RegisterProviderPayload`. |
| **Output** | `Promise<ProviderWithModels>`. |
| **Errors** | Axios error rejects. |
| **Side Effects** | HTTP POST; server creates the registration + discovered model rows. |
| **Invariants** | `provider` mapped via `mapUserProvider`; `models` mapped via `mapModel`. |

#### `refreshModels(providerId) -> Promise<RefreshModelsResult>`

| Field | Detail |
|---|---|
| **Purpose** | `POST /user-providers/{providerId}/refresh-models`; map the four model arrays. |
| **Inputs** | `providerId: string`. |
| **Output** | `Promise<RefreshModelsResult>` — `{ created, archived, unarchived, models }` (each `Model[]`). |
| **Errors** | Axios error rejects. |
| **Side Effects** | HTTP POST; server reconciles the model rows. |
| **Invariants** | All four arrays mapped via `mapModel`. |

#### `toggle(id, enabled) -> Promise<UserProvider>`

| Field | Detail |
|---|---|
| **Purpose** | `PATCH /user-providers/{id}` with `{ enabled }`. |
| **Inputs** | `id: string`; `enabled: boolean`. |
| **Output** | `Promise<UserProvider>`. |
| **Errors** | Axios error rejects. |
| **Side Effects** | HTTP PATCH. |
| **Invariants** | Sends only `enabled`; maps via `mapUserProvider`. |

#### `delete(id) -> Promise<void>`

| Field | Detail |
|---|---|
| **Purpose** | `DELETE /user-providers/{id}`. |
| **Inputs** | `id: string`. |
| **Output** | `Promise<void>`. |
| **Errors** | Axios error rejects. |
| **Side Effects** | HTTP DELETE; server archives + cascade-disables models. |
| **Invariants** | No response body consumed. |

##### Module-private mapper (`ProviderRepository.ts`)

- `mapUserProvider(raw)` → `UserProvider`: `llm_provider_id` → `llmProviderId`, `provider_api_name` → `providerName`, plus `id` / `enabled` / `metadata ?? {}`.

### `ModelRepository` (implements `IModelRepository`)

> Constructor: `(http: AxiosInstance)`.

#### `list() -> Promise<Model[]>`

| Field | Detail |
|---|---|
| **Purpose** | `GET /user-models`; map each via `mapModel`. |
| **Inputs** | None. |
| **Output** | `Promise<Model[]>`. |
| **Errors** | Axios error rejects. |
| **Side Effects** | HTTP GET. |
| **Invariants** | Archived rows excluded by default server-side. |

#### `update(id, payload) -> Promise<Model>`

| Field | Detail |
|---|---|
| **Purpose** | `PATCH /user-models/{id}` with `toApiBody(payload)`. |
| **Inputs** | `id: string`; `payload: UpdateModelPayload`. |
| **Output** | `Promise<Model>`. |
| **Errors** | Axios error rejects. |
| **Side Effects** | HTTP PATCH. |
| **Invariants** | Body contains only the keys the caller set (sparse), snake_cased; maps via `mapModel`. |

#### `bulkUpdate(updates) -> Promise<Model[]>`

| Field | Detail |
|---|---|
| **Purpose** | `PATCH /user-models` with `{ updates: [{ id, ...toApiBody(payload) }] }`. |
| **Inputs** | `updates: BulkUpdateEntry[]`. |
| **Output** | `Promise<Model[]>` — mapped via `mapModel`, input order. |
| **Errors** | Axios error rejects; all-or-nothing batch. |
| **Side Effects** | HTTP PATCH (single transaction). |
| **Invariants** | Each entry's payload sparse-mapped via `toApiBody`; `id` carried through. |

##### Module-private helper (`ModelRepository.ts`)

- `toApiBody(payload)` → `Record<string, unknown>`: emits a key only when the source field `!== undefined` — `enabled`, `available_for_chat`, `available_for_flows`, `display_name`, `metadata`.

### Mapper — `mapModel.ts`

#### `mapModel(raw: ApiModelResponse) -> Model`

| Field | Detail |
|---|---|
| **Purpose** | Translate a snake_case `user_models` row to the camelCase domain `Model`. |
| **Inputs** | `raw: ApiModelResponse`. |
| **Output** | `Model`. |
| **Errors** | None (pure). |
| **Side Effects** | None. |
| **Invariants** | `api_name` → `modelName` (R3.5+ rename), `user_provider_id` → `userProviderId`, costs passed through as strings, `metadata ?? {}`, `supports_vision`/`supports_pdf` default `false` (R5 back-compat). |

### Presentation hooks — `useProviders.ts`

> Cache keys (module-local `const`): `LLM_PROVIDERS_KEY = ['llm-providers']`, `LLM_PROVIDERS_WITH_REG_KEY = ['llm-providers-with-registrations']`, `PROVIDERS_KEY = ['providers']`, `MODELS_KEY = ['models']`. Services obtained via `useServices()` (ServiceContext).

#### `useLlmProviders()`

| Field | Detail |
|---|---|
| **Purpose** | `useQuery` of the global catalogue (`listAll`). |
| **Inputs** | None. |
| **Output** | `UseQueryResult<LlmProvider[]>`. |
| **Errors** | Query `isError` on repository failure. |
| **Side Effects** | None beyond caching. |
| **Invariants** | `queryKey = ['llm-providers']`; `staleTime = Infinity` (catalogue rarely changes). Not used by `ProvidersView`. |

#### `useLlmProvidersWithRegistrations()`

| Field | Detail |
|---|---|
| **Purpose** | `useQuery` of the combined catalogue+registrations+models (`listWithRegistrations`) — the page's primary data source. |
| **Inputs** | None. |
| **Output** | `UseQueryResult<LlmProviderWithRegistrations[]>`. |
| **Errors** | Query `isError` → page shows `PRV_005`. |
| **Side Effects** | None beyond caching. |
| **Invariants** | `queryKey = ['llm-providers-with-registrations']`; `staleTime = 30_000` ms. |

#### `useProviders()`

| Field | Detail |
|---|---|
| **Purpose** | `useQuery` of the user's flat registrations (`ProviderService.list`). |
| **Inputs** | None. |
| **Output** | `UseQueryResult<UserProvider[]>`. |
| **Errors** | Query `isError`. |
| **Side Effects** | None beyond caching. |
| **Invariants** | `queryKey = ['providers']`; `staleTime = 30_000` ms. Not used by `ProvidersView`. |

#### `useRegisterProvider()`

| Field | Detail |
|---|---|
| **Purpose** | Mutation calling `register`. |
| **Inputs** | Variables: `RegisterProviderPayload`. |
| **Output** | `UseMutationResult<ProviderWithModels, Error, RegisterProviderPayload>`. |
| **Errors** | Rejects; `ProvidersView.handleConnect` maps a 409 → `PRV_002`, else prefers backend `detail` (`PRV_003` fallback) via `src/lib/httpError.ts` (pragna2-tracker TD-008). |
| **Side Effects** | `onSuccess`: invalidates `['llm-providers-with-registrations']` AND `['models']`. |
| **Invariants** | Cross-invalidation because registration creates models. |

#### `useRefreshModels()`

| Field | Detail |
|---|---|
| **Purpose** | Mutation calling `refreshModels`. |
| **Inputs** | Variables: `providerId: string` (user_providers id). |
| **Output** | `UseMutationResult<RefreshModelsResult, Error, string>`. |
| **Errors** | Rejects; `ProvidersView.handleRefresh` catches → backend `detail` else `PRV_006` shown under the Refresh action (pragna2-tracker TD-008). |
| **Side Effects** | `onSuccess`: invalidates `['models']` AND `['llm-providers-with-registrations']`. |
| **Invariants** | The returned diff (`created`/`archived`/`unarchived`) is summarized in the UI via `summarizeRefresh` (pragna2-tracker TD-008). |

#### `useToggleProvider()`

| Field | Detail |
|---|---|
| **Purpose** | Mutation calling `toggle`. |
| **Inputs** | Variables: `{ id: string; enabled: boolean }`. |
| **Output** | `UseMutationResult<UserProvider, Error, { id, enabled }>`. |
| **Errors** | Rejects; `ProvidersView.handleToggle` passes an `onError` that shows `PRV_007` (else backend `detail`) above the tile grid (pragna2-tracker TD-008). |
| **Side Effects** | `onSuccess`: invalidates `['llm-providers-with-registrations']` only. |
| **Invariants** | Drives the per-tile enable/disable pill. |

#### `useDeleteProvider()`

| Field | Detail |
|---|---|
| **Purpose** | Mutation calling `delete`. |
| **Inputs** | Variables: `id: string` (user_providers id). |
| **Output** | `UseMutationResult<void, Error, string>`. |
| **Errors** | Rejects; `ProvidersView.handleDisconnect` catches and shows `PRV_004`. |
| **Side Effects** | `onSuccess`: invalidates `['llm-providers-with-registrations']` AND `['models']` (cascade-disable). |
| **Invariants** | Soft delete (archive) server-side. |

### Presentation hooks — `useModels.ts`

> Cache keys (module-local): `MODELS_KEY = ['models']`, `LLM_PROVIDERS_WITH_REG_KEY = ['llm-providers-with-registrations']`.

#### `useModels()`

| Field | Detail |
|---|---|
| **Purpose** | `useQuery` of the user's flat model list (`ModelService.list`). |
| **Inputs** | None. |
| **Output** | `UseQueryResult<Model[]>`. |
| **Errors** | Query `isError` (catalog message `MDL_001`). |
| **Side Effects** | None beyond caching. |
| **Invariants** | `queryKey = ['models']`; `staleTime = 30_000` ms. The page reads models embedded in the combined query instead; this hook is the standalone path. |

#### `useUpdateModel()`

| Field | Detail |
|---|---|
| **Purpose** | Mutation calling `ModelService.update` (single-model PATCH). |
| **Inputs** | Variables: `{ id: string; payload: UpdateModelPayload }`. |
| **Output** | `UseMutationResult<Model, Error, { id, payload }>`. |
| **Errors** | Rejects. |
| **Side Effects** | `onSuccess`: invalidates `['models']` AND `['llm-providers-with-registrations']`. |
| **Invariants** | Not used by the connected panel (which buffers + bulk-saves); available for single-row callers. |

#### `useBulkUpdateModels()`

| Field | Detail |
|---|---|
| **Purpose** | Mutation calling `ModelService.bulkUpdate` — the connected panel's Save. |
| **Inputs** | Variables: `BulkUpdateEntry[]`. |
| **Output** | `UseMutationResult<Model[], Error, BulkUpdateEntry[]>`. |
| **Errors** | Rejects all-or-nothing; `ConnectedPanel.handleSave` `await`s it, so a rejection throws before the buffer clears (buffer retained). |
| **Side Effects** | `onSuccess`: invalidates `['models']` AND `['llm-providers-with-registrations']` (modal model pills derive from the combined query). |
| **Invariants** | One server transaction for the whole batch. |

### Presentation orchestration — `ProvidersView` / `ConnectedPanel` (key local logic)

- `ProvidersView` stores only `selectedId`; `selected` is derived from the live query each render, so the modal reflects fresh data after any mutation.
- `serializeCredentials(credentialKind, credentialValues)` reduces the form values to the single `api_key` string before `register`.
- `ConnectedPanel` owns `pendingChanges` (a `Record<modelId, UpdateModelPayload>`); `handleCellChange` merges per-field edits and drops an entry when `isNoOp` (reverted to saved). `effectiveModels` overlays pending edits onto the sorted (enabled-first, then alpha) model list. `handleCancel` clears the buffer and bumps `resetKey` to remount the grid; `handleSave` builds `BulkUpdateEntry[]` and calls `bulkUpdate.mutateAsync`. `onDirtyChange` feeds `useDirtyDialog` in the modal.

## 6. Error Handling Strategy

Repositories let axios errors propagate (no swallowing). Hooks expose them via mutation/query rejection. Since pragna2-tracker TD-008 the Providers view surfaces the backend `detail` (via the shared `src/lib/httpError.ts` `detailOr`/`statusOf`), falling back to a `PRV_*`/`MDL_*` catalog message — on par with Connectors.

| Error | Layer | Propagation |
|---|---|---|
| `PRV_001` "Failed to load providers." | Presentation (catalog) | Catalogued; **not referenced** in `ProvidersView` (reserved / for the flat providers list). |
| `PRV_002` "This provider is already registered." | Presentation | Shown by `handleConnect` when the register call returns **409** (pragna2-tracker TD-008). |
| `PRV_003` "Failed to add provider. Check your API key and try again." | Presentation | Connect fallback when no backend `detail` and not a 409 (`handleConnect`). |
| `PRV_004` "Failed to remove provider." | Presentation | Shown in `ConnectedPanel` error slot when `useDeleteProvider` rejects (`handleDisconnect` catch). |
| `PRV_005` "Failed to load provider catalogue." | Presentation (catalog) | Shown when `useLlmProvidersWithRegistrations` `isError`. |
| `MDL_001` "Failed to load models." | Presentation (catalog) | Catalog message for `useModels` load failures; the page uses embedded models, so not rendered in this view. |
| `MDL_002` "Failed to register model." | Presentation (catalog) | Catalogued; **not referenced** in this view. |
| `MDL_003` "Failed to remove model." | Presentation (catalog) | Catalogued; **not referenced** in this view. |
| `PRV_006` "Failed to refresh models." | Presentation | `handleRefresh` fallback when no backend `detail` (pragna2-tracker TD-008). |
| `PRV_007` "Failed to update the provider." | Presentation | Tile toggle `onError` fallback when no backend `detail` (pragna2-tracker TD-008). |
| `MDL_004` "Failed to save model changes…" | Presentation | `ConnectedPanel.handleSave` fallback; the edit buffer is retained for retry (pragna2-tracker TD-008). |
| Backend `detail` (4xx/5xx) | Infrastructure → Presentation | **Surfaced** by the Providers handlers via `detailOr` (preferred over the catalog fallback) since pragna2-tracker TD-008. |
| HTTP status (401/403/404/409/500) | Infrastructure | Axios rejects; `NET_*` catalog entries exist for global handling. |

## 7. Configuration & Constants

| Constant | Source | Description |
|---|---|---|
| `API_BASE_URL` | `VITE_API_BASE_URL` env (default `http://localhost:8000/api`) via `src/constants/api.ts` | Axios `baseURL`; includes `/api`, so repo paths are resource-relative. |
| Error messages (`PRV_*`, `MDL_*`, `NET_*`) | `src/constants/errors.ts` | Centralised catalog; never inlined in logic. |
| `CREDENTIAL_FIELDS` | `src/constants/providers.ts` | Per-`CredentialKind` field definitions (key/label/placeholder/hint/secret/multiline) the connect form iterates — components never hardcode field lists. Data, not logic. |
| `serializeCredentials(kind, values)` | `src/constants/providers.ts` | Reduces form values to the single `api_key` string per credential kind (raw key / AWS JSON / GCP JSON blob). |
| `providerColor` / `providerInitial` | `src/constants/providers.ts` | Palette-driven logo-fallback colours (theme CSS vars) and initial letter (with `vertexai`→V, `bedrock`→B overrides). |
| `ANTHROPIC_PROVIDER_NAME` | `src/constants/providers.ts` | Named constant for the Anthropic machine name (mirrors the backend seed); externalised so it is never inlined. |
| `PROVIDER_LOGO_URLS` | `src/assets/providerLogos.ts` | Build-time glob of `assets/logos/*.svg` keyed by provider machine name; fallback to coloured initial when absent. Data, not logic. |
| `MONO_BLACK_PROVIDERS` | `src/assets/providerLogos.ts` | Set of providers (`openai`, `groq`, `perplexity`) whose monochrome-black logos are inverted in the dark UI. |
| `MODEL_COLUMNS` | `ModelGrid.tsx` | Grid column config (readonly/editable/toggle) driving the `DataGrid`; add/reorder columns here. |
| `staleTime` (`Infinity` / `30_000`) | `useProviders` / `useModels` | Query freshness windows. |

## 8. Testing Plan

> No automated tests shipped with this feature — tracked under the repo's testing debt. Planned coverage:

| Test | Type | What It Verifies |
|---|---|---|
| `LlmProviderRepository.*` HTTP contracts | unit (mock axios) | `GET /llm-providers`, `GET /llm-providers/with-registrations`; `api_name` → `name`, embedded models get `archived: false`. |
| `ProviderRepository.*` HTTP contracts | unit (mock axios) | Correct verb/path/body for list/register/refresh/toggle/delete; `{ llm_provider_id, api_key }` body; `provider_api_name` → `providerName`. |
| `ModelRepository.*` HTTP contracts | unit (mock axios) | `GET /user-models`, `PATCH /user-models/{id}`, bulk `PATCH /user-models` `{ updates: [...] }`; `toApiBody` sparseness. |
| `mapModel` | unit | snake_case → camelCase incl. `api_name`→`modelName`, default `supportsVision`/`supportsPdf`. |
| `serializeCredentials` | unit | Correct output per `CredentialKind` (raw key / AWS JSON shape / GCP blob). |
| Hook invalidation | unit (mock query client) | register/refresh/delete/bulkUpdate invalidate `['llm-providers-with-registrations']`(+`['models']`); toggle invalidates only the combined key. |
| `ConnectedPanel` buffer logic | unit | `handleCellChange` merge + `isNoOp` drop; `handleSave` builds `BulkUpdateEntry[]`; Cancel remounts. |
| `ProvidersView.handleConnect` | unit | `serializeCredentials` → `register`; `PRV_003` on rejection. |

## 9. Dependencies & External Integrations

- **Native-HTTP axios adapter** (`src/infrastructure/http/tauriHttpAdapter.ts` over `@tauri-apps/plugin-http`) — wired in `axiosClient.ts` when running inside the Tauri webview so backend calls run in Rust and bypass the webview CORS policy; falls back to the default adapter under `pnpm dev`.
- **`@tanstack/react-query`** — query/mutation hooks and cache cross-invalidation.
- **`axios`** — repository transport.
- **`radix-ui` Dialog** — the provider modal and `ConfirmButton` (disconnect / cancel) dialogs.
- **Backend `/api/llm-providers/*`, `/api/user-providers/*`, `/api/user-models`** endpoints (external service):
  - `GET /api/llm-providers`
  - `GET /api/llm-providers/with-registrations`
  - `GET /api/user-providers`, `POST /api/user-providers`
  - `POST /api/user-providers/{id}/refresh-models`
  - `PATCH /api/user-providers/{id}`, `DELETE /api/user-providers/{id}`
  - `GET /api/user-models`, `PATCH /api/user-models/{id}`, `PATCH /api/user-models` (bulk)
- **Bundled SVG logos** (`src/assets/logos/*.svg`) — loaded at build time via Vite `import.meta.glob`; no remote icon fetch.

## 10. Open Questions / Risks

> **Resolved (pragna2-tracker TD-008):** Providers handlers now surface backend `detail`
> (shared `src/lib/httpError.ts`); connect maps 409 → `PRV_002`; refresh catches
> (`PRV_006`) + shows a diff summary; the tile toggle surfaces failures
> (`PRV_007`); bulk-save catches (`MDL_004`) keeping the buffer.
- [ ] **Unused error codes.** `PRV_001` and `MDL_001..MDL_003` remain catalogued but unreferenced in this view (`PRV_002`/`PRV_006`/`PRV_007`/`MDL_004` are now wired — pragna2-tracker TD-008). Reserve for a future flow or prune.
- [ ] **Single-registration assumption.** The modal manages `userProviders[0]` only; multiple registrations per provider are not represented in the UI.

---

_Link to Feature Spec: [features/providers.md](../features/providers.md)_
