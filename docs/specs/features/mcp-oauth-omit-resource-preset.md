# Feature Spec: MCP OAuth `omitResourceAtTokenExchange` Preset Flag (tracker #137)

## Context

Backend tracker #136 added a per-connector `config.oauth.omitResourceAtTokenExchange` boolean flag.
When `true`, the backend omits the RFC 8707 `resource` parameter from the OAuth token exchange
request. This is required for Salesforce — its `/services/oauth2/token` endpoint rejects that
parameter with `400 invalid_grant / invalid code verifier`.

## Problem

Without this flag, any Salesforce MCP connector registered via the gallery preset fails at the
OAuth connect step with `invalid_grant`, even with correct credentials.

## Behaviour

- The Salesforce gallery preset seeds `config.oauth.omitResourceAtTokenExchange: true` at
  connector-creation time via a new `oauthExtraFlags` field on `ConnectorPreset`.
- The flag is **invisible to the user** — it never appears in the form; it is preset-injected.
- For all other presets (and custom connectors), `omitResourceAtTokenExchange` is absent from
  `config.oauth`, preserving the existing RFC 8707 behaviour.

## Acceptance Criteria

- [ ] A connector created from the Salesforce gallery preset has
  `config.oauth.omitResourceAtTokenExchange = true` in its stored config.
- [ ] A connector created from any other preset does NOT have that flag.
- [ ] A custom connector (no preset) does NOT have that flag.
- [ ] The Salesforce OAuth connect flow completes without `invalid_grant`.

## Out of Scope

- UI to toggle `omitResourceAtTokenExchange` manually (not needed; preset-only flag).
- Applying the flag retroactively to existing connectors (requires a re-register).
