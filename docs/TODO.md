# Backlog / TODO

Single source of truth for deferred work. Code must **not** carry free-floating
`TODO` notes — instead reference an ID here (e.g. `// see docs/TODO.md TD-001`).

Status: `open` · `in-progress` · `done` · `wontfix`
Priority: `P1` (blocks a feature) · `P2` (should do soon) · `P3` (nice to have)

| ID | Title | Area | Priority | Status |
|----|-------|------|----------|--------|
| [TD-001](#td-001--desktop-oauth-connector-callback-round-trip) | Desktop OAuth connector callback round-trip | Connectors | P1 | open |
| [TD-002](#td-002--feature--technical-spec-docs-for-the-three-settings-pages) | Spec docs for Configuration / Connectors / Knowledge | Docs | P2 | done |
| [TD-007](#td-007--backfill-spec-docs-for-login--providers) | Backfill spec docs for Login + Providers | Docs | P2 | done |
| [TD-008](#td-008--providers-view-swallows-errors) | Providers view swallows several errors | Providers | P3 | open |
| [TD-009](#td-009--auth-session-does-not-persist-across-restart) | Auth session does not persist across restart | Login | P3 | open |
| [TD-010](#td-010--agent-tool-entry-autocomplete-against-apitools) | Agent tool entry: autocomplete against /api/tools | Agents | P3 | open |
| [TD-011](#td-011--model--temperature-selection-on-standalone-agents) | Model / temperature selection on standalone agents | Agents | P3 | open |
| [TD-003](#td-003--unit-tests-for-the-three-new-features) | Unit tests for the three new features | Testing | P2 | open |
| [TD-004](#td-004--verify-multipart-knowledge-upload-against-the-live-backend) | Verify multipart Knowledge upload end-to-end | Knowledge | P2 | open |
| [TD-005](#td-005--client-side-file-validation-for-knowledge-upload) | Client-side file validation for Knowledge upload | Knowledge | P3 | open |
| [TD-006](#td-006--chat-action-preferences-have-no-consumer-yet) | Chat-action preferences have no consumer yet | Configuration | P3 | open |

---

## TD-001 — Desktop OAuth connector callback round-trip

**Area:** Connectors (MCP) · **Priority:** P1 · **Status:** open

**What:** OAuth-type MCP connectors are not yet fully connectable on desktop. The
api_key / bearer / headers / none auth types work end-to-end. For OAuth, we call
`POST /api/mcp-connectors/{id}/oauth-authorization`, then open the returned
`authorizationUrl` in the **system browser** via the opener plugin — but there is
no callback listener to capture the redirect and finish the exchange, so the user
must manually return and hit **Refresh**.

**Where:**
- `src/presentation/views/settings/ConnectorsView/ConnectorCard.tsx` (`onConnect`/`startOAuth` handler)
- `src/presentation/views/settings/ConnectorsView/AddConnectorWizard.tsx` (OAuth step)

**Approach:** Reuse the login pattern — a localhost loopback server (RFC 8252,
`tauri-plugin-oauth`) as the redirect target, then complete the exchange and
invalidate the connectors query. See `src/infrastructure/auth0/tauriLoopbackAuthFlow.ts`.
Open question: the connector `redirect_uri` is registered with the upstream
authorization server / set by the backend, so confirm the backend can accept a
loopback `redirect_uri` (or a custom deep-link scheme) for desktop clients before building.

**Done when:** an OAuth MCP connector can be connected without leaving the app and
its tools appear automatically.

---

## TD-002 — Feature + technical spec docs for the three settings pages

**Area:** Docs · **Priority:** P2 · **Status:** done (2026-06-09)

**What:** CLAUDE.md requires two specs per feature
(`docs/specs/features/<name>.md` + `docs/specs/technical/<name>.md`).

**Done:** `configuration.md`, `connectors.md`, `knowledge.md` written under both
`docs/specs/features/` and `docs/specs/technical/`, sourced from the shipped code.

---

## TD-007 — Backfill spec docs for Login + Providers

**Area:** Docs · **Priority:** P2 · **Status:** open

**What:** The `login` and `providers` features were merged earlier without the two
required spec docs (only `boilerplate-setup` and the three settings pages have them).
Backfill them to bring every shipped feature into compliance with the CLAUDE.md rule.

**Where:** create `login.md` and `providers.md` under both `docs/specs/features/`
and `docs/specs/technical/`, sourced from the shipped code.

**Done (2026-06-09):** `login.md` and `providers.md` written under both
`docs/specs/features/` and `docs/specs/technical/`. Every shipped feature now has
both spec docs.

---

## TD-008 — Providers view swallows several errors

**Area:** Providers · **Priority:** P3 · **Status:** open

**What:** Surfaced while writing the providers spec. Unlike Connectors, the
Providers view does not surface backend `detail`, and several failures are silent:
refresh-models and the tile enable/disable toggle are fire-and-forget (no catch);
bulk-save failure keeps the buffer but shows no message; the refresh diff
(created/archived/unarchived) is returned but never displayed; an already-registered
provider falls through to the generic `PRV_003` instead of `PRV_002`.

**Where:** `src/presentation/views/settings/ProvidersView/*`

**Done when:** these paths show explicit, user-visible errors (prefer backend
`detail` with catalog fallback) and `PRV_002` is used for duplicates.

---

## TD-009 — Auth session does not persist across restart

**Area:** Login · **Priority:** P3 · **Status:** open

**What:** Surfaced while writing the login spec. `offline_access` is requested but
no refresh token is stored or used; the session lives only in `sessionStorage`, so
it is cleared when the window closes — no cross-restart persistence and no silent
refresh. Decide whether desktop should keep a long-lived session (secure token
storage + refresh) or intentionally require sign-in each launch.

**Where:** `src/presentation/store/authStore.ts`, `src/infrastructure/auth0/*`

**Done when:** the persistence behavior is a deliberate, documented decision.

---

## TD-010 — Agent tool entry: autocomplete against /api/tools

**Area:** Agents · **Priority:** P3 · **Status:** open

**What:** In the agent editor, tools are entered as a free-form chip input of tool
handles (matching the web app) — no validation or autocomplete against the actual
tools inventory. Upgrade it to an autocomplete/picker sourced from `GET /api/tools`
so users select from real, enabled tools instead of typing handles by hand.

**Where:** `src/presentation/views/settings/AgentsView/ChipInput.tsx` /
`AgentFormModal.tsx`; reuse `useTools()`.

**Done when:** tool entry suggests/validates against the live tools list.

---

## TD-011 — Model / temperature selection on standalone agents

**Area:** Agents · **Priority:** P3 · **Status:** open

**What:** Standalone agents currently have no model or sampling-parameter
(temperature/top_p) selection — the `/api/agents` contract does not include them
(model selection lives on *flow* agents). Add per-agent model + temperature
selection once the backend contract supports it, sourcing models from the
already-ported Providers/Models layer (`useModels`).

**Where:** `src/presentation/views/settings/AgentsView/AgentFormModal.tsx`;
domain `agent.types.ts`; backend `/api/agents` contract.

**Done when:** a standalone agent can pin a model + temperature, persisted by the backend.

**Blocked by:** backend support on the `/api/agents` contract.

---

## TD-003 — Unit tests for the three new features

**Area:** Testing · **Priority:** P2 · **Status:** open

**What:** The testing standard calls for tests with every feature. The ported
repositories, mappers, services, and hooks shipped without tests.

**Scope:** repository HTTP contracts (mock network — incl. the multipart upload
path), boundary mappers (snake_case ↔ camelCase), and react-query hook behavior
(query keys + invalidation). Mirror the web app's existing test style where useful.

**Done when:** `pnpm test` (frontend) covers the new repos/mappers/hooks and passes.

---

## TD-004 — Verify multipart Knowledge upload against the live backend

**Area:** Knowledge · **Priority:** P2 · **Status:** open

**What:** File upload posts `FormData` through the native-HTTP axios adapter, which
was hardened to drop the JSON `Content-Type` so the transport sets the multipart
boundary (`src/infrastructure/http/tauriHttpAdapter.ts`). This was not exercised
against the running backend from the dev environment.

**Done when:** a real document (pdf/txt/md/csv/docx/xlsx) uploads successfully on a
packaged macOS build and the source appears in the library.

---

## TD-005 — Client-side file validation for Knowledge upload

**Area:** Knowledge · **Priority:** P3 · **Status:** open

**What:** The upload form relies on the `accept` filter and server-side validation;
there is no client-side file-size guard. Large files fail only after the round-trip.

**Done when:** oversized/unsupported files are rejected client-side with a clear
message before upload (limit sourced from config, not hardcoded inline).

---

## TD-006 — Chat-action preferences have no consumer yet

**Area:** Configuration · **Priority:** P3 · **Status:** open

**What:** The Configuration page's "Chat actions" toggles persist to local storage
(`useChatPreferences`) but nothing reads them yet — the chat surface isn't built.

**Done when:** the chat UI honors these preferences (revisit when chat lands).
