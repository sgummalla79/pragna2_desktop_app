# Technical Spec: LLM Gateway — Anthropic/Bedrock-shaped support

> **Status**: Implemented (backend path UNVERIFIED end-to-end)
> **Author**: Suman Gummalla
> **Created**: 2026-06-12
> **Last Updated**: 2026-06-12

---

## 1. Overview

The change is split across the frontend (this repo + the web app
`pragna2_sgummalla_works`) and the backend (`nexus-kit-api`). The frontend adds two
**optional** fields to the existing `gateway` credential form and serializes them
into the credential blob only when filled. The backend dispatches on the blob:
presence of `modelsUrl` selects an Anthropic/Bedrock client + the configured
discovery endpoint; absence keeps the OpenAI-compatible path. No new provider,
no schema/migration change.

## 2. Architecture & Layer Placement

- **Domain**: none. The `CredentialFieldDef` shape gains an optional `optional`
  flag; the gateway credential is still an opaque JSON string to the domain.
- **Application**: none on the FE. (Backend `CreateProvider` is unchanged — it
  still calls `list_models` then persists; the gateway provider absorbs the
  dispatch.)
- **Adapters / UI**:
  - FE: `src/constants/providers.ts` — two new optional gateway fields +
    conditional serialization. Rendered by the existing
    `ProviderConnectForm.tsx` (list-driven; no per-field code).
  - Backend: new `ChatAnthropicBedrockGateway` (`BaseChatModel` wrapping the
    Anthropic SDK `AnthropicBedrock`) + dispatch in `GatewayProvider`.

## 3. Data Flow

```
[Gateway connect form]
  -> serializeCredentials('gateway', values)            // FE: { baseUrl, authToken [, modelsUrl] [, awsRegion] }
  -> POST /api/user-providers { apiKey: <blob>, label } // existing route
  -> CreateProvider.execute
       -> LLMFactory.list_models('gateway', blob)
            -> GatewayProvider.list_models
                 modelsUrl set?  yes -> GET modelsUrl (lenient parser)
                                  no  -> probe /v1/models (OpenAI path)
  -> (chat time) LLMFactory.create('gateway', blob, model_id)
       -> GatewayProvider.create_llm
            modelsUrl set?  yes -> ChatAnthropicBedrockGateway (AnthropicBedrock)
                             no  -> ChatOpenAI(base_url={baseUrl}/v1)
```

## 4. Module & File Layout

```
pragna2_desktop_app/ (+ pragna2_sgummalla_works, identical)
  src/constants/providers.ts                         ← optional fields + serialize
  src/__tests__/serializeCredentials.test.ts         ← new FE test

nexus-kit-api/
  src/constants.py                                   ← GATEWAY_* keys + default region
  src/infrastructure/llm/_anthropic_bedrock_chat.py  ← new BaseChatModel
  src/infrastructure/llm/providers/gateway_provider.py ← dispatch + lenient parser
  tests/infrastructure/llm/test_gateway_provider.py     ← dispatch/parse tests
  tests/infrastructure/llm/test_anthropic_bedrock_chat.py ← new chat-model tests
```

## 5. Method Specifications

### `providers.ts`

#### `serializeCredentials(kind, values) -> string`

| Field | Detail |
|-------|--------|
| **Purpose** | Serialize credential form values to the `api_key` string for the registration route. |
| **Inputs** | `kind: CredentialKind`, `values: Record<string,string>` |
| **Output** | JSON string. For `gateway`: `{ baseUrl, authToken }`, plus `modelsUrl` / `awsRegion` **only when non-empty after trim**. |
| **Errors** | None (pure). |
| **Side Effects** | None. |
| **Invariants** | An OpenAI-compatible gateway (optional fields blank) serializes to exactly `{ baseUrl, authToken }` so backend dispatch stays on the OpenAI path. |

### `gateway_provider.py` (backend)

#### `GatewayProvider.create_llm(api_key, model_id, **kwargs) -> BaseChatModel`

| Field | Detail |
|-------|--------|
| **Purpose** | Build the chat model, dispatched on the credential blob. |
| **Inputs** | decrypted JSON blob; model id; per-call kwargs. |
| **Output** | `ChatAnthropicBedrockGateway` if `modelsUrl` present, else `ChatOpenAI`. |
| **Errors** | `ValueError` on invalid/missing-field JSON. |
| **Invariants** | `modelsUrl` present ⇒ Anthropic/Bedrock path; `awsRegion` falls back to `GATEWAY_DEFAULT_AWS_REGION`. |

#### `GatewayProvider.list_models(api_key) -> list[DiscoveredModel]`

| Field | Detail |
|-------|--------|
| **Purpose** | Discover models; fetch `modelsUrl` (lenient parse) or probe `/v1/models`. |
| **Errors** | `httpx.HTTPError` (wrapped as `ModelDiscoveryError` by the use case). |

## 6. Error Handling Strategy

| Error | Layer | Propagation |
|-------|-------|------------|
| Invalid gateway JSON | provider | `ValueError` → surfaces from create/list |
| Discovery HTTP failure | provider | bubbles to `CreateProvider`, wrapped `ModelDiscoveryError` → route 422 |
| Zero models discovered | use case | `NoModelsDiscoveredError` → 422 |

## 7. Configuration & Constants

| Constant | Source | Description |
|----------|--------|-------------|
| `GATEWAY_CREDENTIAL_KEY_*` | `nexus-kit-api/src/constants.py` | Credential-blob key names (`baseUrl`, `authToken`, `modelsUrl`, `awsRegion`) |
| `GATEWAY_DEFAULT_AWS_REGION` | `nexus-kit-api/src/constants.py` | Library-required region fallback for `AnthropicBedrock` when blob omits `awsRegion` |
| Gateway URL / token / models URL / region | User input (encrypted credential blob) | Never hardcoded; supplied per registration |

## 8. Testing Plan

| Test | Type | What It Verifies |
|------|------|-----------------|
| `serializeCredentials.test.ts` | unit (FE, vitest) | optional fields omitted when blank; included when filled |
| `test_gateway_provider` (Anthropic/Bedrock) | unit (BE) | dispatch on `modelsUrl`; region fallback; models-url fetch with bearer |
| `test_parse_models_response` | unit (BE) | lenient parser across shapes |
| `test_anthropic_bedrock_chat` | unit (BE) | message/tool conversion, response parse, `_generate`, `bind_tools`, stop→stop_sequences |

## 9. Dependencies & External Integrations

- Backend uses already-present deps: `anthropic` SDK (`AnthropicBedrock`),
  `langchain-core`. No new dependency.
- No DB migration; the `{baseUrl, authToken}` credential column is unchanged.

## 10. Open Questions / Risks

- [ ] **Unverified end-to-end** — built faithfully to the reference
      (`claude-web-app-main`) but never run against a real Anthropic/Bedrock
      gateway. Message/tool conversion and `modelsUrl` parsing may need tweaks.
- [ ] **No token-level streaming** — single-chunk fallback only (tech-debt #57).
- [ ] **Dispatch edge case** — an OpenAI gateway wanting a custom models URL
      would be misclassified; revisit by persisting detected protocol if needed.

---

_Link to Feature Spec: [features/llm-gateway-anthropic-bedrock.md](../features/llm-gateway-anthropic-bedrock.md)_
