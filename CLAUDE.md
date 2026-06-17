# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`pragna2_desktop_app` is a Tauri 2 desktop application — React + TypeScript frontend (Vite) with a Rust backend.

## Commands

```sh
pnpm install          # install frontend dependencies
pnpm tauri dev        # run in dev mode with hot reload (opens desktop window)
pnpm tauri build      # production build
pnpm dev              # frontend only (no Tauri shell)

pnpm test             # frontend unit tests (Vitest, watch)
pnpm test:run         # frontend unit tests once (CI)
pnpm test:coverage    # unit tests + istanbul coverage report (report-only, no gate)

cargo test --manifest-path src-tauri/Cargo.toml          # run all Rust tests
cargo test --manifest-path src-tauri/Cargo.toml <name>   # run a single test
cargo clippy --manifest-path src-tauri/Cargo.toml        # lint Rust
cargo fmt --manifest-path src-tauri/Cargo.toml           # format Rust
```

End-to-end browser tests live in the isolated `e2e/` sub-workspace (Playwright,
installed with **npm** — NOT in the root pnpm workspace). They drive the FE in
browser-fallback mode against a real local backend stack. See `e2e/README.md`.

```sh
cd e2e
npm install                       # one-time
npx playwright install chromium   # one-time (~100 MB)
npm run setup                     # spin Postgres + BE (local-auth) + FE; seed user/model
npm test                          # run the Playwright suite (seed-token auth, no login UI)
npm run teardown                  # stop processes + drop the throwaway DB container
```

## Architecture

Follows **Clean Architecture** with strict layer boundaries:

```
Domain  →  Application Use Cases  →  Adapters
```

- **Domain** (`src-tauri/src/domain/`): Core entities, value objects, domain errors. No dependencies on outer layers.
- **Application** (`src-tauri/src/application/`): Use cases and ports (traits). Depends only on Domain.
- **Adapters** (`src-tauri/src/adapters/`): Tauri commands, repository implementations, external integrations. Depends on Application ports.

Frontend lives in `src/` — React components call Tauri commands via `@tauri-apps/api/core` `invoke()`.

```
src/                        ← React + TypeScript (Vite)
  main.tsx
  App.tsx
src-tauri/
  src/
    domain/mod.rs
    application/mod.rs
    adapters/mod.rs
    lib.rs                  ← mod declarations + Tauri builder
    main.rs                 ← binary entry point
  Cargo.toml
  tauri.conf.json
```

## Engineering Rules

### No Hallucination — Discuss Every Decision
- **Never invent, guess, or assume.** If a value, API, file, or behavior is not verified in the
  code, the repo, or an authoritative source, do not fabricate it — go and confirm it.
- **Surface every non-trivial decision and discuss it with the user before implementing.** When a
  task involves a structural choice, an ambiguous requirement, or a trade-off, present the options
  (with pros/cons) and get a decision rather than picking silently. Reasonable defaults may be
  stated and used only for genuinely trivial choices.

### Branch Per UI Part
- **Start each new UI feature/part on its own git branch** (e.g. `settings-providers`). Never build a
  new UI area directly on `main`. Branch first, implement, then commit/push/merge when the user asks.

### Git Branch & Release Workflow — STANDING RULE (all 3 repos)

This is the authoritative, machine-independent branching/release process. It is checked into the
repo on purpose so it applies on **every** machine, not just the one where it was first set up. It
governs **all three repos identically**: `pragna2-api` (backend), this Desktop FE
(`pragna2_desktop_app`), and the web FE (`pragna2_sgummalla_works`).

1. **Branch off `Releases/V1`.** For **any** fix or **any** feature, create a new branch **from
   `Releases/V1`** (not `main`) and do the work there. Never commit work directly onto `Releases/V1`
   or `main`.
2. **Test against the Docker `pragna2-api`.** Before the work is considered done, verify it against
   `pragna2-api` running from its Docker container. A change is not "done" until it has been
   exercised against that real backend.
3. **Do NOT commit + push + merge until the user explicitly says so.** Finishing and testing the
   work does **not** grant permission to commit. Wait for an explicit "commit" / "push" / "merge"
   instruction. (Reinforces the global no-auto-commit rule.)
4. **Merge target is `Releases/V1`.** When the user authorizes it, commit → push → merge the feature
   branch **back into `Releases/V1`**.
5. **Cherry-pick to `main` after merge.** Only **after** the change has been committed + pushed +
   merged into `Releases/V1` are those changes cherry-picked onto `main`. `main` is never the place
   work originates.
6. **Delete the branch after merge.** Once merged + pushed, delete the feature branch both locally
   and on the remote (`git branch -d <b>` + `git push origin --delete <b>`).

This standing rule stays in force until the user explicitly changes it.

### Sync Latest Before Starting Work — STANDING RULE (all 3 repos)

This is an authoritative, machine-independent rule, checked into the repo on purpose so it applies on
**every** machine where these repos are cloned and worked. It governs **all three repos identically**:
`pragna2-api` (backend), this Desktop FE (`pragna2_desktop_app`), and the web FE
(`pragna2_sgummalla_works`).

**Always fetch + sync the latest remote state BEFORE starting any code change.** These repos are worked
on more than one machine and by more than one teammate, so the local clone is routinely stale — work
started on a stale base produces avoidable merge conflicts and silent regressions (re-fixing something
already fixed, or building on code that has since changed).

1. **Fetch before branching.** Before creating the feature branch, run `git fetch origin` and base the
   branch on the **freshly-fetched** `origin/Releases/V1` (`git checkout -b <branch> origin/Releases/V1`),
   never on a local tip that may be behind.
2. **Confirm you are current.** Verify the branch base equals `origin/Releases/V1`
   (`git rev-parse HEAD` vs `git rev-parse origin/Releases/V1`, or `git log HEAD..origin/Releases/V1`
   is empty). If `Releases/V1` advanced after you branched, rebase the feature branch onto the latest
   `origin/Releases/V1` before continuing.
3. **Re-fetch before push/merge.** Immediately before the authorized commit → push → merge, fetch again
   and rebase if needed, so the merge target is still current.

This standing rule stays in force until the user explicitly changes it.

### No Cross-Repo Changes — STANDING RULE (all 3 repos)

This is an authoritative, machine-independent rule, checked into the repo on purpose so it applies on
**every** machine where these repos are cloned and worked, not just the one where it was first set up.
It governs **all three repos identically**: `pragna2-api` (backend), this Desktop FE
(`pragna2_desktop_app`), and the web FE (`pragna2_sgummalla_works`).

**A session stays in its repo lane. Never make changes outside the repo the session is about.**

- **If the session is about this Desktop FE, only Desktop-FE changes may be made.** Do not edit the
  backend or the web FE — not their code, tests, docs, or config.
- **If the session is about `pragna2-api`, only `pragna2-api` changes may be made.**
- **If the session is about the web FE, only web-FE changes may be made.**

When work in one repo *implies* a change in another (e.g. an FE session reveals the backend needs a
matching change, or vice-versa), **do not make that change.** Instead, surface it explicitly and
record it as a tracked item (the cross-project tracker / a bug report), so the owning repo's own
session picks it up. The only permitted exception is an **explicit, one-time user instruction** to
bootstrap a shared governance change (such as recording this very rule) into the other repos.

Rationale: the three repos are independent deployables on separate release lines; a session that
silently touches a sibling repo produces untested, unreviewed drift in a project the session was not
scoped to verify.

This standing rule stays in force until the user explicitly changes it.

### Responsive Design — Required Before Every Commit
- **Every UI page/screen MUST be built as a responsive web design.** Layouts must adapt
  gracefully across all viewport sizes — a narrow/resized desktop window, small displays, and
  large/wide displays alike. Use fluid layouts and responsive units; no fixed widths that overflow
  or clip; content must stay readable and usable down to narrow widths.
- **This is a strict pre-commit gate.** Before committing any change that touches UI, verify the
  affected pages render and remain usable from narrow → wide widths. Do not commit UI that breaks
  or overflows at smaller sizes.

### Platform Abstraction — Strict Rule

All platform-specific code (OS detection, OS API wrappers, platform-conditional behaviour) must live in dedicated platform layers. **Never scatter platform checks across business or infrastructure code.**

- **Frontend:** `src/infrastructure/platform/` is the **only** entry point for platform concerns.
  No other file may define `isTauriRuntime()` or reference OS-specific APIs directly.
  Import `isTauriRuntime` and OS store wrappers exclusively from `@/infrastructure/platform`.
- **Gate OS-conditional UI on the RUNTIME, not just the OS.** Any branch that renders
  Tauri-native chrome or layout (custom title bar, window-control buttons,
  `decorations:false`-dependent geometry) **must** use a predicate that includes
  `isTauriRuntime()` — e.g. `usesWindowsChrome()` (= `isWindowsPlatform() && isTauriRuntime()`) —
  **never** a bare OS check like `isWindowsPlatform()` alone. A plain browser can report *any*
  OS in its user-agent (the e2e `Desktop Chrome` device sends a **Windows** UA), so UA-only
  gating renders Tauri-native chrome with no Tauri runtime present. See **CF-011**.
- **Never call a Tauri-only API at component render time without an `isTauriRuntime()` guard.**
  `getCurrentWindow()`, window controls, native HTTP, etc. throw in a plain browser (no
  `__TAURI_INTERNALS__`). Guard the call inside an `isTauriRuntime()`-checked effect, and
  early-return / no-op in the render path, so the browser-fallback (e2e, dev) and any plain
  browser on Windows never reach an unguarded Tauri call. Unguarded Tauri-at-render crashes the
  whole React tree (blank page) — this is exactly CF-011.
- **Enforcement:** `pnpm lint:platform` (CI gate, `scripts/check-platform-abstraction.mjs`) fails
  if `navigator.userAgent` / `navigator.platform` / `__TAURI_INTERNALS__` appear **outside**
  `src/infrastructure/platform/`. Run it before committing any platform-touching change. New
  platform predicates get a 4-cell OS × runtime truth-table test (see
  `src/infrastructure/platform/runtime.test.ts`); Windows-chrome layout branches get a component
  test mocking the predicate both ways (the e2e suite can NOT cover the Windows layout — see below).
- **Tauri config:** Platform-conditional window and bundle settings **must** live in
  `tauri.macos.conf.json` (macOS) and `tauri.windows.conf.json` (Windows).
  `tauri.conf.json` must contain only settings that are identical across all supported platforms.
- **Rust:** Any `#[cfg(target_os = …)]` / `#[cfg(windows)]` code must be isolated in
  `src-tauri/src/platform/`. No platform `cfg` attributes in `lib.rs` or the
  domain / application / adapters layers.

**Why:** Scattered platform checks make it easy to miss a case when adding Linux, break
silently on cross-platform regression, and hard to audit what actually differs between OSes.
A dedicated layer means: one place to read, one place to change, one place to test.

### Error Handling
- Explicit error handling everywhere — no silent fallbacks, no swallowed errors, no untyped rejections.
- Use typed error enums per layer; propagate with `?` and convert at layer boundaries.

### Document Every Bug Fix
- **Whenever you fix a bug (correct broken behavior — not add a feature), you MUST log it in
  [`docs/CODE_FIXES.md`](docs/CODE_FIXES.md)** before moving on. Each entry records: the date, the
  area/file, **the bug + its root cause**, **the fix**, and **whether the sibling web app
  (`pragna2_sgummalla_works`) likely has the same bug** and should get the same fix.
- **Why:** the desktop and web app share architecture and components, so a defect found on one side
  very often exists on the other. The fix log is the hand-off the team uses to apply the same fix to
  the web app. An undocumented fix means the web-app side silently keeps the bug.

### Coding Conventions
- Descriptive naming mirroring existing repository conventions.
- Docstrings required for all exported functions, traits, and domain types.
- Single-responsibility functions — split multi-step logic into smaller, named units.
- **No hard coding** — all constants, configs, and environment values must be externalized.

### SOLID Principles
- **S**: One reason to change per module/struct.
- **O**: Extend via new types/traits, not by modifying existing ones.
- **L**: Subtypes must be substitutable for their supertypes.
- **I**: Small, focused traits — no fat interfaces.
- **D**: Depend on abstractions (traits); inject concrete implementations.

### Testing Standards
- Every new feature and refactor ships with unit tests.
- Explicit assertions covering edge cases, boundary values, and validation rules.
- Mock all network I/O, database connections, and file system access.
- `cargo test` must pass before any PR is merged.

### AI / Pair-Programming Workflow
- **Before any multi-file change or complex refactor**: lay out the plan with architectural tradeoffs and verification criteria first. Discuss proposed patterns before coding.
- Present concrete options (with pros/cons) whenever structural decisions are needed.

## Documentation Requirements

Every feature requires **two spec documents**, created before implementation and updated after:

| Document | Location | Purpose |
|---|---|---|
| Feature Spec | `docs/specs/features/<feature-name>.md` | User-facing behavior, acceptance criteria, edge cases |
| Technical Spec | `docs/specs/technical/<feature-name>.md` | Architecture decisions, every method signature + docstring, data flow, error handling strategy |

Use the templates in `docs/specs/templates/` as the starting point for each new spec.

### Spec Docs — Required Before Every Commit
- **This is a strict pre-commit gate, alongside the responsive-design gate.** A
  feature may not be committed unless **both** its spec documents exist
  (`docs/specs/features/<name>.md` and `docs/specs/technical/<name>.md`) and match
  the implementation as shipped.
- Before any commit that adds or changes a feature, verify the two specs are
  present and up to date. If they are missing or stale, write/update them first —
  do not commit code ahead of its specs.

## Deferred Work — the cross-project tracker
- **Do not leave free-floating `TODO`/`FIXME` notes in code.** Record deferred work
  as an issue in the cross-project tracker (GitLab `sgummalla79/pragna2-tracker`,
  `type:tech-debt`/`type:feature`, `target:desktop-fe`) and reference it from the code
  by a short, resolvable pointer (e.g. `// see pragna2-tracker TD-001`). A code comment
  may document a *current limitation* at the call site as long as it links to the
  tracked item — that is documentation, not an untracked TODO. (The former
  `docs/TODO.md` backlog was migrated into the tracker on 2026-06-15; its `TD-NNN`
  ids are preserved as issue titles + `fp:desktop-td-NNN` labels, so they still
  resolve by search.)
