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

### Responsive Design — Required Before Every Commit
- **Every UI page/screen MUST be built as a responsive web design.** Layouts must adapt
  gracefully across all viewport sizes — a narrow/resized desktop window, small displays, and
  large/wide displays alike. Use fluid layouts and responsive units; no fixed widths that overflow
  or clip; content must stay readable and usable down to narrow widths.
- **This is a strict pre-commit gate.** Before committing any change that touches UI, verify the
  affected pages render and remain usable from narrow → wide widths. Do not commit UI that breaks
  or overflows at smaller sizes.

### Error Handling
- Explicit error handling everywhere — no silent fallbacks, no swallowed errors, no untyped rejections.
- Use typed error enums per layer; propagate with `?` and convert at layer boundaries.

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

## Deferred Work — `docs/TODO.md`
- **Do not leave free-floating `TODO`/`FIXME` notes in code.** Record deferred work
  as an entry in [`docs/TODO.md`](docs/TODO.md) with a stable ID, and reference that
  ID from the code (e.g. `// see docs/TODO.md TD-001`).
