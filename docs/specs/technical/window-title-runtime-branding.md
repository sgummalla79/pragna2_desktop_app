# Technical Spec: Runtime-Branded Native Window Title

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-21
> **Last Updated**: 2026-06-21
> **Tracker**: pragna2-tracker #175 (`enhancement`, `target:desktop-fe`)

---

## 1. Overview

Set the native OS window title at runtime from the resolved brand name. A new
platform-layer function (`setNativeWindowTitle`) wraps the Tauri window API behind an
`isTauriRuntime()` guard; a thin startup hook (`useBrandWindowTitle`) calls it once with
`APP_NAME`. No static config or Rust changes.

## 2. Architecture & Layer Placement

- **Domain**: unchanged.
- **Application**: unchanged.
- **Infrastructure / Platform** (`src/infrastructure/platform/`): new `window.ts` module
  exposing `setNativeWindowTitle`. This is the only place that imports the Tauri window
  API for the title, keeping the platform concern inside the platform layer (per the
  Platform Abstraction rule). Re-exported from `platform/index.ts`.
- **Presentation**: new `useBrandWindowTitle` hook; wired into `BootstrapGate` in
  `App.tsx`. The hook depends on the abstraction (`setNativeWindowTitle`), not on Tauri
  directly (Dependency Inversion).

### Why runtime, not static config / overlay

`scripts/apply-branding.mjs` deliberately does not overlay the per-window `title`: Tauri
replaces the whole `windows` array on config merge, which would wipe the platform
`titleBarStyle` / `decorations` settings. Setting the title at runtime sidesteps that
merge entirely and reuses the brand name the FE already resolves (`APP_NAME`), avoiding a
second brand-name plumbing path into Rust.

## 3. Data Flow

```
App() -> <BootstrapGate> -> useBrandWindowTitle()
  -> useEffect(once) -> setNativeWindowTitle(APP_NAME)
       -> isTauriRuntime() ? getCurrentWindow().setTitle(APP_NAME) : no-op
```

`APP_NAME` precedence (unchanged, from `src/constants/api.ts`):
`__BRAND_NAME__` (overlay) → `VITE_APP_NAME` (env) → `'Pragna'` (default).

## 4. Module & File Layout

```
src/
  infrastructure/platform/
    window.ts              # setNativeWindowTitle (NEW)
    window.test.ts         # unit test (NEW)
    index.ts               # re-export setNativeWindowTitle
  presentation/hooks/
    useBrandWindowTitle.ts # startup hook (NEW)
  App.tsx                  # BootstrapGate calls useBrandWindowTitle()
docs/specs/
  features/window-title-runtime-branding.md
  technical/window-title-runtime-branding.md
```

## 5. Method Specifications

### `infrastructure/platform/window.ts`

#### `setNativeWindowTitle(title: string): Promise<void>`

| Field        | Detail |
|--------------|--------|
| **Purpose**  | Set the native OS window title at runtime |
| **Inputs**   | `title: string` — the title to apply (typically the resolved brand name) |
| **Output**   | `Promise<void>` — resolves after the title is set (or immediately when not in Tauri) |
| **Errors**   | Propagates a rejection from `setTitle` to the caller; the hook logs and swallows it |
| **Side Effects** | Calls `getCurrentWindow().setTitle(title)` — Tauri IPC — only inside the runtime |
| **Invariants** | No Tauri API is touched unless `isTauriRuntime()` is true (CF-011) |

### `presentation/hooks/useBrandWindowTitle.ts`

#### `useBrandWindowTitle(): void`

| Field        | Detail |
|--------------|--------|
| **Purpose**  | Apply `APP_NAME` as the native window title once on startup |
| **Inputs**   | none |
| **Output**   | `void` |
| **Errors**   | A rejected `setNativeWindowTitle` is logged via `logger.fromError('BWT_001:set-title')`; never thrown to React |
| **Side Effects** | One `setNativeWindowTitle(APP_NAME)` call in a mount-only effect |
| **Invariants** | Empty dependency array → runs exactly once per app lifecycle |

## 6. Error Handling Strategy

| Error | Layer | Propagation |
|-------|-------|------------|
| `setTitle` rejection (Tauri IPC failure) | Platform → Presentation | `setNativeWindowTitle` rejects; `useBrandWindowTitle` catches, logs `BWT_001`, and continues — the static config title remains as a safe fallback |

No new typed error enums are introduced; the failure path is non-fatal (a wrong window
title must never crash the app).

## 7. Configuration & Constants

No new hard-coded values. The title source is the existing `APP_NAME` constant; the
diagnostic code `BWT_001:set-title` follows the repo's existing `XXX_NNN:context` logger
convention (e.g. `LSV_001`, `CF-011`).

| Constant | Source | Description |
|----------|--------|-------------|
| `APP_NAME` | `src/constants/api.ts` (overlay / env / default) | Resolved brand name applied as the window title |

## 8. Testing Plan

| Test | Type | What It Verifies |
|------|------|-----------------|
| `window.test.ts` → "no-op outside runtime" | unit (Vitest) | Outside Tauri, `getCurrentWindow` / `setTitle` are never called |
| `window.test.ts` → "sets title inside runtime" | unit (Vitest) | Inside Tauri, `setTitle` is called once with the given name |
| Full suite | unit | `App.tsx` / `BootstrapGate` change introduces no regressions (761 passing) |
| `pnpm lint:platform` | CI gate | Tauri/OS access stays inside the platform layer |
| Manual (`pnpm tauri dev`, optionally with a `branding/` overlay) | manual | Native title shows the brand name (macOS Window menu / Windows Alt+Tab) |

## 9. Platform / Responsive Notes

No UI surface is rendered, so the responsive gate is N/A. The Platform Abstraction gate
applies and passes: the Tauri window import lives only in `platform/window.ts`, guarded
by `isTauriRuntime()`, and `pnpm lint:platform` is green.
