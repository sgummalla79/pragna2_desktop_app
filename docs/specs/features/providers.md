# Feature Spec: Providers (LLM Providers & Models)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Overview

The Providers settings page lets a user connect their own **LLM providers** (e.g. Anthropic, OpenAI, Bedrock, Vertex AI) by supplying credentials, and then manage the **models** discovered under each connection. The page renders the platform's full provider catalogue as a grid of square tiles; tiles the user has connected are accented and carry an enable/disable pill. Clicking a tile opens a modal that, for a not-yet-connected provider, shows a credential-driven connect form, and for a connected provider, shows a model-management grid. Connecting a provider auto-discovers its models in one server transaction; the model grid then exposes per-model rename, an Enabled toggle, and Chat / Flows availability toggles, all buffered locally and committed together via a single bulk save. A connected provider can be refreshed (re-run upstream model discovery) and disconnected (confirm-gated, archives the registration and cascade-disables its models).

## 2. Goals & Non-Goals

**Goals**
- [x] Render the global provider catalogue (one tile per `llm_providers` row) with each tile showing logo (or coloured initial fallback), display name, machine name, and a Connected / Not connected badge.
- [x] Embed each provider's current-user registrations and their models in a single network call (`GET /api/llm-providers/with-registrations`).
- [x] Connect a provider through a credential form driven by its `credentialKind` (`api_key` / `aws_credentials` / `gcp_credentials`), serialising the inputs into the single `api_key` field the backend expects.
- [x] Auto-discover the provider's models on connect (returned in the register response and persisted server-side).
- [x] Manage models in a grid: inline rename of display name, and Enabled / Chat / Flows toggles, with read-only model name and per-1M input/output cost columns.
- [x] Buffer all model edits locally and commit them in a single all-or-nothing bulk `PATCH /api/user-models`; Cancel discards the buffer and remounts the grid.
- [x] Enable/disable a connected provider directly from its tile pill (`PATCH /api/user-providers/{id}`).
- [x] Refresh a connected provider's models (`POST /api/user-providers/{id}/refresh-models`), reconciling created / archived / unarchived rows server-side.
- [x] Disconnect a provider behind a confirmation dialog (`DELETE /api/user-providers/{id}`), archiving the registration and cascade-disabling its models.
- [x] Guard the modal against accidental dismissal (Escape / overlay click) while the model grid has unsaved edits.

**Non-Goals**
- Creating or deleting individual models directly — models exist only as a side effect of registering or refreshing a provider (no standalone model POST/DELETE in the API).
- Editing model cost — `$/1M in` and `$/1M out` are read-only, resolved from the central pricing catalogue server-side.
- Serving the credential-field definitions or provider logos from a backend endpoint (both are local data: `CREDENTIAL_FIELDS` and bundled SVG logos).
- Validating credentials client-side beyond serialising the form values — credential correctness is determined by the backend register call.
- Managing more than one registration per provider in the UI — the modal operates on `userProviders[0]` (the first registration) only.
- Surfacing per-provider connection health / status beyond the connected badge and enabled pill.

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| user | see every provider the platform supports as tiles | I know what I can connect and what I've already connected |
| user | connect a provider by entering my API key (or AWS/GCP credentials) | my own account is billed and my keys are used |
| user | have my models discovered automatically on connect | I don't have to enter model names by hand |
| user | rename a model's display name | it reads clearly in chat / flow pickers |
| user | toggle a model on/off and choose Chat / Flows availability | I control exactly which models are usable and where |
| user | edit several models then save once | I don't fire a request per keystroke / click |
| user | discard my unsaved model edits | I can back out of a batch of changes safely |
| user | refresh a provider's models | I pick up models the provider newly offers (and see which were retired) |
| user | enable or disable a connected provider from its tile | I can park a provider without removing it |
| user | disconnect a provider | I can remove a registration and disable its models |

## 4. Acceptance Criteria

- [x] Given the page loads, when `GET /api/llm-providers/with-registrations` resolves, then each provider renders as a tile; tiles with a non-empty `userProviders` array show the primary-accent border, an On/Off pill, and a "Connected ✓" badge, while the rest stay neutral with a "Not connected" badge.
- [x] Given the catalogue is still loading, when the page renders, then "Loading providers…" is shown (`aria-live="polite"`).
- [x] Given the catalogue query fails, when the page renders, then the `PRV_005` message ("Failed to load provider catalogue.") is shown in a `role="alert"`.
- [x] Given the catalogue resolves empty, when the page renders, then a "No providers available" empty state is shown.
- [x] Given a not-connected tile is clicked, when the modal opens, then a credential form renders whose fields come from `CREDENTIAL_FIELDS[credentialKind]` (a masked key field for `api_key`; access-key / secret / region for `aws_credentials`; a JSON textarea for `gcp_credentials`), each with a placeholder example and a hint.
- [x] Given the connect form, when the user submits, then the form values are serialised by `serializeCredentials` into the single `api_key` string and `POST /api/user-providers` is called with `{ llm_provider_id, api_key }`; on success the models are auto-discovered, the combined catalogue + models caches are invalidated, and the modal (which derives its state from the live query) flips to the connected panel.
- [x] Given a connected tile is clicked, when the modal opens, then the connected panel shows the model grid plus a "Models · N discovered" count and a Save / Cancel toolbar.
- [x] Given the model grid, when the user edits a display name (blur with a changed, non-empty value), or clicks the Enabled / Chat / Flows dot, then the change is buffered in `pendingChanges` (keyed by model id) and the unsaved-changes count updates; reverting a cell to its saved value removes it from the buffer.
- [x] Given unsaved model edits, when the user clicks Save, then a single `PATCH /api/user-models` runs with all buffered entries (all-or-nothing); on success the buffer clears, the grid remounts, and the models + catalogue caches invalidate.
- [x] Given unsaved model edits, when the user clicks Cancel and confirms, then the buffer is discarded and the grid remounts to its saved state.
- [x] Given a connected provider, when the user clicks the tile's On/Off pill, then `PATCH /api/user-providers/{id}` flips `enabled` and the catalogue cache invalidates so every tile reflects the new state.
- [x] Given a connected provider, when the user clicks Refresh in the modal header, then `POST /api/user-providers/{id}/refresh-models` runs and the models + catalogue caches invalidate (new models arrive `enabled=false`).
- [x] Given a connected provider, when the user clicks Disconnect and confirms, then `DELETE /api/user-providers/{id}` archives the registration, cascade-disables its models, the modal closes, and the catalogue + models caches invalidate.
- [x] Given the model grid has unsaved edits, when the user presses Escape or clicks the overlay, then `useDirtyDialog` intercepts the dismissal to protect the buffered changes.
- [x] Models are sorted enabled-first, then alphabetically by display name, in the grid.
- [x] The page and modal are responsive: the tile grid uses `flex-wrap` with fixed-size tiles that reflow, the modal uses `max-w-[calc(100vw-32px)]` / `max-h-[90vh]` with internal scroll, and the grid scrolls within `overflow-auto`.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Catalogue fails to load | `PRV_005` message shown in place of the tile grid (the page's load-error path). |
| Connect fails (bad API key, network) | Prefers the backend `detail`, falling back to `PRV_003`; shown inline in the connect form. |
| Connect fails — already registered (409) | Surfaces `PRV_002` ("This provider is already registered."), distinct from a bad-key error (TD-008). |
| Disconnect fails | `PRV_004` ("Failed to remove provider.") shown in the connected panel error slot; the modal stays open. |
| Refresh fails | Surfaces the backend `detail` (else `PRV_006`) under the Refresh action (TD-008). |
| Refresh succeeds | Shows a diff summary — "N added · N archived · N restored" (or "No changes") under the Refresh action (TD-008). |
| Provider returns no models (empty discovery) | The grid shows "No models yet — click Refresh to discover models." |
| Toggle-provider (tile pill) fails | Surfaces `PRV_007` (else backend `detail`) above the tile grid (TD-008). |
| Bulk model save fails | The whole batch rejects all-or-nothing; the buffer is **retained** so the user can retry, and `MDL_004` (else backend `detail`) is shown in the panel (TD-008). |
| Model row is archived | Its toggles are disabled and the row renders at reduced opacity; archived rows are excluded from the embedded model list anyway (server excludes them). |
| Display-name edited to empty / whitespace | The grid's `isValid` rejects it and reverts the cell to its saved value; nothing is buffered. |
| User closes the modal mid-edit | `useDirtyDialog` blocks Escape / overlay dismissal while `modelEditsDirty` is true; the explicit ✕ / Close still works. |
| Provider has no logo SVG bundled | The tile and modal header fall back to a palette-coloured initial (`providerInitial`), with `vertexai`→V and `bedrock`→B overrides. |
| Monochrome-black logo in dark UI | Logos for `openai` / `groq` / `perplexity` are inverted so they stay visible. |

## 6. Out of Scope

- Standalone model creation / deletion (cascades from the provider only).
- Editing model pricing (read-only from the central catalogue).
- Multiple registrations per provider in the UI (only the first registration is managed).
- Backend-served credential field definitions or provider logos.
- Client-side credential validation / format checking.
- Automated tests for the providers/models repos, mappers, services, and hooks (tracked under the repo's testing debt).

## 7. Open Questions

> **Resolved (TD-008, 2026-06-09):** error surfacing is now on par with Connectors
> — connect prefers backend `detail` and maps 409 → `PRV_002`; refresh catches
> failures (`PRV_006`) and shows a created/archived/restored diff summary; the tile
> toggle surfaces failures (`PRV_007`); bulk model save catches and shows `MDL_004`
> while keeping the edit buffer. Extraction shared via `src/lib/httpError.ts`.

- [ ] **`PRV_001` and `MDL_001..MDL_003` remain catalogued but unused in this view.** Reserved for a future flow (e.g. a dedicated models page) or to be pruned.

---

_Link to Technical Spec: [technical/providers.md](../technical/providers.md)_
