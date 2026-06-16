# Feature Spec: Appearance (light / dark / system theme)

> **Status**: Implemented (theme toggle only; palette import deferred — pragna2-tracker TD-026)
> **Author**: Suman Gummalla
> **Created**: 2026-06-10
> **Last Updated**: 2026-06-10

---

## 1. Overview

Adds a real **Appearance** settings page with a **Light / Dark / System** theme
selector, replacing the previous "coming soon" `PlaceholderView`. The chosen
mode is persisted and applied app-wide by toggling the `.dark` class on `<html>`
(the activator for `index.css`'s dark token set).

Before this, dark/light token sets both existed in `index.css` but **no UI
toggled between them** — the desktop had no way for a user to change theme. The
web app has a 235-LOC `AppearanceView` (mode toggle + TweakCN palette grid); this
ships the **mode toggle** for parity now and tracks the palette grid as pragna2-tracker TD-026.

## 2. Goals & Non-Goals

**Goals**
- [x] A settings page to choose Light, Dark, or System appearance.
- [x] Persist the choice across launches (localStorage).
- [x] Apply the persisted theme before first paint (no flash on boot).
- [x] `System` follows the OS preference and tracks live OS changes.

**Non-Goals (this round)**
- TweakCN palette grid + import/uninstall of custom palettes (→ **pragna2-tracker TD-026**).
- Per-component theme overrides, font/density settings.

## 3. User Flow

- Settings → **Appearance** shows a "Theme" section with three options:
  **Light**, **Dark**, **System** (each an icon + label + one-line description).
- Selecting an option immediately re-themes the whole app and persists the
  choice; the selection is reflected as the checked radio.
- **System** matches the OS light/dark setting and switches live when the OS
  setting changes.

## 4. Acceptance Criteria

- [x] Three selectable modes render as an accessible `radiogroup`.
- [x] The current mode is shown as the checked radio.
- [x] Choosing **Dark** adds `.dark` to `<html>`; **Light** removes it; **System**
      adds/removes it based on the OS preference.
- [x] The choice persists to `localStorage['pragna:theme']` and is re-applied on
      next launch before React mounts.
- [x] Defaults to **System** when never chosen.

## 5. Edge Cases

- **localStorage unavailable**: reads fall back to the default mode; writes are
  swallowed (no crash).
- **`matchMedia` unavailable** (old webview / test env): `system` resolves to
  light; no listener is wired.
- **OS theme changes while in System**: the app re-applies live via a
  `prefers-color-scheme` listener.

## 6. Responsive Design

The selector is a `grid-cols-1` stack on narrow widths and `sm:grid-cols-3` row
on wider ones, inside a `max-w-2xl` page — readable and tap-friendly from the
narrowest window up to wide displays.
