# Technical Spec: Title-bar Chat Search

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-11
> **Last Updated**: 2026-06-11

---

## 1. Overview

A fixed, title-bar search button (in `ChatView`) toggles a Radix-`Dialog` modal
(`ChatsSearchModal`) that renders a **shared** conversation-browse component
(`ChatsBrowser`). `ChatsBrowser` is extracted verbatim from the existing
`ChatsBrowserView` (`/chat/history`) so the page and the modal use one
implementation. The button's position is derived from the existing
`windowChrome` title-bar constants. The "All chats" sidebar item is deleted and
the collapsed conversation-title offset is shifted to clear the new button.

## 2. Architecture & Layer Placement

Presentation-only; no Domain/Application/Rust changes.

- **Domain**: none.
- **Application**: none.
- **Adapters (frontend)**:
  - New `ChatsBrowser` (presentation component) — shared search + infinite list.
  - New `ChatsSearchModal` (presentation component) — Dialog host for it.
  - `ChatView` — adds the search button + modal open-state.
  - `ChatsBrowserView` — refactored to consume `ChatsBrowser`.
  - `ChatSidebar` — removes the "All chats" button.
  - `ChatSessionView` — collapsed title offset now clears the search button.
  - `windowChrome` — new constants for the button's left/top geometry.

## 3. Data Flow

```
ChatView (searchOpen state)
  └─ search button onClick → setSearchOpen(true)
       └─ ChatsSearchModal(open) → Dialog
            └─ ChatsBrowser(onSelect=close)
                 └─ useInfiniteConversations() → conversation pages
                 └─ row <Link> onClick → navigate(/chat/:id) + onSelect() → setSearchOpen(false)
```

## 4. Module & File Layout

```
src/
  constants/
    windowChrome.ts                         (+ TITLEBAR_ACTION_GAP_PX,
                                               TITLEBAR_SEARCH_LEFT_PX,
                                               TITLEBAR_ACTION_Y_NUDGE_PX,
                                               TITLEBAR_ACTION_TOP_PX)
  presentation/views/chat/
    ChatView.tsx                            (search button + modal wiring)
    ChatSessionView.tsx                     (collapsed title offset)
    ChatsBrowserView.tsx                    (consumes ChatsBrowser)
    components/
      ChatsBrowser.tsx                      (new — shared browse UI)
      ChatsSearchModal.tsx                  (new — Dialog host)
      ChatSidebar.tsx                       ("All chats" removed)
```

## 5. Method Specifications

### `ChatsBrowser`

#### `ChatsBrowser({ onSelect?, autoFocusSearch? }) -> JSX.Element`

| Field | Detail |
|-------|--------|
| **Purpose** | Render the shared conversation-browse UI: title-only client-side search over loaded pages + infinite-scroll list with an IntersectionObserver sentinel. |
| **Inputs** | `onSelect?: () => void` — fired when a result row is chosen (lets a modal host dismiss). `autoFocusSearch?: boolean` — focus the search box on mount. |
| **Output** | A `min-h-0` flex column filling its parent; host owns surrounding chrome. |
| **Errors** | Surfaces the query hook's error state inline ("Couldn't load conversations."). |
| **Side Effects** | Reads conversations via `useInfiniteConversations`; observes a sentinel to fetch the next page. |
| **Invariants** | Layout-agnostic — never assumes page vs modal; navigation is via `<Link>` so routing is unchanged. |

### `ChatsSearchModal`

#### `ChatsSearchModal({ open, onOpenChange }) -> JSX.Element`

| Field | Detail |
|-------|--------|
| **Purpose** | Host `ChatsBrowser` inside a centered Radix Dialog as the "All chats" popup. |
| **Inputs** | `open: boolean`; `onOpenChange: (open: boolean) => void` (Esc / backdrop / close). |
| **Output** | Dialog with a header ("All chats") and the browser; `onSelect` closes it. |
| **Side Effects** | None beyond Dialog portal mount/unmount. |
| **Invariants** | Closing never navigates; selecting a row navigates then closes. |

### `ChatView` (changed)

| Field | Detail |
|-------|--------|
| **Purpose** | Owns `searchOpen` state, renders the fixed title-bar search button and the `ChatsSearchModal`. |
| **Side Effects** | None; pure UI state. |

## 6. Error Handling Strategy

No new error types. Data-load errors are surfaced inline by `ChatsBrowser`
(loading / error / empty states), identical to the prior `/chat/history` view.

## 7. Configuration & Constants

| Constant | Source | Description |
|----------|--------|-------------|
| `TITLEBAR_ACTION_GAP_PX` | `windowChrome.ts` | Gap between adjacent title-bar action buttons (toggle → search); `0` = flush. |
| `TITLEBAR_SEARCH_LEFT_PX` | `windowChrome.ts` | Left offset of the search button = toggle left + toggle width + gap. |
| `TITLEBAR_ACTION_Y_NUDGE_PX` | `windowChrome.ts` | ½px optical nudge so the lucide title-bar glyphs read centered on the lights. |
| `TITLEBAR_ACTION_TOP_PX` | `windowChrome.ts` | Vertical center of the title-bar action icons (search + mobile hamburger). |

No hard-coded offsets remain in `ChatView`; all geometry references the
constants above.

## 8. Testing Plan

| Test | Type | What It Verifies |
|------|------|-----------------|
| `ChatsBrowserView.test.tsx` (existing) | unit | List, title search, empty/no-match states, "New chat" navigation — still green after the `ChatsBrowser` extraction (behavior preserved). |
| `smoke-auth.spec.ts` (updated) | e2e | Authenticated chat chrome renders — now keyed off the "Search chats" title-bar button (was the removed "All chats" button). |
| Typecheck (`tsc --noEmit`) | static | No dead imports; renamed constants resolve. |

## 9. Dependencies & External Integrations

None new. Reuses `@/components/ui/dialog` (Radix), `useInfiniteConversations`,
and `react-router-dom` already in the project.

## 10. Open Questions / Risks

- [ ] Title-bar action icons (`z-70`) sit above the Dialog overlay (`z-50`), so
      they stay bright over the dimmed backdrop — consistent with the native
      traffic lights; accepted as-is.

---

_Link to Feature Spec: [features/chat-titlebar-search.md](../features/chat-titlebar-search.md)_
