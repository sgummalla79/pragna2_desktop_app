# Branding Usage Map — where the brand NAME & LOGO are used

> Quick reference for maintainers: every place the app surfaces the **brand name**
> or **brand logo**, how each one gets its value, and what overriding it requires.
> Companion to [custom-branding.md](custom-branding.md). Line numbers are
> indicative (they drift) — grep the symbol if they don't match.

## TL;DR — the single sources of truth

| Concern | Source of truth | Override (build-time) |
|---|---|---|
| Brand **name** | `APP_NAME` in [src/constants/api.ts](../../../src/constants/api.ts) | `branding/brand.config.json` → `name` (→ `__BRAND_NAME__`), else `VITE_APP_NAME`, else `'Pragna'` |
| In-app **logo** | `@brand/logo.svg` alias → [branding-aliases.mjs](../../../branding-aliases.mjs) | drop `branding/logo.svg` (SVG) |
| **Agent** (thinking) icon | `@brand/agent-icon.svg` alias (falls back to the logo) | drop `branding/agent-icon.svg` (SVG) |
| OS app icon / installer name | Tauri config | `branding/icon.png` + `brand.config.json` (see [custom-branding.md](custom-branding.md)) |

**Do NOT hardcode the literal `"Pragna"` anywhere.** Always import `APP_NAME`, and
always import the logo via the `@brand/...` alias — never `@/assets/logo.svg`.

---

## 1. Brand NAME (`APP_NAME`)

Source: `APP_NAME` in [src/constants/api.ts](../../../src/constants/api.ts) — resolves
`__BRAND_NAME__` (brand.config) → `VITE_APP_NAME` → `'Pragna'`.

| Surface | File | What shows |
|---|---|---|
| Login card title | [src/presentation/components/auth/LoginForm.tsx](../../../src/presentation/components/auth/LoginForm.tsx) | `{APP_NAME}` |
| Register page | [src/presentation/views/auth/RegisterView.tsx](../../../src/presentation/views/auth/RegisterView.tsx) | heading + "Start building with {APP_NAME}" |
| Home / signed-in | [src/presentation/views/HomeView.tsx](../../../src/presentation/views/HomeView.tsx) | "You're signed in to {APP_NAME}" |
| Chat landing placeholder | [src/presentation/views/chat/ChatLandingView.tsx](../../../src/presentation/views/chat/ChatLandingView.tsx) | "Ask {APP_NAME} anything…" |
| Sidebar header (Windows chrome) | [src/presentation/views/chat/components/ChatSidebar.tsx](../../../src/presentation/views/chat/components/ChatSidebar.tsx) | `{APP_NAME}` |
| Appearance settings copy | [src/presentation/views/settings/AppearanceView/AppearanceView.tsx](../../../src/presentation/views/settings/AppearanceView/AppearanceView.tsx) | "Choose how {APP_NAME} looks…" |
| Auth0 loopback "Signed in" page | [src/infrastructure/auth0/tauriLoopbackAuthFlow.ts](../../../src/infrastructure/auth0/tauriLoopbackAuthFlow.ts) | `<title>`, `<h1>`, wordmark (HTML-escaped) |
| MCP connector "Connected" page | [src/infrastructure/mcp/loopbackSuccessPage.ts](../../../src/infrastructure/mcp/loopbackSuccessPage.ts) | `<title>`, wordmark (HTML-escaped) |
| Browser tab / document `<title>` | [index.html](../../../index.html) `<title>Pragna</title>` | rewritten at build by `brandOverlayPlugin` in [vite.config.ts](../../../vite.config.ts) (`transformIndexHtml`) |
| Packaged app name (dock/taskbar/installer) | `productName` in [src-tauri/tauri.conf.json](../../../src-tauri/tauri.conf.json) | merged from `brand.config.json` by [scripts/apply-branding.mjs](../../../scripts/apply-branding.mjs) → `tauri.brand.conf.json` |

> **Not the brand name:** `CLIENT_APP_NAME = 'desktop'` in
> [src/constants/version.ts](../../../src/constants/version.ts) is the client
> identifier for the version-compatibility header — unrelated, never user-facing.

> **Window title** (`"title"` in the three `tauri*.conf.json`) is intentionally
> *not* overridden — both platforms hide the native title bar; the visible label
> comes from `productName` + the document title.

---

## 2. Brand LOGO

Resolved by the `@brand/logo.svg` alias → overlay `branding/logo.svg` if present,
else `src/assets/logo.svg` ([branding-aliases.mjs](../../../branding-aliases.mjs)).

| Surface | File | Import form |
|---|---|---|
| Login card | [src/presentation/components/auth/LoginForm.tsx](../../../src/presentation/components/auth/LoginForm.tsx) | `@brand/logo.svg?react` |
| Home | [src/presentation/views/HomeView.tsx](../../../src/presentation/views/HomeView.tsx) | `@brand/logo.svg?react` |
| Chat landing | [src/presentation/views/chat/ChatLandingView.tsx](../../../src/presentation/views/chat/ChatLandingView.tsx) | `@brand/logo.svg?react` |
| Sidebar header (Windows) | [src/presentation/views/chat/components/ChatSidebar.tsx](../../../src/presentation/views/chat/components/ChatSidebar.tsx) | `@brand/logo.svg?react` |
| Register page | [src/presentation/views/auth/RegisterView.tsx](../../../src/presentation/views/auth/RegisterView.tsx) | `@brand/logo.svg?react` |
| OAuth loopback pages (inline) | via `BRAND_LOGO_MARKUP` in [src/infrastructure/branding/brandAssets.ts](../../../src/infrastructure/branding/brandAssets.ts) | `@brand/logo.svg?raw` — see §4 |
| Thinking strip (agent icon) | [src/presentation/views/chat/components/ThinkingStrip.tsx](../../../src/presentation/views/chat/components/ThinkingStrip.tsx) | `@brand/agent-icon.svg?react` (defaults to the logo — §3) |

---

## 3. Agent (thinking-indicator) icon

[ThinkingStrip.tsx](../../../src/presentation/views/chat/components/ThinkingStrip.tsx)
renders `@brand/agent-icon.svg`, which **falls back to the brand logo** (no separate
default asset). A brander supplies `branding/agent-icon.svg` only to give the
thinking strip a distinct mark (e.g. a brain). The motion is chosen by
`agentAnimation` (`spin` default / `bubbles-brain` opt-in) — see the registry in
[src/presentation/components/agent-animation/](../../../src/presentation/components/agent-animation/).

---

## 4. The override plumbing (how values reach the bundle)

- **Aliases** ([branding-aliases.mjs](../../../branding-aliases.mjs)): `@brand/logo.svg`
  & `@brand/agent-icon.svg` → overlay file or committed default. Used by both
  [vite.config.ts](../../../vite.config.ts) and [vitest.config.ts](../../../vitest.config.ts).
- **Build constants** (injected via Vite `define`, declared in
  [src/vite-env.d.ts](../../../src/vite-env.d.ts)):
  - `__BRAND_NAME__` — `brand.config.json` `name`.
  - `__BRAND_AGENT_ANIMATION__` — `brand.config.json` `agentAnimation`.
  - `__BRAND_HAS_OVERLAY_LOGO__` — true only if `branding/logo.svg` exists; gates
    whether the OAuth pages inline the brand logo or keep their original mark
    ([brandAssets.ts](../../../src/infrastructure/branding/brandAssets.ts)).
- **Theme overlay**: `branding/theme.css` → `virtual:brand-theme.css` (imported last
  in [src/main.tsx](../../../src/main.tsx)).
- **Tauri side**: [scripts/apply-branding.mjs](../../../scripts/apply-branding.mjs)
  generates `tauri.brand.conf.json` (productName/identifier/icons) merged via
  `pnpm tauri:brand <cmd>`.

---

## 5. Known gaps / NOT branded by the overlay

- **Favicon / webview document icon** — [index.html](../../../index.html) line ~5
  references `/logo.svg` → [public/logo.svg](../../../public/logo.svg), which is a
  separate committed file **not** covered by the `@brand` alias. In the packaged
  Tauri app this is invisible (no browser tab; the OS icon comes from `tauri icon`),
  but in browser-fallback it shows the stock Pragna mark. To brand it, have
  `apply-branding.mjs` copy `branding/logo.svg` over `public/logo.svg` at build, or
  add a `transformIndexHtml` rewrite of the icon href. (Deferred — low impact.)

---

## 6. Adding a NEW place that shows the name or logo

- **Name** → `import { APP_NAME } from '@/constants/api'` and render `{APP_NAME}`.
  Never write the literal `"Pragna"`.
- **Logo** → `import Logo from '@brand/logo.svg?react'`. Never import
  `@/assets/logo.svg` directly (that bypasses the overlay).
- **A self-contained HTML string** (like the loopback pages) → interpolate
  `escapeHtml(APP_NAME)` and `BRAND_LOGO_MARKUP` from
  [brandAssets.ts](../../../src/infrastructure/branding/brandAssets.ts).
- Then add a row to the relevant table above so this map stays complete.
