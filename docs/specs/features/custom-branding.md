# Feature Spec: Custom Branding (Build-Time White-Label)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-17
> **Last Updated**: 2026-06-17

---

## 1. Overview

Anyone can ship the product under their own brand — name, logo, OS icon, colour
theme, and agent (thinking-indicator) animation — **at build time**, without
editing the repository. The committed defaults (stock "Pragna") stay untouched.
A brander drops their assets into a **git-ignored `branding/` overlay folder**;
the build detects it and overlays the brand. With no overlay, every build is
byte-for-byte stock Pragna.

## 2. Goals & Non-Goals

**Goals**
- [x] Override the app **name** everywhere it shows (login, home, chat, sidebar,
      OAuth/connector success pages, document/dock/taskbar label).
- [x] Override the in-app **logo** (SVG) and, optionally, the **agent icon** (SVG).
- [x] Override the **OS app/installer icon** from a single 1024×1024 PNG.
- [x] Override the **colour theme** by pasting a tweakcn export.
- [x] Choose the **agent thinking animation** from a pluggable registry (default
      is the spinning icon; branders can opt into "bubbles rising from a brain" or
      add more animations).
- [x] Branders never commit anything to the repo; defaults are never mutated.

**Non-Goals**
- Runtime, per-user or per-org branding (no in-app settings UI). Build-time only.
- Any backend (`nexus-kit-api`) change.
- A PNG in-app logo/agent icon (must be SVG — see Edge Cases).

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| reseller | drop my name + logo + icon + theme into one folder and build | I ship the app under my own brand without forking |
| reseller | pick or add a thinking animation | the agent's "working" identity matches my brand |
| maintainer | keep stock Pragna as the default | the repo and normal builds are unaffected |

## 4. Acceptance Criteria

- [x] Given no `branding/` folder, when I build, then the output is stock Pragna
      (name, logo, copper theme, icons, document title).
- [x] Given a `branding/brand.config.json` with `name: "Acme"`, when I build with
      `pnpm tauri:brand build`, then the app name and document title read "Acme".
- [x] Given a `branding/logo.svg`, then the login/home/chat/sidebar/OAuth marks
      use it (via the `@brand/logo.svg` alias).
- [x] Given a `branding/theme.css` (tweakcn export), then the palette reflects it
      (it overrides the default tokens by source order).
- [x] Given `branding/icon.png`, when I run `pnpm tauri:brand build`, then the OS
      icons are generated from it (committed `src-tauri/icons/` untouched).
- [x] Given `agentAnimation: "bubbles-brain"`, then bubbles rise from the agent
      icon; given `"spin"` (or unset), then the thinking strip spins the agent icon.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| No `branding/` folder | No-op overlay → stock Pragna. |
| Malformed `brand.config.json` | Build fails loudly (`Invalid branding/brand.config.json`) — never silently ships stock. |
| `branding/logo.svg` is a PNG | Unsupported — in-app marks must be SVG (svgr `?react` + `currentColor`). Documented in `branding.example/README.md`. |
| Unknown `agentAnimation` key | Falls back to the registry default; (config-driven, no crash). |
| `.env` sets `VITE_APP_NAME=Pragna` (repo default) | The overlay `brand.config.json` name **wins** over the env var, so it cannot shadow a brand. |
| Brand name contains `& < >` | HTML-escaped where injected into the OAuth pages and document title. |

## 6. Out of Scope

Runtime/in-app branding UI; org/tenant branding from the backend; localisation of
brand copy; a non-SVG in-app logo.

## 7. Open Questions

- [ ] None outstanding.

## 8. Web-app parity (`pragna2_sgummalla_works`)

The web FE shares this architecture (same Vite + svgr + shadcn CSS-variable theme
and the same `VITE_APP_NAME`/logo-import pattern). The same overlay approach
(`@brand` alias + `theme.css` virtual module + brand build constants) applies
there and should be ported in that repo's own session (per the No Cross-Repo rule).
The OS-icon/Tauri parts are desktop-only.

---

_Link to Technical Spec: [technical/custom-branding.md](../technical/custom-branding.md)_
