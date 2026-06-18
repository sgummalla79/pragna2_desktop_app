# Salesforce brand preset

A committed, ready-to-use brand overlay for the build-time white-label framework
(see [docs/specs/features/custom-branding.md](../docs/specs/features/custom-branding.md)).
It is **not** active by default — the stock build stays Pragna. To use it, copy
it onto the git-ignored active overlay and build with the brand wrapper:

```sh
cp -R branding.salesforce branding
pnpm tauri:brand dev      # branded desktop app
# or, browser-only preview of name/logo/theme/animation:
pnpm dev
```

To go back to stock Pragna: `rm -rf branding`.

## What's inside

| File | Provides |
|---|---|
| `brand.config.json` | name **Salesforce**, identifier `com.salesforce.app`, `agentAnimation: "typing-bubble"` |
| `logo.svg` | the Salesforce cloud + wordmark (transparent; white wordmark sits on the blue cloud, so it reads on any background) |
| `theme.css` | the tweakcn **"claude blu 2"** palette (`:root` + `.dark`) — source: <https://tweakcn.com/r/themes/cmmea3qbd000004jvb99v39cd> |
| `icon.png` | the OS app/installer icon — 1024×1024 (logo centered on a transparent square); `apply-branding.mjs` feeds it to `tauri icon` |

## Notes

- The `typing-bubble` thinking animation is a committed registry strategy
  (`src/presentation/components/agent-animation/animations/typingBubble.tsx`),
  selected here by key. It tints with the theme's `--primary`.
