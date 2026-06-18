# Technical Spec: Custom Branding (Build-Time White-Label)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-17
> **Last Updated**: 2026-06-17

---

> **See also:** [custom-branding-usage-map.md](custom-branding-usage-map.md) — the
> exhaustive list of every place the brand **name** and **logo** are used, with
> the source of truth and override for each. Keep that map in sync when adding a
> new branded surface.

## 1. Overview

A git-ignored `branding/` overlay folder supplies brand assets at build time.
Vite reads the overlay directly to resolve in-app assets (logo, agent icon,
theme) and to inject the brand name/animation as bundle constants; a small Node
wrapper handles the Tauri-side packaging (OS icons + `productName`/`identifier`)
that Vite cannot. Absent overlay ⇒ stock Pragna. No new runtime layers; this is
a build-configuration + presentation-strategy feature.

## 2. Architecture & Layer Placement

- **Domain / Application**: none.
- **Adapters / Presentation**:
  - New presentation strategy registry for the agent thinking animation
    (`src/presentation/components/agent-animation/`) — Open/Closed: animations are
    self-contained modules registered by key, selected from config.
  - Brand-asset helper for the self-contained OAuth loopback pages
    (`src/infrastructure/branding/brandAssets.ts`).
  - Existing brand-mark call sites repointed from `@/assets/logo.svg` to the
    overlay-aware `@brand/logo.svg` alias.
- **Build tooling** (outside the app layers):
  - `branding-aliases.mjs` — shared `@brand` alias + `brand.config.json` reader,
    imported by `vite.config.ts`, `vitest.config.ts`, and the brand scripts.
  - `vite.config.ts` — `brandOverlayPlugin` (theme virtual module + index.html
    title + favicon) and brand build constants.
  - `scripts/apply-branding.mjs` + `scripts/tauri-with-brand.mjs` — Tauri icons +
    `--config` merge.

## 3. Data Flow

```
branding/ overlay ─┬─ vite.config (reads brand.config.json + files)
                   │     ├─ define __BRAND_NAME__ / __BRAND_AGENT_ANIMATION__ ─▶ constants/api.ts (APP_NAME / AGENT_ANIMATION_KEY)
                   │     ├─ resolve.alias @brand/logo.svg, @brand/agent-icon.svg ─▶ overlay file or src/assets default
                   │     ├─ virtual:brand-theme.css ─▶ main.tsx (after index.css)
                   │     └─ transformIndexHtml ─▶ <title> + favicon (data URI)
                   └─ scripts/tauri-with-brand.mjs ─▶ apply-branding.mjs
                         ├─ tauri icon branding/icon.png ─▶ src-tauri/icons-brand/
                         └─ branding/tauri.brand.conf.json ─▶ tauri <cmd> --config (merge)

AGENT_ANIMATION_KEY ─▶ getAgentAnimation(key) ─▶ ThinkingStrip renders <Strategy.Component icon={AgentIcon}/>
```

## 4. Module & File Layout

```
branding-aliases.mjs                         # @brand alias + readBrandConfig (shared)
branding.example/                            # committed template (config/logo/agent-icon/theme/README)
scripts/apply-branding.mjs                   # generate icons + tauri.brand.conf.json
scripts/tauri-with-brand.mjs                 # wrapper: apply-branding + tauri --config
                                             # (no default agent-icon asset — it falls back to the brand logo)
src/constants/api.ts                         # APP_NAME, AGENT_ANIMATION_KEY (precedence)
src/infrastructure/branding/brandAssets.ts   # BRAND_LOGO_MARKUP (?raw) + escapeHtml
src/presentation/components/agent-animation/
  AgentAnimation.types.ts
  registry.ts                                # getAgentAnimation + DEFAULT key
  animations/spin.tsx
  animations/bubblesBrain.tsx + .css
vite.config.ts / vitest.config.ts            # alias + brand constants (+ theme/title in vite)
```

## 5. Method Specifications

### `branding-aliases.mjs`

#### `brandAliases(rootDir) -> Array<{find: RegExp, replacement: string}>`
| Field | Detail |
|---|---|
| **Purpose** | Map `@brand/<asset>` to the overlay file if present, else the committed default. |
| **Inputs** | `rootDir` — absolute repo root. |
| **Output** | Regex alias entries (regex so the svgr `?react`/`?raw` query survives). |
| **Side Effects** | Reads the filesystem (`existsSync`). |

#### `readBrandConfig(rootDir) -> object`
| Field | Detail |
|---|---|
| **Purpose** | Parse `branding/brand.config.json`, or `{}` when absent. |
| **Errors** | Throws `Invalid branding/brand.config.json` on malformed JSON (fail loud). |

### `getAgentAnimation(key) -> AgentAnimationStrategy`
| Field | Detail |
|---|---|
| **Purpose** | Resolve a thinking-animation strategy by key. |
| **Inputs** | `key: string` (may be empty/unknown). |
| **Output** | The matching strategy, else the registry default. Always non-null. |

### `applyBranding() -> string | null`
| Field | Detail |
|---|---|
| **Purpose** | Generate OS icons (`tauri icon`) + `branding/tauri.brand.conf.json` from the overlay. |
| **Output** | Absolute path to the generated Tauri config, or `null` (no overlay → no-op). |
| **Side Effects** | Writes `src-tauri/icons-brand/` + `branding/tauri.brand.conf.json` (both git-ignored). |

### `escapeHtml(value) -> string`
| Field | Detail |
|---|---|
| **Purpose** | Escape `& < > " '` for injecting the brand name into inline HTML (OAuth pages). |

## 6. Error Handling Strategy

| Error | Layer | Propagation |
|---|---|---|
| Malformed `brand.config.json` | build | `readBrandConfig` throws → build aborts (never silently stock). |
| Unknown `agentAnimation` key | presentation | `getAgentAnimation` returns the default strategy. |
| Missing overlay | build | No-op (intended) — stock Pragna. |

## 7. Configuration & Constants

| Constant | Source | Description |
|---|---|---|
| `__BRAND_NAME__` | Vite define ← `brand.config.json.name` | Brand name; wins over `VITE_APP_NAME`. |
| `__BRAND_AGENT_ANIMATION__` | Vite define ← `brand.config.json.agentAnimation` | Animation key; wins over `VITE_AGENT_ANIMATION`. |
| `APP_NAME` | `__BRAND_NAME__` ∥ `VITE_APP_NAME` ∥ `'Pragna'` | Resolved name used app-wide. |
| `AGENT_ANIMATION_KEY` | `__BRAND_AGENT_ANIMATION__` ∥ `VITE_AGENT_ANIMATION` ∥ `''` | Resolved animation key. |
| `@brand/logo.svg`, `@brand/agent-icon.svg` | alias ← overlay ∥ `src/assets/*` | In-app marks. |
| `virtual:brand-theme.css` | overlay `branding/theme.css` ∥ empty | Theme overlay (tweakcn). |
| `ICON_FILES` / `BRAND_ICON_DIR` | `apply-branding.mjs` | OS icon names + git-ignored output dir. |

**Precedence note:** the overlay is authoritative over `VITE_APP_NAME` because the
repo's `.env` ships `VITE_APP_NAME=Pragna` as the default, which must not shadow a
brander's name.

**Known limitation:** the Rust keychain namespace (`KEYRING_SERVICE =
"com.pragna2.app"`, `src-tauri/src/platform/`) is independent of the brand
`identifier`; it is an internal storage namespace, not a user-visible value, so it
is intentionally left as-is. Tracked for future parity if a brand needs isolated
secure storage.

## 8. Testing Plan

| Test | Type | What It Verifies |
|---|---|---|
| `registry.test.ts` | unit | Known key → strategy; empty/unknown → default; default is spin. |
| `bubblesBrain.test.tsx` | unit | Renders the icon always; mounts bubble particles only when active. |
| `ThinkingStrip.test.tsx` | unit (existing) | Idle/working states still hold with the registry-driven icon. |
| Manual: default build | e2e/manual | No overlay ⇒ `<title>Pragna</title>`, stock assets. |
| Manual: branded build | e2e/manual | Overlay ⇒ name/logo/theme/title/animation reflect the brand; `tauri:brand` icons. |

## 9. Dependencies & External Integrations

No new dependencies. Uses existing Vite features (`?react`, `?raw`, virtual
modules, `transformIndexHtml`, `define`, `loadEnv`), `vite-plugin-svgr`, and the
`@tauri-apps/cli` `tauri icon` command. tweakcn (<https://tweakcn.com>) is an
external design tool the brander uses to author `theme.css`; nothing depends on it
at build time.

## 10. Open Questions / Risks

- [ ] If a brander needs a fully isolated keychain, the Rust `KEYRING_SERVICE`
      would need to derive from the brand identifier (currently fixed) — deferred.

---

_Link to Feature Spec: [features/custom-branding.md](../features/custom-branding.md)_
