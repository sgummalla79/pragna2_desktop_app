# Feature Spec: Runtime-Branded Native Window Title

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-21
> **Last Updated**: 2026-06-21
> **Tracker**: pragna2-tracker #175 (`enhancement`, `target:desktop-fe`)

---

## 1. Overview

The native OS window title was hardcoded to `"Pragna"` in the static Tauri configs and
was the one user-visible desktop surface not covered by the build-time white-label
branding system ([custom-branding.md](custom-branding.md)). Even though the on-screen
title bar is hidden, the OS still uses the window title elsewhere — the macOS Window
menu, Mission Control, and the screen-share window picker; the Windows Alt+Tab switcher
and taskbar tooltip — so a white-label build still leaked "Pragna" there. This feature
sets the window title at runtime from the resolved brand name (`APP_NAME`) so it matches
the rest of the brand, while leaving the stock build showing "Pragna".

## 2. Goals & Non-Goals

**Goals**
- [x] Native window title reflects the resolved brand name on a branded build.
- [x] Stock / no-overlay build still shows "Pragna".
- [x] Browser-fallback (dev / e2e) never reaches an unguarded Tauri call.

**Non-Goals**
- Changing the static config title (it remains "Pragna" as the pre-paint default and stock fallback).
- Re-architecting how `apply-branding.mjs` merges Tauri config (the `windows` array is still not overlaid — see the Technical Spec for why).
- The document `<title>` / favicon (already brand-driven by #138).

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| brander shipping a white-label build | the OS window title to show my brand | the app name is consistent in Alt+Tab, the macOS Window menu, Mission Control, and screen-share |
| stock user | the title to stay "Pragna" | the default build is unchanged |

## 4. Acceptance Criteria

- [x] Given a branded overlay (`brand.config.json.name = "Acme"`), when the desktop app starts, then the native window title is "Acme" everywhere the OS surfaces it.
- [x] Given no overlay, when the app starts, then the title is "Pragna".
- [x] Given the browser-fallback path (dev server / e2e Chrome), then no Tauri window API is called and nothing throws.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Running in a plain browser (no `__TAURI_INTERNALS__`) | `setNativeWindowTitle` is a no-op; window API never touched |
| `setTitle` rejects at runtime | Error is logged via `logger.fromError('BWT_001:set-title')`; app continues (title falls back to the static config value) |
| Brand name resolves to empty | `APP_NAME` already guarantees a non-empty value ("Pragna" default), so the title is never blank |

## 6. Out of Scope

- Web FE (`pragna2_sgummalla_works`) — has no native window, so this is desktop-only.
- Backend brand-config seam (#174) and default-agent prompt branding (#173) — separate issues.

## 7. Open Questions

- None.

---

_Link to Technical Spec: [technical/window-title-runtime-branding.md](../technical/window-title-runtime-branding.md)_
