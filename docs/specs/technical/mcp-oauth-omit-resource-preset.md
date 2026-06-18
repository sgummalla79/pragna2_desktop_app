# Technical Spec: MCP OAuth `omitResourceAtTokenExchange` Preset Flag (tracker #137)

## Changes

### `src/constants/mcpOAuth.ts`
- Added `MCP_OAUTH_OMIT_RESOURCE_KEY = 'omitResourceAtTokenExchange'` — the camelCase key name
  for the backend contract field.

### `src/domain/types/mcp.types.ts` — `McpOAuthConfig`
- Added optional field `omitResourceAtTokenExchange?: boolean`.
- `readMcpOAuthConfig()` passes the flag through when `true`; omits it otherwise (no `false`
  written to the wire — absent = default-off on the backend).

### `src/presentation/views/settings/ConnectorsView/connectorPresets.ts` — `ConnectorPreset`
- Added `oauthExtraFlags?: Pick<McpOAuthConfig, 'omitResourceAtTokenExchange'>` — a narrow extra-flags
  bag that is merged into `config.oauth` at connector-creation time without touching the form.
- Salesforce preset sets `oauthExtraFlags: { omitResourceAtTokenExchange: true }`.

### `src/presentation/views/settings/ConnectorsView/AddConnectorWizard.tsx`
- `handleDetailsSubmit`: when `preset?.oauthExtraFlags` is set and `p.oauthConfig` is present,
  spreads `oauthExtraFlags` into the oauth config before the `register.mutateAsync` call.
  Flags are NOT merged when `p.oauthConfig` is absent (plain DCR oauth or non-oauth connectors
  don't carry an oauth block at all).

## Data Flow

```
Salesforce preset selected
  → ConnectorDetailsForm (user fills clientId / loginUrl / callbackPort)
  → DetailsSubmit.oauthConfig = { clientId, loginUrl, callbackPort }
  → AddConnectorWizard.handleDetailsSubmit merges preset.oauthExtraFlags
  → config.oauth = { clientId, loginUrl, callbackPort, omitResourceAtTokenExchange: true }
  → POST /api/mcp-connectors — stored in connector row
  → On complete(): backend reads flag, skips resource param in token POST
```

## Why `oauthExtraFlags` instead of embedding in `oauthConfig`

`McpOAuthConfig` requires `clientId`, `loginUrl`, `callbackPort` — but the Salesforce preset has
empty values for those until the user fills in the form. Embedding a partial `oauthConfig` with
dummy required fields would be invalid. `oauthExtraFlags` is a separate, independently optional
bag that is merged at submit time, keeping the required/optional boundary clean.
