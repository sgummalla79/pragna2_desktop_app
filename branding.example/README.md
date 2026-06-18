# Custom branding (white-label) overlay

Bring your own **name, logo, OS icon, theme, and agent animation** at build time —
without editing the repo. The committed defaults (stock "Pragna") stay untouched;
your brand assets live in a **git-ignored `branding/` folder** that the build
overlays when present.

## Quick start

1. Copy this template to the (git-ignored) overlay folder at the repo root:

   ```sh
   cp -R branding.example branding
   ```

2. Edit `branding/` to your brand (see **Files** below).
3. Build/run with the brand-aware wrapper:

   ```sh
   pnpm tauri:brand dev      # branded dev run
   pnpm tauri:brand build    # branded packaged build
   ```

   The plain `pnpm tauri dev` / `pnpm tauri build` always produce stock Pragna.

With **no** `branding/` folder, every command produces stock Pragna — the overlay
is purely additive.

## Files

| File | Required | What it overrides |
|---|---|---|
| `brand.config.json` | yes | App `name`, bundle `identifier`, `agentAnimation` key |
| `logo.svg` | recommended | The brand mark (login, home, chat, sidebar, OAuth pages). **SVG only** — it is imported as a React component (`currentColor` theming). |
| `icon.png` | for packaging | The OS app/installer icon. A **1024×1024 PNG**; `tauri icon` expands it to every platform size. |
| `agent-icon.svg` | optional | The agent (thinking-indicator) icon. **SVG only**; defaults to the brand logo. Drop one (e.g. a brain) to give the thinking strip its own mark. |
| `theme.css` | optional | A tweakcn export of the shadcn token blocks (accent/primary/etc.). |

> `icon.png` is binary, so it is not included in this template — drop your own
> 1024×1024 PNG in as `branding/icon.png`.

### `brand.config.json`

```json
{
  "name": "Acme",
  "identifier": "com.acme.app",
  "agentAnimation": "bubbles-brain"
}
```

- **name** — shown across the app (and as the document/dock/taskbar label).
- **identifier** — reverse-DNS bundle id for the packaged app (installer / OS).
- **agentAnimation** — which thinking-indicator animation to use. Built-in keys:
  - `spin` — the icon spins while the agent works (default when unset)
  - `bubbles-brain` — agent icon with bubbles rising from it

  Add more by registering a strategy in
  `src/presentation/components/agent-animation/registry.ts` (no call-site changes).

### `theme.css` (tweakcn)

Open <https://tweakcn.com>, design your palette, **Export → CSS**, and paste the
`:root { … }` / `.dark { … }` blocks into `branding/theme.css`. They override the
defaults because the app imports this file last.

## Notes / limits

- **In-app marks must be SVG** (`logo.svg`, `agent-icon.svg`) — PNG would lose the
  `currentColor` theming and animation. The **OS icon** (`icon.png`) is the only
  raster asset.
- The native OS **title bar** is hidden on both macOS and Windows, so the visible
  app label comes from `name` (dock/taskbar) + the branded document title.
- Generated artifacts (`branding/tauri.brand.conf.json`, `src-tauri/icons-brand/`)
  are git-ignored and rebuilt by `pnpm tauri:brand`.
