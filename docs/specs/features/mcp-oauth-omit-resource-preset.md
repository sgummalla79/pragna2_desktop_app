# Feature Spec: MCP OAuth `omitResourceAtTokenExchange` User Checkbox (tracker #137, #248)

## Context

Backend tracker #136 added a per-connector `config.oauth.omitResourceAtTokenExchange` boolean
flag. When `true`, the backend omits the RFC 8707 `resource` parameter from the OAuth token
exchange request. This is required for Salesforce — its `/services/oauth2/token` endpoint rejects
that parameter with `400 invalid_grant / invalid code verifier`.

Tracker #137 initially shipped this as a silent preset-injected flag (invisible to the user).
Tracker #248 promotes it to a user-visible checkbox so that:
- Users can audit and override the value set by a preset.
- Custom (non-preset) Salesforce connectors can set the flag without needing a gallery tile.
- Users editing an existing connector can see and change what is stored.

## Behaviour

### Create flow (preset path — Salesforce)
- The Salesforce gallery preset pre-checks the "Omit resource parameter at token exchange"
  checkbox by seeding `oauthConfig.omitResourceAtTokenExchange: true` in `detailsInitial`.
- The Pre-registered OAuth app section **auto-expands** so the pre-checked box is immediately
  visible — not hidden.
- The user can uncheck it before submitting if they know their AS supports the resource param.

### Create flow (custom / other-preset path)
- The checkbox is unchecked by default and lives inside the collapsible
  "Pre-registered OAuth app · optional" section.
- Any user configuring a non-standard AS that also rejects the resource param can expand the
  section and check the box without needing a dedicated gallery preset.

### Edit flow
- The existing connector's `config.oauth` block is read via `readMcpOAuthConfig` and passed into
  the form as `initial.oauthConfig`, including `omitResourceAtTokenExchange` when stored.
- The checkbox reflects the persisted value; the user can change it.
  _(Note: the PATCH endpoint does not accept `config` changes — the value can only change by
  re-creating the connector. The field is shown for auditability; see Out of Scope below.)_

## Acceptance Criteria

- [ ] Selecting the Salesforce preset opens the Pre-registered OAuth app section with the
  checkbox pre-checked.
- [ ] Submitting the form with the box checked sends `config.oauth.omitResourceAtTokenExchange:
  true` to the backend.
- [ ] Submitting with the box unchecked omits `omitResourceAtTokenExchange` from `config.oauth`.
- [ ] A custom connector can have the checkbox set by the user; the flag is forwarded.
- [ ] Editing an existing Salesforce connector shows the checkbox in its stored state.
- [ ] The Salesforce OAuth connect flow completes without `invalid_grant`.

## Out of Scope

- Applying the flag retroactively to existing connectors via PATCH (the BE PATCH endpoint does
  not accept `config` changes; requires re-register).
- Adding the checkbox to a "transport-only" Advanced section separate from Pre-registered OAuth.
