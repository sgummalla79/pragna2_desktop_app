# Technical Spec: Windows UI Polish

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-12
> **Last Updated**: 2026-06-12

---

## 1. Architecture Overview

Windows-specific rendering is gated entirely by `isWindowsPlatform()` from
`src/infrastructure/platform/`. No platform checks live outside that module — see the Platform
Abstraction rule in `CLAUDE.md`.

Tauri config is split into three files:
- `tauri.conf.json` — settings identical across all platforms (`titleBarStyle: "Overlay"`,
  `hiddenTitle: true`).
- `tauri.windows.conf.json` — `decorations: false` (removes the native Windows title bar).
- `tauri.macos.conf.json` — `trafficLightPosition: { x: 22, y: 28 }`.

## 2. New & Modified Files

| File | Change |
|------|--------|
| `src/infrastructure/platform/runtime.ts` | Added `isWindowsPlatform()` |
| `src/infrastructure/platform/index.ts` | Re-exports `isWindowsPlatform` |
| `src/components/ui/WindowsTitleBar.tsx` | New — custom title bar component |
| `src/App.tsx` | Conditionally renders `WindowsTitleBar` (Windows) or macOS drag strip |
| `src/presentation/views/chat/ChatView.tsx` | Windows sidebar box geometry + collapsed rail |
| `src/presentation/views/chat/components/ChatSidebar.tsx` | Windows header row via `headerContent` prop |
| `src/presentation/components/settings/SettingsSidebar/SettingsSidebar.tsx` | Windows header + `CollapsedSettingsRail` |
| `src/components/ui/sidebar/Sidebar.tsx` | Added `headerContent?: ReactNode` prop |
| `src/presentation/views/chat/components/AvatarMenu.tsx` | Added `iconOnly?: boolean` prop |
| `src-tauri/tauri.conf.json` | `titleBarStyle: "Overlay"`, `hiddenTitle: true` |
| `src-tauri/tauri.windows.conf.json` | New — `decorations: false` |
| `src-tauri/tauri.macos.conf.json` | New — `trafficLightPosition` |
| `src-tauri/capabilities/default.json` | Added 4 window permissions |

## 3. Key Decisions

### Custom title bar instead of `hiddenTitle`
`hiddenTitle: true` suppresses the title on macOS but not on Windows. The only way to remove it
on Windows is `decorations: false`, which also removes the native min/max/close chrome. A custom
React title bar replaces all three buttons.

### Drag region as sibling, not parent
The `data-tauri-drag-region` div is a `flex-1` sibling of the window control buttons — not a
wrapper. If it were the parent, it would intercept pointer events on the buttons, breaking
minimize/maximize/close.

### Sidebar `marginTop: 8` inside the transparent title bar
Rather than ending the sidebar below the 32 px title bar, the sidebar box sits 8 px below the
very top of the window. The transparent title bar overlaps the top of the sidebar, and the
rounded corners are visible in that overlap region — giving the "floating box inside the title
bar" appearance.

### `headerContent` prop on `Sidebar`
Avoids a macOS `paddingTop` that would add unwanted space on Windows. When `headerContent` is
provided, `Sidebar` sets `marginTop: 8`, `height: calc(100vh - 18px)`, and `paddingTop: 0`,
letting the Windows header row own vertical positioning.

## 4. `isWindowsPlatform()` — Signature & Behaviour

```ts
// src/infrastructure/platform/runtime.ts
export function isWindowsPlatform(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows');
}
```

Called at render time (not once at module load) so tests can override `navigator.userAgent`.

## 5. `WindowsTitleBar` — Signature & Behaviour

```tsx
// src/components/ui/WindowsTitleBar.tsx
export function WindowsTitleBar(): JSX.Element
```

- Mounts a `fixed inset-x-0 top-0 z-[200] h-8` bar.
- Calls `win.isMaximized()` on mount and subscribes to `win.onResized()` to keep `isMaximized`
  state in sync — drives the `MaximizeIcon` / `RestoreIcon` toggle.
- Cleanup: calls `unlisten()` to remove the resize listener on unmount.
- Requires capabilities: `core:window:allow-minimize`, `core:window:allow-toggle-maximize`,
  `core:window:allow-close`, `core:window:allow-is-maximized`.

## 6. Collapsed Rail Geometry

Both chat and settings collapsed rails share the same inline style:

```ts
{
  width: 48, minWidth: 48,
  marginTop: 8,
  marginBottom: SIDEBAR_BOX_INSET_PX,
  marginLeft: SIDEBAR_BOX_INSET_PX,
  marginRight: SIDEBAR_BOX_GAP_PX,
  height: 'calc(100vh - 18px)',
  paddingTop: 16,
}
```

`18px = marginTop(8) + marginBottom(SIDEBAR_BOX_INSET_PX=10)`.

## 7. Capability Permissions Added

```json
"core:window:allow-minimize"
"core:window:allow-toggle-maximize"
"core:window:allow-close"
"core:window:allow-is-maximized"
```

Without these Tauri 2 silently no-ops every window operation.

## 8. Error Handling

- `win.onResized()` returns a `Promise<UnlistenFn>`; the `unlisten` ref is only set after the
  promise resolves so the cleanup closure is always a valid function.
- Window control buttons have no explicit error handling — Tauri commands are fire-and-forget for
  these operations; failures are silent (standard desktop app behaviour).

## 9. Testing

- `isWindowsPlatform` covered by `src/infrastructure/runtime.test.ts`.
- `WindowsTitleBar` is not unit-tested (Tauri APIs unavailable in Vitest); verified manually on
  a Windows build.
- All 460 Vitest tests pass with no regressions.
