# Technical Spec: Chat Sidebar Collapse + Title-bar Conversation Title

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-11
> **Last Updated**: 2026-06-11

---

## 1. Architecture

Presentation-only. Three concerns, each in one place:

1. **Collapse state** — `useUiStore` (zustand) holds `chatPaneCollapsed`,
   persisted to `localStorage` (key `pragna:chat-pane-collapsed`), alongside the
   existing `settingsPaneCollapsed`. Shared `readPersistedFlag` / `persistFlag`
   helpers avoid duplicating the storage logic.
2. **The toggle + hover flyout** — extracted into a shared component
   `TitlebarCollapseToggle`, now used by BOTH `SettingsSidebar` and `ChatView`,
   so the collapse interaction and the traffic-light alignment live once.
3. **Geometry** — all positions/sizes are constants in
   `src/constants/windowChrome.ts` (single source of truth), so the toggle, the
   rail, and the title-bar title stay mutually aligned.

## 2. Files Changed / Added

| File | Change |
|------|--------|
| `src/presentation/store/uiStore.ts` | Add `chatPaneCollapsed` + `toggleChatPane` + `setChatPaneCollapsed`; factor `readPersistedFlag`/`persistFlag`. |
| `src/components/ui/sidebar/TitlebarCollapseToggle.tsx` | **New.** The shared title-bar toggle + collapsed hover-flyout. |
| `src/presentation/components/settings/SettingsSidebar/SettingsSidebar.tsx` | Use `TitlebarCollapseToggle` (behavior unchanged). |
| `src/presentation/views/chat/ChatView.tsx` | Add the desktop (md+) collapse toggle + conditional rail; rail width via `CHAT_SIDEBAR_WIDTH_PX`. Mobile drawer unchanged. |
| `src/presentation/views/chat/ChatSessionView.tsx` | Render the conversation title in the title-bar strip (left-aligned, collapse-aware); remove the header row; reserve the title-bar zone via top padding. |
| `src/constants/windowChrome.ts` | Add `CHAT_SIDEBAR_WIDTH_PX`, `TOGGLE_BUTTON_PX`, `TITLE_GAP_PX`. |

## 3. Key Signatures

```ts
// uiStore.ts
chatPaneCollapsed: boolean;
toggleChatPane: () => void;            // flips + persists
setChatPaneCollapsed: (value: boolean) => void;

// TitlebarCollapseToggle.tsx
interface Props {
  collapsed: boolean;
  onToggle: () => void;
  openLabel: string;     // aria/title when collapsed (action = open)
  collapseLabel: string; // aria/title when expanded (action = collapse)
  flyout: ReactNode;     // content shown in the collapsed hover flyout
  flyoutClassName?: string;
}
```

## 4. Data Flow

- **Toggle:** `ChatView`/`SettingsSidebar` read `*PaneCollapsed` + pass the
  matching `toggle*` to `TitlebarCollapseToggle`. Click → `onToggle` → store
  flips + persists → the owning view re-renders (rail shown/hidden).
- **Title position:** `ChatSessionView` reads `chatPaneCollapsed` and computes a
  left offset — `TITLEBAR_TOGGLE_LEFT_PX + TOGGLE_BUTTON_PX + TITLE_GAP_PX`
  (collapsed) or `SIDEBAR_BOX_INSET_PX + CHAT_SIDEBAR_WIDTH_PX +
  SIDEBAR_BOX_GAP_PX + TITLE_GAP_PX` (expanded) — and renders a `fixed`,
  `pointer-events-none`, left-aligned title vertically centered on
  `TRAFFIC_LIGHT_Y`, with `maxWidth: calc(100vw - left - gap)` to truncate.

## 5. Flyout Sizing

The settings flyout (short nav) is content-sized (`max-h-[75vh]`). The chat
flyout wraps `<ChatSidebar/>` (which is `h-full`) in a fixed-height container
(`h-[70vh]`) so the conversation list scrolls inside the flyout rather than
collapsing to zero height.

## 6. Error Handling

- `persistFlag` swallows `localStorage` errors (private mode / unavailable) so a
  toggle never throws; the choice simply isn't persisted.
- No network or async paths; nothing else can fail.

## 7. Testing

- Unit: existing chat + settings suites stay green (107 chat / 460 total); the
  settings refactor is behavior-identical (same constants, same DOM/aria).
- Manual / e2e: collapse/expand at md+, hover flyout, persistence across
  navigation, title clearance of the controls in both states, narrow-width
  drawer fallback.

## 8. Notes

- Native macOS traffic-light position is set in `tauri.conf.json`
  (`trafficLightPosition`), mirrored by `TRAFFIC_LIGHT_X/Y` — desktop-only chrome
  the web app does not have; this is a styling divergence, not a feature gap.
