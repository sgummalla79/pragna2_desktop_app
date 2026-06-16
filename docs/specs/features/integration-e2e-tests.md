# Feature Spec: Integration + E2E Test Suite

> **Status**: Implemented (harness + Tier 1 + Tier 2 + manual doc)
> **Author**: Suman Gummalla
> **Created**: 2026-06-10
> **Last Updated**: 2026-06-10

---

## 1. Overview

The desktop app's unit suite thoroughly covers the logic/data/hook layers but
left the view/orchestration components at ~0% — the integration glue that unit
tests shouldn't cover with mocked tautologies. This feature brings the desktop
to the sibling web app's testing bar with two layers that exercise the real
views: **Tier 1** component-integration tests (Vitest + jsdom — real views,
mock services, fast and cross-platform) and **Tier 2** browser end-to-end tests
(Playwright driving the real frontend against a real local backend). A
desktop-owned `docs/MANUAL_TEST_SCENARIOS.md` captures what automation can't
reach. True Tauri-window e2e (the native seam) is explicitly deferred to a
documented TODO (pragna2-tracker TD-028) because the official `tauri-driver` has no macOS
support.

## 2. Goals & Non-Goals

**Goals**
- [x] A self-contained `e2e/` Playwright sub-workspace driving the desktop FE in
      browser-fallback mode against a real local stack, with seed-token auth.
- [x] A reusable `renderWithProviders` test renderer that mounts real views with
      the standard provider stack and caller-supplied mock services.
- [x] Tier 1 component-integration tests for the high-value 0%-coverage views,
      lifting total coverage above the web app's ~46%.
- [x] Tier 2: port the web app's Playwright specs (chat, flow editor,
      documents, connectors/knowledge, sketchon). Full suite: 29 passed, 11
      skipped (LLM-gated), 0 failed.
- [x] `docs/MANUAL_TEST_SCENARIOS.md` for the un-automatable residue.

**Non-Goals**
- True Tauri-window e2e (keychain, native HTTP, loopback OAuth) — deferred to
  pragna2-tracker TD-028 (Windows/Linux only; no official macOS WKWebView driver).
- Visual-regression / pixel snapshot diffing.
- Automated multi-provider LLM sweeps beyond the documented keyed run.

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| developer | run `npm run setup && npm test` in `e2e/` | I can verify real user journeys against a real backend locally |
| developer | mount any view in a test with one helper | I don't re-write the provider wrapper per file |
| reviewer | see view branches (loading/error/empty/gating) covered | regressions in the orchestration layer are caught pre-merge |
| developer | seed an authenticated session with no login UI | e2e specs start fast and stable |

## 4. Acceptance Criteria

- [x] Given the stack is up, when a seeded token is injected, then the app boots
      straight into authenticated `/chat` without a login screen.
- [x] Given no seeded token, when navigating to a protected route, then the app
      redirects to `/login`.
- [x] Given a view test, when it mounts a real view via `renderWithProviders`,
      then only the services it declares are available (an unmocked service
      throws — a forgotten-mock signal).
- [x] Given the full unit suite runs, then it is green and total coverage is
      above ~46% (achieved: ~56% lines).
- [x] Given the Tier 2 suite runs against the local stack, then the ported
      parity specs pass (authoring specs keyless; LLM specs skip without keys).
- [x] The Tier 2 suite caught two real defects (CF-001 Select-behind-overlay;
      CF-002 missing `process.env` shim) — both fixed; see `docs/CODE_FIXES.md`.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Stack not up when `globalSetup` runs | Seed login throws with a clear message; the whole run aborts rather than every spec failing confusingly |
| Seed token present but stale/invalid | `me()` decode still yields a user for display; real API calls 401 → auth interceptor clears + redirects |
| A view test forgets to mock a service it reads | `useServices` throws — surfaces the missing mock immediately |
| Radix `Select` interaction in jsdom | Asserted in closed/trigger state or the Select module is mocked (jsdom infinite-loop) |
| ReactFlow canvas in jsdom | Canvas surface mocked; only mount/hydrate/save wiring asserted (full canvas → Tier 2) |
| LLM key absent | Runtime-LLM specs self-skip with a clear reason; authoring-only specs still run |

## 6. Out of Scope

- Tauri-window automation (pragna2-tracker TD-028), visual regression, CI wiring, parallel
  multi-worker DB sharding (the suite serializes on one DB for now).

## 7. Open Questions

- [ ] Which subset of the 32 web-app specs require `data-testid` additions to
      desktop source vs. role/text selectors (decided per-spec during Tier 2).

---

_Link to Technical Spec: [technical/integration-e2e-tests.md](../technical/integration-e2e-tests.md)_
