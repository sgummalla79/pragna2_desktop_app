# Technical Spec: LLM Gateway Provider

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-12
> **Last Updated**: 2026-06-12

---

## 1. Overview

Frontend-only change (the backend ships in pragna2-api). Adds a `gateway`
credential kind and a multiple-instance modal. The credential form is already
config-driven, so credential capture is additive; the multi-instance UI is a
master-detail panel layered onto the existing single-instance modal. Multi-
instance behaviour is gated on a backend capability flag, never a provider name.

## 2. Architecture & Layer Placement

- **Domain** (`src/domain/types/provider.types.ts`): `LlmProvider` gains
  `allowsMultipleRegistrations`; `UserProvider` gains `label`;
  `RegisterProviderPayload` gains optional `label`. `CredentialKind` already
  carries `'gateway'` (credential-capture core).
- **Infrastructure** (`src/infrastructure/repositories/`): mappers translate the
  new wire fields (`allows_multiple_registrations`, `label`) and the register
  call sends top-level `label`.
- **Presentation** (`ProvidersView`, `ProviderModal`, `MultiInstancePanel`,
  `ProviderConnectForm`, `ProviderTile`): the master-detail UI. No new
  hooks/services — reuses `useRegisterProvider`/`useDeleteProvider`/
  `useRefreshModels`/`useToggleProvider`.

## 3. Data Flow

```
GET /api/llm-providers/with-registrations
  -> LlmProviderRepository.mapLlmProviderWithRegistrations
     (allows_multiple_registrations -> allowsMultipleRegistrations; label -> label)
  -> ProvidersView (selected.allowsMultipleRegistrations decides modal mode)
  -> ProviderModal (multi ? MultiInstancePanel : single-instance body)

Connect: ProvidersView.handleConnect
  -> serializeCredentials('gateway', {baseUrl, authToken})  // JSON blob -> apiKey
  -> ProviderService.register({ llmProviderId, apiKey, label? })
  -> POST /api/user-providers { llm_provider_id, api_key, label }
```

## 4. Module & File Layout

```
src/
  domain/types/provider.types.ts                 (types + payload)
  constants/providers.ts                         (gateway CREDENTIAL_FIELDS + serialize — core)
  infrastructure/repositories/
    LlmProviderRepository.ts                      (map capability + embedded label)
    ProviderRepository.ts                         (map label; send label)
  presentation/views/settings/ProvidersView/
    ProvidersView.tsx                             (label + selectedRegistrationId state; id-based handlers)
    ProviderModal.tsx                             (dispatch: multi -> MultiInstancePanel)
    MultiInstancePanel.tsx                        (NEW — master-detail)
    ProviderConnectForm.tsx                       (optional label field)
    ProviderTile.tsx                              (connectedLabel; pill only when handler present)
```

## 5. Method Specifications

### `serializeCredentials(kind, values)` — `constants/providers.ts`

| Field | Detail |
|---|---|
| **Purpose** | Serialise credential form values to the single `apiKey` string the API expects |
| **Inputs** | `kind: CredentialKind`, `values: Record<string,string>` |
| **Output** | `string` — for `'gateway'`, `JSON.stringify({ baseUrl, authToken })` |
| **Errors** | None (missing fields default to `''`) |
| **Invariants** | Exhaustive over `CredentialKind`; gateway shape is `{baseUrl, authToken}` |

### `MultiInstancePanel(props)` — new component

| Field | Detail |
|---|---|
| **Purpose** | Modal body for a provider with `allowsMultipleRegistrations` — list registrations + add-another, drill into one for model management |
| **Inputs** | `registrations`, `selectedRegistrationId`/`onSelectRegistration`, connect-form props (incl. `label`), per-registration `onDisconnect(id)`/`onRefresh(id)`, dirty-change |
| **Output** | JSX — list view or detail view (one `ConnectedPanel` at a time) |
| **Side Effects** | None (delegates mutations to parent handlers) |
| **Invariants** | Only one `ConnectedPanel` mounted → the modal dirty-guard tracks a single panel exactly as single-instance |

### `ProvidersView.handleConnect()` / `handleDisconnect(id)` / `handleRefresh(id)`

| Field | Detail |
|---|---|
| **Purpose** | `handleConnect` sends `label` only when `selected.allowsMultipleRegistrations`; disconnect/refresh act on a registration id |
| **Side Effects** | React Query mutations + cache invalidation; disconnect on a multi-instance provider returns to list view, single-instance closes the modal |
| **Invariants** | Label omitted from single-instance requests; id-based handlers serve both modes |

## 6. Error Handling Strategy

| Error | Layer | Propagation |
|-------|-------|------------|
| 409 (duplicate / duplicate label) | API | `statusOf(err)===409` → `ERRORS.PRV_002` inline in connect form |
| Other register failure | API | `detailOr(err, ERRORS.PRV_003)` inline |
| Disconnect failure | API | `ERRORS.PRV_004` in the panel/modal |
| Refresh failure | API | `detailOr(err, ERRORS.PRV_006)` under the refresh action |

## 7. Configuration & Constants

- Gateway field definitions live in `CREDENTIAL_FIELDS.gateway`
  (`constants/providers.ts`) — components never hardcode field lists.
- Multi-instance is decided by the backend `allowsMultipleRegistrations`
  capability surfaced per provider — **no provider-name comparison** in the FE
  (satisfies the no-hardcoding / SOLID-O rule).
- Error copy is sourced from `constants/errors.ts` (`PRV_*`).

## 8. Testing

- `constants/providers.test.ts` — gateway field schema + `{baseUrl, authToken}`
  serialization.
- `ProvidersView.test.tsx` — multi-instance tile count badge, no single-instance
  pill, modal lists registrations by label, add-another form shows Label +
  Gateway URL + Auth Token.
- Repository mapper tests cover the new fields via existing suites.
- Full suite: 93 files / 487 tests green; `tsc --noEmit` clean.

## 9. Responsiveness

Modal `max-w-[calc(100vw-32px)] max-h-[90vh]`; panel `flex-1 min-h-0
overflow-y-auto`; registration rows `truncate` + shrink-0 action; detail header
`flex-wrap`. Verify a visual narrow-width pass before final merge.
