# Technical Spec: Appearance (light / dark / system theme)

> **Status**: Implemented (theme toggle only; palette import deferred — TD-026)
> **Author**: Suman Gummalla
> **Created**: 2026-06-10
> **Last Updated**: 2026-06-10

Related feature spec: `docs/specs/features/appearance.md`.

---

## 1. Architecture

A dedicated **theme store** owns the mode and the DOM side-effect; the view is a
thin selector bound to it. Theme is intentionally **not** folded into `uiStore`
(whose own docstring delegates theming away) — Single Responsibility.

```
main.tsx → initTheme()            // apply persisted mode + wire OS listener (pre-mount)
AppearanceView (radiogroup)
  └─ useThemeStore { mode, setMode }
       └─ setMode → persist(localStorage) + applyThemeToDom(.dark on <html>)
constants/theme.ts                // storage key, dark class, media query, default, mode list
```

The dark token set already exists in `index.css` (`.dark { --background … }`,
gated by `@custom-variant dark (&:is(.dark *))`); the store only toggles the
`.dark` class — it never touches CSS values.

## 2. Files

| File | Change |
|---|---|
| `src/constants/theme.ts` | **New.** `ThemeMode`, `THEME_STORAGE_KEY`, `DARK_CLASS`, `PREFERS_DARK_QUERY`, `DEFAULT_THEME_MODE`, `THEME_MODES`. |
| `src/presentation/store/themeStore.ts` | **New.** `useThemeStore` + `isDarkResolved` + `initTheme`. |
| `src/presentation/views/settings/AppearanceView/AppearanceView.tsx` | **New.** The Light/Dark/System selector. |
| `src/presentation/router/AppRoutes.tsx` | `/settings/appearance` now lazy-loads `AppearanceView` (was `PlaceholderView`). |
| `src/main.tsx` | Calls `initTheme()` before `createRoot().render`. |
| `*.test.ts(x)` | `themeStore.test.ts` (6), `AppearanceView.test.tsx` (4). |

## 3. Store contract

```ts
type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;            // user choice; initial read from localStorage (default 'system')
  setMode: (mode: ThemeMode) => void;  // persist + apply + set
}

export function isDarkResolved(mode: ThemeMode): boolean;  // dark || (system && OS prefers dark)
export function initTheme(): void;  // apply persisted mode + register prefers-color-scheme listener
```

`applyThemeToDom(mode)` (module-private) does
`document.documentElement.classList.toggle(DARK_CLASS, isDarkResolved(mode))`.

## 4. System mode + live OS tracking

`initTheme()` (called once from `main.tsx`) applies the persisted mode and, if
`matchMedia` exists, attaches a `change` listener on `(prefers-color-scheme:
dark)`. The listener re-applies **only** when the current mode is `system`;
explicit light/dark ignore the OS. `addEventListener` is preferred with an
`addListener` fallback for older webviews.

## 5. No-hardcoding / error handling

- The storage key, dark class, media query, default mode, and mode list are all
  in `constants/theme.ts` — nothing inlined in logic.
- All `localStorage` and `matchMedia` access is guarded (try/catch + typeof
  checks); failures fall back to the default mode and never throw.

## 6. Testing

- **`themeStore.test.ts`**: `isDarkResolved` for explicit + system (OS stubbed
  via `matchMedia`); `setMode` persists + toggles `.dark`; `system` follows OS;
  `initTheme` applies mode + registers the OS listener.
- **`AppearanceView.test.tsx`**: renders three radios; reflects current mode;
  selecting Dark/Light updates the store + the `.dark` class.

## 7. Deviations from the web app

- **Default mode `system`** (desktop convention: follow the OS), vs the web
  app's default `dark`. The web app's `Theme` type is `'light' | 'dark'` only;
  desktop adds `'system'`. Recorded in `docs/web-app-parity.md`.
- **Separate `themeStore`** rather than the web app's combined `uiStore` theme
  slice — keeps the desktop `uiStore`'s stated boundary intact.
- **Palette / TweakCN import not ported** this round — tracked as **TD-026**.
