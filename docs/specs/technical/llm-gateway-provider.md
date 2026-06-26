# Technical Spec: LLM Gateway Provider

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-12
> **Last Updated**: 2026-06-15

---

## 1. Overview

Frontend-only change (the backend ships in nexus-kit-api). Adds a `gateway`
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
    ProviderConnectForm.tsx                       (optional label field; Optional-settings accordion; file-type CA-cert control + toggle gating)
    ProviderTile.tsx                              (connectedLabel; pill only when handler present)
```

## 5. Method Specifications

### `serializeCredentials(kind, values)` — `constants/providers.ts`

| Field | Detail |
|---|---|
| **Purpose** | Serialise credential form values to the single `apiKey` string the API expects |
| **Inputs** | `kind: CredentialKind`, `values: Record<string,string>` |
| **Output** | `string` — for `'gateway'`, JSON blob with required `{baseUrl, authToken}` plus optional `{modelsUrl?, awsRegion?, caCert?, verifySsl?}` |
| **Errors** | None (missing fields default to `''`) |
| **Invariants** | Exhaustive over `CredentialKind`; optional fields omitted when blank; `verifySsl` serialised as native boolean `false` (never `true`) |

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
- **Field-driven rendering** (`ProviderConnectForm.renderField`): the form splits
  `CREDENTIAL_FIELDS[kind]` into required vs `optional` fields; optional fields
  render inside one collapsible **Optional settings** accordion shown last. Three
  config-driven `CredentialFieldDef` properties keep the component generic (no
  field-key branching, satisfying SOLID-O):
  - `type: 'file'` → an **Upload file | Paste** control. Upload is a compact
    click-to-select `Choose file…` button (no drag-drop — Tauri's default
    `dragDropEnabled: true` swallows webview DOM drop events). The picker filter
    is the `CA_CERT_FILE_ACCEPT` constant. Both modes read the file's text into
    `values[key]`; serialization is unchanged.
  - `enabledWhenToggleOn: <toggleKey>` → the field is disabled (with an inline
    note naming the gating toggle) while that toggle is off. `caCert` is gated on
    `verifySsl`; `verifySsl` is ordered immediately before `caCert`.
  - The mono-placeholder hint is suppressed for `type:'file'` fields (the
    placeholder is a multi-line cert block, not a one-line hint).

## 8. Testing

- `constants/providers.test.ts` — gateway field schema (field order asserts
  `verifySsl` precedes `caCert`) + `{baseUrl, authToken}` serialization;
  assertions for `caCert` (optional, `type:'file'`, `enabledWhenToggleOn:
  'verifySsl'`) and `verifySsl` (toggle type).
- `__tests__/serializeCredentials.test.ts` — SSL/TLS field serialization: caCert
  omitted when blank, included as PEM string when set; verifySsl omitted when on,
  serialised as boolean `false` when off; both together; regression for minimal blob.
- `ProvidersView.test.tsx` — multi-instance tile count badge, no single-instance
  pill, modal lists registrations by label, add-another form shows Label +
  Gateway URL + Auth Token.
- Repository mapper tests cover the new fields via existing suites.

## 9. Backend Contract (feature requirement for `nexus-kit-api`)

The backend decrypts `user_providers.api_key` and JSON-parses it. For
`credential_kind = 'gateway'`, two new optional keys may appear:

| Key | JSON type | Semantics |
|---|---|---|
| `caCert` | `string` (PEM) | Custom CA for TLS verification |
| `verifySsl` | `boolean false` | Skip all TLS verification |

**Priority rule the backend must implement:**
1. `caCert` non-empty → build `SSLContext` from the PEM string; use it for all
   outbound HTTPS calls to the gateway (`httpx`: `verify=ssl_ctx`).
2. `verifySsl === false` (no `caCert`) → `verify=False`.
3. Neither key present → system default trust store (`verify=True`).

`verifySsl: true` is **never** sent by the frontend. Treat an absent key as `true`.
The frontend does not send a file path — it sends the PEM content itself.

## 9. Responsiveness

Modal `max-w-[calc(100vw-32px)] max-h-[90vh]`; panel `flex-1 min-h-0
overflow-y-auto`; registration rows `truncate` + shrink-0 action; detail header
`flex-wrap`. The Optional-settings accordion and CA-cert control are fluid by
construction: full-width body, `self-start` toggles/buttons, and a `truncate`
file-name span (no fixed widths). Verify a visual narrow-width pass before final
merge.
