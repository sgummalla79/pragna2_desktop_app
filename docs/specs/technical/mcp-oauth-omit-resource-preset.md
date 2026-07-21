# Technical Spec: MCP OAuth `omitResourceAtTokenExchange` User Checkbox (tracker #137, #248)

## Summary of Change

The `omitResourceAtTokenExchange` flag transitions from a **silent preset-injected value** (never
visible to the user) to a **user-controlled checkbox** inside the Pre-registered OAuth app section
of `ConnectorDetailsForm`. The Salesforce preset pre-checks it; all other connectors default to
unchecked.

## Changed Files

### `src/presentation/views/settings/ConnectorsView/ConnectorDetailsForm.tsx`

**New state:**
```ts
const [oauthOmitResource, setOauthOmitResource] = useState(
  initial?.oauthConfig?.omitResourceAtTokenExchange === true,
);
```

**`isDirty` addition:**
```ts
oauthOmitResource !== (initial?.oauthConfig?.omitResourceAtTokenExchange === true)
```

**`buildOAuthConfig` addition:**
```ts
...(oauthOmitResource ? { omitResourceAtTokenExchange: true } : {})
```
Key is omitted entirely when false — the backend interprets absence as `false`.

**UI:** A `<label>` wrapping a native `<input type="checkbox">` + explanatory text is appended
inside the `oauthAdvancedOpen` block, after the callback-port field.
`data-testid="mcp-oauth-omit-resource"` for test targeting.

**Auto-expand:** `oauthAdvancedOpen` initialises to `initial?.oauthConfig != null`, so the
Salesforce preset (which now populates `initial.oauthConfig` via the wizard) causes the section
to open automatically — the pre-checked box is immediately visible.

### `src/presentation/views/settings/ConnectorsView/AddConnectorWizard.tsx`

**`detailsInitial` change:** When a preset has `oauthExtraFlags`, a partial `oauthConfig`
skeleton is included in the initial values with the flags merged in:
```ts
...(preset.oauthExtraFlags
  ? { oauthConfig: { clientId: '', loginUrl: '', callbackPort: 0, ...preset.oauthExtraFlags } }
  : {})
```
`clientId`/`loginUrl`/`callbackPort` are empty/zero — `buildOAuthConfig` only assembles a valid
block when all three required fields are non-empty, so the preset skeleton triggers auto-expand +
pre-check without producing a premature submission block.

**`handleDetailsSubmit` change:** Silent `oauthExtraFlags` merge removed. `p.oauthConfig` from
the form is now the authoritative value, forwarded as-is to `register.mutateAsync`.

### `src/presentation/views/settings/ConnectorsView/EditConnectorModal.tsx`

`readMcpOAuthConfig(connector.config)` is called and the result is passed as
`initial.oauthConfig`. This surfaces the persisted value (including `omitResourceAtTokenExchange`)
in the form. Editing does not change the stored flag (BE PATCH does not accept `config`), but the
user can see what is set.

## Data Flow (create — Salesforce preset)

```
Salesforce preset selected
  → detailsInitial.oauthConfig = { clientId:'', loginUrl:'', callbackPort:0,
                                    omitResourceAtTokenExchange:true }
  → ConnectorDetailsForm: oauthOmitResource=true, oauthAdvancedOpen=true (auto-expand)
  → User fills clientId / loginUrl / callbackPort, sees pre-checked box
  → buildOAuthConfig() → { clientId, loginUrl, callbackPort, omitResourceAtTokenExchange:true }
  → DetailsSubmit.oauthConfig carries the flag
  → AddConnectorWizard forwards it directly (no merge step)
  → POST /api/mcp-connectors: config.oauth.omitResourceAtTokenExchange=true
  → Backend reads flag, skips resource param in /token POST → no invalid_grant
```

## Unchanged

- `McpOAuthConfig.omitResourceAtTokenExchange?: boolean` — no type change.
- `readMcpOAuthConfig` pass-through logic — no change.
- `MCP_OAUTH_OMIT_RESOURCE_KEY` constant — no change.
- `ConnectorPreset.oauthExtraFlags` — still present; now used to seed `detailsInitial`
  instead of merging at submit time.
