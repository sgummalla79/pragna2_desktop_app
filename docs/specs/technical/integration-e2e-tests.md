# Technical Spec: Integration + E2E Test Suite

> **Status**: Implemented (harness + Tier 1 + Tier 2 + manual doc)
> **Author**: Suman Gummalla
> **Created**: 2026-06-10
> **Last Updated**: 2026-06-10

---

## 1. Overview

Two test layers exercise the real views. **Tier 1** runs in the existing Vitest
+ jsdom harness: a shared `renderWithProviders` mounts real view components with
a retry-off TanStack Query client, the `ServiceContext` DI container holding
caller-supplied mock services, and a `MemoryRouter`. **Tier 2** is a
self-contained `e2e/` Playwright sub-workspace that drives the desktop frontend
in **browser-fallback mode** (Vite dev server, XHR transport) against a real
local backend stack, authenticated by a **seed token** injected into
sessionStorage. Neither layer requires a Tauri runtime.

## 2. Architecture & Layer Placement

- **Domain / Application**: none — no production logic changes. Tier 1 mocks
  application services through the existing `ServiceContext` port.
- **Adapters / Presentation**: test-only additions. `renderWithProviders`
  composes the same providers `ServiceProvider` wires in production. Tier 2
  relies on the existing browser-fallback paths already in the adapters: the
  axios client's default XHR adapter (non-Tauri), `tokenStorage` reading
  sessionStorage, and `Auth0Repository.me()` decoding the ID token locally
  (`userFromIdToken`) before any network call.

## 3. Data Flow

Tier 1 (component-integration):
```
test → renderWithProviders(view, {services}) → <QueryClientProvider><ServiceContext><MemoryRouter> view → user-event → assert(mockService called | branch rendered)
```

Tier 2 (browser e2e), auth seed path:
```
global-setup → POST /api/auth/sessions (local BE) → access JWT
            → mint unsigned ID token {sub,email,name} → write .auth/tokens.json
fixture.page → addInitScript(sessionStorage[pragna_at|pragna_idt]) → goto(/chat)
            → useBootstrap → AuthService.bootstrap() → tokenStorage.getAccessToken()
            → Auth0Repository.me() → userFromIdToken(idToken)  (NO network)
            → authStore.isAuthenticated = true → ProtectedRoute renders
```

## 4. Module & File Layout

```
src/__tests__/
  renderWithProviders.tsx          # shared Tier-1 renderer (+ .test.tsx)
src/presentation/views/**/*.test.tsx   # 22 co-located Tier-1 view tests
e2e/
  package.json                     # Playwright + TS only (npm, isolated)
  playwright.config.ts             # baseURL :1420, globalSetup, workers:1
  tsconfig.json  .gitignore  README.md
  global-setup.ts                  # mint seed token → .auth/tokens.json
  fixtures.ts                      # authenticated `test`/`expect`
  helpers/
    env.ts                         # FE/BE/API URLs, ports, creds, token keys
    tokens.ts                      # mint + read/write the seed token pair
  scripts/
    setup-stack.sh  teardown-stack.sh  seed-model.sh
  tests/
    smoke-auth.spec.ts             # Phase-1 seed-token proof
```

## 5. Method Specifications

### `renderWithProviders.tsx`

#### `renderWithProviders(ui: ReactElement, options?: RenderWithProvidersOptions): RenderResult & { queryClient }`

| Field        | Detail |
|--------------|--------|
| **Purpose**  | Mount a real view in the standard provider stack for component-integration tests |
| **Inputs**   | `ui` — element under test; `options.services` (Partial<Services> mock), `options.initialEntries` (router, default `['/']`), `options.queryClient` (reuse across rerender) |
| **Output**   | Testing-Library `RenderResult` plus the `queryClient` |
| **Errors**   | None thrown directly; a view reading an unmocked service throws via `useServices` (intentional) |
| **Side Effects** | Renders into jsdom |
| **Invariants** | Services cast through `unknown` (a Partial is not a complete `Services`); router + query context always present |

#### `makeTestQueryClient(): QueryClient`

| Field | Detail |
|-------|--------|
| **Purpose** | A `QueryClient` with `queries.retry=false` and `mutations.retry=false` so failures surface immediately and error assertions are deterministic |
| **Output** | Configured `QueryClient` |

### `e2e/helpers/tokens.ts`

#### `mintSeedTokens(): Promise<SeedTokens>`

| Field | Detail |
|-------|--------|
| **Purpose** | Log in once against the local BE and mint the seed pair |
| **Inputs**  | none (reads `API_BASE_URL` + `TEST_USER` from `env.ts`) |
| **Output**  | `{ accessToken, idToken }` — real local-BE access JWT + an unsigned decodable ID token carrying `sub`/`email`/`name` |
| **Errors**  | Throws on non-2xx from `POST /api/auth/sessions` or a missing `access_token` |
| **Side Effects** | One HTTP POST to the local BE |
| **Invariants** | The ID token `sub` is taken from the access token's `sub` so the FE-displayed identity matches the API identity |

#### `writeTokens(t) / readTokens(): SeedTokens`

| Field | Detail |
|-------|--------|
| **Purpose** | Persist (global-setup) / load (fixture) the minted pair via `.auth/tokens.json` |
| **Errors** | `readTokens` throws with a "run setup first" hint if the file is absent |

### `e2e/fixtures.ts`

#### `test` (extends base `page`)

| Field | Detail |
|-------|--------|
| **Purpose** | Inject the seed token into sessionStorage before any page script runs |
| **Side Effects** | `page.addInitScript` sets `pragna_at` + `pragna_idt` |
| **Invariants** | Uses `addInitScript` (not `storageState`, which can't carry sessionStorage) |

## 6. Error Handling Strategy

| Error | Layer | Propagation |
|-------|-------|------------|
| Seed login non-2xx | e2e global-setup | Thrown → aborts the whole Playwright run with a clear message |
| Missing `.auth/tokens.json` | e2e fixture | Thrown with a "global-setup must run first" hint |
| Unmocked service in a Tier-1 test | presentation | `useServices` throws — surfaces the forgotten mock |
| BE 401 on a real call (stale seed) | adapters | `authInterceptor` clears tokens + redirects to `/login` |

## 7. Configuration & Constants

| Constant | Source | Description |
|----------|--------|-------------|
| `FE_URL` / `BE_URL` / `API_BASE_URL` | `E2E_*` env, defaults in `helpers/env.ts` | FE :1420 (vite strictPort), BE :8000, API root incl. `/api` |
| `PG_CONTAINER` / `TEST_DB` / ports | `E2E_*` env / `setup-stack.sh` | Throwaway Postgres `pragna-desktop-e2e` on :5433 |
| `TOKEN_KEYS` | `helpers/env.ts` | `pragna_at` / `pragna_idt` — must match `src/infrastructure/storage/tokenStorage.ts` |
| `TEST_USER` | `helpers/env.ts` | `verify@example.com` / `VerifyTest123!` |
| Postgres image | `setup-stack.sh` | `pgvector/pgvector:pg16` (BE migrations `CREATE EXTENSION vector`) |
| Provider keys | `/tmp/e2e-keys.env` (`E2E_KEYS_FILE`) | Optional real-LLM keys; specs skip without them |

## 8. Testing Plan

| Test | Type | What It Verifies |
|------|------|-----------------|
| `renderWithProviders.test.tsx` | unit | Renderer injects services + router; returns client |
| `smoke-auth.spec.ts` | e2e | Seeded token → authenticated `/chat`; unseeded → `/login` |
| 22 co-located view `*.test.tsx` | integration | Loading/error/empty/gating branches + interactions call the right service/hook |
| ported parity specs (Tier 2) | e2e | Real user journeys vs. local backend — 29 passed, 11 skipped (LLM-gated), 0 failed |

### Tier 2 helpers (`e2e/helpers/`)
`db.ts` (psql seeding/asserts via the throwaway container), `network.ts` (intercept the FE's own
API responses), `canvas.ts` (React Flow handle-reveal + drag tricks), `flow-author.ts` (seed/open a
flow, drop-from-palette, configure agent, save), `seed.ts` + `scripts/seed_pdf_conversation.py` (run
the BE's real create_pdf render path, no LLM). Minimal `data-testid`s added to flow + chat source
(e.g. `edge-panel`, `dispatch-toggle`, `dispatch-badge`, `decision-panel`, `thinking-strip`,
`tool-call-badge`, and `data-role` on chat message containers).

## 9. Dependencies & External Integrations

- `e2e/` dev-deps (isolated, npm): `@playwright/test`, `@types/node`,
  `typescript`. Chromium via `npx playwright install chromium`.
- Local stack: Docker (pgvector Postgres), `uv` (BE), the `nexus-kit-api` repo,
  the desktop FE dev server. No new root dependencies.

## 10. Open Questions / Risks

- [ ] ReactFlow + Radix Select are not reliably driveable in jsdom — their full
      interaction coverage lives in Tier 2 (browser), not Tier 1.
- [ ] Tier 2 selector strategy: add `data-testid`s to source only where
      role/text is ambiguous (React Flow canvas especially).

---

_Link to Feature Spec: [features/integration-e2e-tests.md](../features/integration-e2e-tests.md)_
