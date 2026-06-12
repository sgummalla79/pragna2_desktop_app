# Feature Spec: Windows UI Polish

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-12
> **Last Updated**: 2026-06-12

---

## 1. Overview

On Windows the Tauri app replaces the native OS title bar (which printed "Tauri App") with a
**custom transparent title bar** carrying app-standard min / max / close buttons. The chat and
settings sidebars gain a **Windows-specific header row** (brand logo + name, or gear icon +
"Settings", with an inline collapse/expand toggle) and a **48 px icon-only collapsed rail**.
Platform detection is centralised in `src/infrastructure/platform/`; all Windows-only rendering
is conditional on `isWindowsPlatform()`.

## 2. Goals & Non-Goals

**Goals**
- [x] Remove "Tauri App" from the Windows title bar.
- [x] Custom transparent title bar with draggable region, minimize, maximize/restore, and close
      buttons — styled to match the app's dark theme (close turns red on hover).
- [x] Maximize icon toggles to a restore (two-square) icon when the window is maximized.
- [x] Chat sidebar Windows header: 16 px top spacer → brand logo + "Pragna" left-aligned +
      PanelLeftClose/Open toggle right-aligned.
- [x] "Chats" nav item with 32 px gap below it (Windows only).
- [x] Collapsed chat rail (48 px): PanelLeftOpen + Plus (new chat) + MessagesSquare + avatar
      circle pinned to the bottom — icon-only, no labels.
- [x] Settings sidebar Windows header: 16 px top spacer → gear icon + "Settings" + collapse
      toggle right-aligned.
- [x] Collapsed settings rail (48 px): PanelLeftOpen + nav icons + Back-to-Chat pinned to the
      bottom.
- [x] Sidebar box sits inside the 32 px transparent title bar with 8 px top margin so rounded
      corners are visible.
- [x] macOS layout unchanged.

**Non-Goals**
- Changing any macOS-specific chrome (traffic lights, `TitlebarCollapseToggle`).
- Custom title bar on Linux.
- Any backend or data change.

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| Windows user | not see "Tauri App" in the title bar | the app feels polished and branded |
| Windows user | minimize, maximize/restore, and close with standard buttons | I can manage the window normally |
| Windows user | see the Pragna brand in the sidebar | the app has a consistent identity |
| Windows user | collapse the sidebar to a narrow rail | I get more space for the transcript |
| Windows user | see only icons when the sidebar is collapsed | the collapsed state is compact and clear |

## 4. Acceptance Criteria

- [x] On Windows, no "Tauri App" text appears anywhere in the window chrome.
- [x] Minimize, maximize/restore, and close buttons work; icon switches between single-square
      and double-square depending on maximized state.
- [x] Chat sidebar expanded: brand logo + "Pragna" visible, collapse button at right.
- [x] Chat sidebar collapsed: 48 px rail with PanelLeftOpen, Plus, MessagesSquare, and avatar
      at bottom. No labels.
- [x] Settings sidebar expanded: gear icon + "Settings" visible, collapse button at right.
- [x] Settings sidebar collapsed: 48 px rail with PanelLeftOpen, nav icons, Back-to-Chat at
      bottom.
- [x] Sidebar rounded corners are visible inside the transparent title bar area.
- [x] On macOS, none of the above Windows elements appear.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Window starts maximized | Restore icon shown immediately (synced via `win.isMaximized()` on mount). |
| Rapid maximize/restore | `onResized` listener updates icon without flicker. |
| Sidebar collapsed + window resized narrow | Collapsed rail stays at 48 px; no overflow. |
| macOS build | `isWindowsPlatform()` returns false; all Windows-only JSX is never rendered. |

## 6. Out of Scope

- Title bar text / conversation title on Windows (handled by `chat-titlebar-search` spec).
- A right-click context menu on the title bar drag region.
- Per-OS accent colour theming.
