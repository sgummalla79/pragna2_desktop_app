# Plan: Integration + E2E test suite for the desktop app (the 0%-view project)

> **Status (2026-06-10):** Approved, not yet started. No branch created, no files changed.
> **Resume at:** Phase 1 — `git checkout -b integration-e2e-tests`, scaffold the `e2e/` harness.
> **Tracked as:** pragna2-tracker TD-027 (Tiers 1 & 2 + manual doc, active) and pragna2-tracker TD-028 (Tier 3 Tauri window e2e, deferred).
>
> **Gating risk RESOLVED (verified):** seed-token auth works in browser mode.
> `AuthService.bootstrap()` (`src/application/services/AuthService.ts:45-70`) reads
> `tokenStorage.getAccessToken()` (sessionStorage keys `pragna_at` / `pragna_idt`) **first**, validates
> via `/me`, and only falls back to the Tauri keychain (`secureStore.getRefreshToken()`) when there is
> no access token. `useBootstrap` (`src/presentation/hooks/auth/useBootstrap.ts`) feeds the result into
> `authStore`, flipping `isAuthenticated`. So `e2e/global-setup.ts` need only seed sessionStorage — no
> keychain involvement in the browser. The "open risk" noted inline in Tier 2 below is therefore closed.

## Context

`pragna2_desktop_app`'s unit suite (56 files, 242 tests — pragna2-tracker TD-003, closed) thoroughly covers the
logic/data/hook layers but leaves **~10,448 LOC of view/orchestration components at 0%** — exactly
the files unit tests *shouldn't* cover (mocked-glue tautologies). The sibling web app proves the
right answer: a mature **Playwright `e2e/` sub-workspace (32 specs)** driving the real frontend
against a **real local backend stack**, plus a **`docs/MANUAL_TEST_SCENARIOS.md`** for what
automation can't reach (streaming *feel*, reduced-motion, OAuth consent, PDF fidelity).

This project brings the desktop to that bar. The user chose: **complete Mac coverage now**
(Tiers 1 & 2 + manual doc), **seed-token auth**, **full web-app parity first** then push coverage,
and a **desktop-owned manual-testing doc** mirroring the web app's. **Tier 3 (true Tauri window
e2e) is explicitly deferred** to a clearly-documented TODO — built later for Windows. The local API
(`nexus-kit-api`) runs locally for real-data testing.

Hard platform fact (verified): **official `tauri-driver` does not support macOS** (no WKWebView
WebDriver) — Windows/Linux only; community/paid macOS drivers exist but are immature. Tiers 1 & 2
run on every platform incl. the dev Mac and carry **all** the parity work; the native seam Tier 3
would cover (keychain, native HTTP, loopback OAuth) is already unit-tested, so deferring it loses no
real coverage today.

This closes a new TODO: **pragna2-tracker TD-027 — Integration/E2E test suite (Tiers 1 & 2 + manual doc)**, and
opens **pragna2-tracker TD-028 — Tier 3 Tauri window e2e (Windows), deferred**.

---

## Tier overview (Tiers 1 & 2 in scope now; Tier 3 deferred)

| Tier | Runner | macOS | Windows | Linux | What it proves |
|---|---|:--:|:--:|:--:|---|
| **1. Component-integration** | Vitest + jsdom (existing harness) | ✅ | ✅ | ✅ | View wiring, conditional render, form state, error/loading branches, mutation calls |
| **2. Browser e2e** (PRIMARY) | Playwright vs local API | ✅ | ✅ | ✅ | Real Chromium: layout/responsive gate, navigation, real streaming, real backend data — full user journeys |
| **3. Tauri window e2e** *(DEFERRED → pragna2-tracker TD-028)* | `tauri-driver` | ❌ | ✅ | ✅ | The native seam: keychain, native HTTP, loopback OAuth |
| **Manual doc** | Human | ✅ | ✅ | ✅ | Streaming cadence, reduced-motion, OAuth consent, PDF fidelity, OS drag/drop |

> The `❌` is **macOS only** — Tier 3 runs fine on **Windows** and Linux; it just can't run on the
> dev Mac. It is deferred regardless, to be built for Windows later (pragna2-tracker TD-028).

---

## Step 0 — Branch
- `git checkout -b integration-e2e-tests` (cross-cutting; not a single UI part).

---

## Tier 1 — Component-integration tests (jsdom, existing Vitest harness)

Mount the **real** 0% views with real react-query + a real (or mock) `ServiceContext`, MSW for HTTP,
and `vi.mock` for the Tauri seam. Cheap, fast, cross-platform, pushes the coverage number.

- **Shared renderer (NEW):** `src/__tests__/renderWithProviders.tsx` — wraps
  `QueryClient({retry:false})` + `ServiceContext.Provider` (mock services) + `MemoryRouter`
  (configurable `initialEntries`). Replaces the per-file inline wrappers the codebase repeats today.
- **Tauri mock seams** (per the inventory): `vi.mock('@tauri-apps/plugin-opener')` (ConnectorCard,
  AddConnectorWizard), `vi.mock('@/infrastructure/agui/TauriHttpAgent')` (chat views — return a
  scripted observable of AG-UI events), `vi.mock('@tauri-apps/api/core')` (secureStore via authStore).
- **Targets** (the inventory's 0% files, by value):
  - Chat: `ChatLandingView` (gating banner, eager-create handoff), `ChatInput` (slash popover,
    attachment chip, send/stop gating), `AttachmentViewer` (image/pdf/download branches),
    `ModelPicker`, `HITLFormCard` (dynamic fields + submit coercion).
  - Settings/Connectors: `ConnectorDetailsForm` (525 LOC — auth-type discriminator branches),
    `ConnectorCard` (toggle/refresh/archive/oauth-launch), `AddConnectorWizard` (3-step + dirty
    guard), `ConnectorsView` (oauth callback banner).
  - Settings/Flows: `FlowEditor` (hydrate→panel-select→save wiring), `NodePanel`, `ConnectorPanel`,
    `KnowledgePanel`, `FlowDetailView`, `FlowsView`.
  - Settings: `ProvidersView`, `AgentFormModal` (HTTP-status→message mapping, dirty guard),
    `AgentsView` (onboarding/default gating), `KnowledgeView`, `ConfigurationView`.
  - Auth: `RegisterView`, `LoginView`.
- **Scope line:** assert rendered output, conditional branches, and that interactions call the right
  service/hook — NOT layout or streaming timing (those are Tier 2 / manual).

---

## Tier 2 — Playwright browser e2e vs local API (PRIMARY — full web-parity)

Mirror the web app's `e2e/` sub-workspace 1:1, adapted for the desktop's browser-fallback path.

### Harness (`e2e/` — self-contained, deps NOT in root package.json)
- `e2e/package.json` (Playwright + TS only), `e2e/playwright.config.ts` (copy web app's:
  `workers:1`, `fullyParallel:false`, `baseURL` from env, trace/screenshot/video on failure,
  chromium project), `e2e/tsconfig.json`, `e2e/README.md`, `e2e/.gitignore`.
- `e2e/scripts/setup-stack.sh` / `teardown-stack.sh`: bring up throwaway Postgres (isolated port)
  → `alembic upgrade head` on `nexus-kit-api` → boot BE with `AUTH_STRATEGY=local` + seeded test user
  + seeded LLM provider/model → boot FE `pnpm dev` (browser mode → XHR fallback → local BE). Mirror
  the web app's `scripts/`. Logs to `/tmp`. Idempotent.
- **Auth = seed-token (the chosen approach):** `e2e/global-setup.ts` logs in **once** via the BE
  local-auth endpoint over HTTP → obtains JWT(s) → writes them to **`sessionStorage`** (`pragna_at`,
  `pragna_idt` per `tokenStorage.ts`) via Playwright `storageState`/init-script, so every test starts
  authenticated with **no login UI**. Faster + stabler than per-test form login.
  - ✅ **Risk resolved** (see Status header): `AuthService.bootstrap()` reads the access token from
    sessionStorage first, so seeding sessionStorage is sufficient — no keychain needed in browser mode.
    No login-UI spec is needed (user chose seed-token only).
- `e2e/helpers/` mirroring the web app: `env.ts` (URLs/ports/creds), `auth.ts` (seed helper),
  `db.ts` (psql assertions), `canvas.ts` (React Flow drag/handle reveal), `flow-author.ts`
  (editor authoring primitives), `network.ts` (response interception), `seed.ts`.
- **Selector prerequisite:** desktop has only ~17 `data-testid`s. Add `data-testid`s (kebab-case,
  matching the web app's vocabulary: `edge-panel`, `dispatch-toggle`, `connector-panel`,
  `connector-pick-${id}`, `knowledge-panel`, `thinking-strip`, `document-card`, …) to the view roots
  + action elements the specs target, as each spec is written. Prefer `getByRole`/`getByText` first;
  `data-testid` only where role/text is ambiguous (React Flow canvas especially).

### Spec parity (port all 32, grouped as the web app does)
- **Chat (7):** plain-chat stream, chat+ask_user form (HITL), slash-flow dispatch, revise loop,
  nav-away-and-resume, hard-refresh-mid-stream, multi-tab, rapid-switching.
- **Flow editor (9):** core editor (mount/palette/add-node/drag-edge/validate/YAML/save round-trip/
  delete cascade), pipeline, triage decision-router, plan-and-do, two-stage form, aggregator fan-out,
  dispatch authoring + badge, dispatch mutex, flow-design drag/palette probes.
- **Documents (3):** create_pdf + canvas reader + download, deterministic render cross-check,
  create_pdf_long async.
- **Connectors + knowledge (6):** MCP connector node author, connectors-settings manage, agent↔
  connector attach, knowledge library manage, agent↔knowledge attach, knowledge node author.
- **Design/regression (2):** settings sidebar tighten, sketchon diagram render.
- **Real-LLM gating:** specs needing a live model **auto-skip** unless provider keys are present
  (mirror the web app's `/tmp/e2e-keys.env` convention) — authoring-only specs run keyless.

---

## Tier 3 — True Tauri window e2e (DEFERRED — pragna2-tracker TD-028, build for Windows later)

- **Not built in this project.** Recorded as **pragna2-tracker TD-028** with clear documentation so it can be picked
  up cleanly later. The intended shape when built: a `tauri-driver` + WebdriverIO (or
  `@crabnebula/tauri-driver`) harness under `e2e-tauri/`, run on **Windows** (and Linux), covering the
  native seam the browser tier can't reach — keychain persistence (`secureStore`), native HTTP
  (`tauriHttpAdapter`), loopback OAuth (`tauriLoopbackAuthFlow`).
- **Why safe to defer:** those seams are already **unit-tested**, and the manual doc covers their
  user-visible behavior. So Tiers 1 & 2 + the manual doc give complete practical coverage on the Mac
  today; Tier 3 is a future hardening layer, not a gap.
- **pragna2-tracker TD-028 documentation must state:** the macOS limitation (no WKWebView WebDriver in official
  `tauri-driver`), that it targets Windows/Linux, the exact seams it covers, and the candidate
  tooling — so a future session needs no re-research.

---

## Manual testing doc (desktop-owned)

- **NEW `docs/MANUAL_TEST_SCENARIOS.md`**, mirroring the web app's M1–M9 format
  (`## M<n> — title`, **Why manual**, **Prerequisites**, **Steps**, **Checks** checkboxes, **Tuning
  reference**). Seed it with the desktop's can't-automate set: smooth streaming reveal cadence,
  reduced-motion OS preference, reasoning timeline, generated-PDF visual fidelity, MCP OAuth 2.1
  consent (system browser + loopback — Tauri-only), flow YAML export/import (OS file dialogs/clipboard),
  knowledge retrieval runtime, **plus desktop-specific:** keychain "stay signed in" across app
  restart, native window resize/responsive feel, system-browser social login.
- **Rule:** any behavior a spec author finds un-automatable in Playwright gets an `M<n>` entry here
  (the doc is the explicit home for the coverage that tooling can't reach).

---

## Files (created/changed)

- `e2e/**` (new sub-workspace: config, scripts, helpers, 32 specs, README) — biggest surface.
- `src/__tests__/renderWithProviders.tsx` (new shared renderer) + Tier-1 `*.test.tsx` co-located
  with each view.
- `src/**` view components: additive `data-testid` attributes only (no behavior change).
- `docs/MANUAL_TEST_SCENARIOS.md` (new).
- pragna2-tracker: open **pragna2-tracker TD-027** (Tiers 1 & 2 + manual doc); open **pragna2-tracker TD-028** (Tier 3, deferred,
  with the documentation above). `CLAUDE.md` Commands: add `e2e` run instructions.
- *(No `e2e-tauri/**` in this project — that's pragna2-tracker TD-028.)*
- Spec pair per CLAUDE.md gate: `docs/specs/features/integration-e2e-tests.md` +
  `docs/specs/technical/integration-e2e-tests.md`.

## Sequencing (phased commits, each green)
1. **Harness + auth-seed proof** — `e2e/` skeleton + setup scripts + global-setup; prove ONE smoke
   spec (seeded token → land on `/chat`) green against the local stack. Resolves the authStore risk.
2. **Tier 1 component-integration** — shared renderer + view tests; report new coverage %.
3. **Tier 2 parity** — port the 32 specs in the 5 groups, adding `data-testid`s as needed.
4. **Manual doc** — author `MANUAL_TEST_SCENARIOS.md` from the un-automatable residue.
5. Docs: close-out **pragna2-tracker TD-027**, open **pragna2-tracker TD-028** (deferred Tier 3, fully documented), spec pair,
   CLAUDE.md commands.

## Verification
- `pnpm test:run` green incl. new Tier-1 tests; `pnpm test:coverage` shows the lifted number
  (report-only). `pnpm build` stays clean (test files excluded from `tsc`).
- `cd e2e && pnpm setup && pnpm test` → green against the local API; traces/screenshots on failure.
- Real-LLM specs skip cleanly with no keys; run fully with `/tmp/e2e-keys.env` present.
- Manual doc: each `M<n>` walked once by hand on a `pnpm tauri dev` build.

## Out of scope
- Visual-regression/snapshot pixel diffing. Multi-provider sweep automation (anthropic/openai/google)
  beyond documenting the keyed run. macOS true-window e2e until a viable WKWebView driver lands.

---

## Reference: web app source to mirror
- Playwright suite: `pragna2_sgummalla_works/e2e/` (32 specs, `playwright.config.ts`, `helpers/`,
  `scripts/setup-stack.sh` + `teardown-stack.sh`, `auth-strategy-switch.patch`).
- Manual doc format: `pragna2_sgummalla_works/docs/MANUAL_TEST_SCENARIOS.md` (M1–M9).
- Companion: `pragna2_sgummalla_works/docs/FRONTEND_TEST_SCENARIOS.md`.
- Local backend stack: `nexus-kit-api` (`stack.sh`, `dev.sh`, `serve.sh`, `db.sh`; `AUTH_STRATEGY=local`
  in `src/config.py` / `src/infrastructure/auth/factory.py`).
