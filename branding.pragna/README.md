# Pragna brand preset (the stock defaults)

The default brand, expressed as a preset for symmetry with the other brands
(e.g. `branding.salesforce/`). **You normally never need this** — Pragna is the
built-in default, so a build with **no** `branding/` overlay is already stock
Pragna. This preset exists to (a) document what the default brand is, and (b)
give an explicit "select Pragna" overlay.

```sh
cp -R branding.pragna branding   # explicitly select Pragna (identical to no overlay)
rm -rf branding                  # …or just remove the overlay; same result
```
```powershell
# Windows (PowerShell)
Copy-Item -Recurse branding.pragna branding
Remove-Item -Recurse -Force branding
```

## What's inside

| File | Provides |
|---|---|
| `brand.config.json` | name **Pragna**, identifier `com.pragna2.app`, `agentAnimation: "spin"` |

## Deliberately config-only

This preset ships **only** `brand.config.json` — no `logo.svg`, `theme.css`,
`agent-icon.svg`, or `icon.png` — on purpose, so activating it produces an app
**identical to the default build** (same name, logo, theme, icons, animation, and
OAuth mark; only the internal `__BRAND_NAME__` constant differs):

- **Logo** → falls back to the committed [`src/assets/logo.svg`](../src/assets/logo.svg).
- **Theme** → the committed [`src/index.css`](../src/index.css) palette (no overlay).
- **OS icons** → the committed `src-tauri/icons/`.
- **Agent icon** → falls back to the brand logo.
- **OAuth success pages** → keep their original copper mark (a `logo.svg` here
  would flip `__BRAND_HAS_OVERLAY_LOGO__` and swap that mark — which is exactly
  what we avoid by omitting it).

> All Pragna *visual* assets live in the committed source; this preset only
> names the default brand and its (spin) animation.
