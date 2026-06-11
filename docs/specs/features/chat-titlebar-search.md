# Feature Spec: Title-bar Chat Search

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-11
> **Last Updated**: 2026-06-11

---

## 1. Overview

The chat shell gains a **search button** in the window title-bar strip,
immediately right of the sidebar collapse/expand toggle. Clicking it opens an
**"All chats" modal popup** — a search box over the full conversation history
plus an infinite-scroll list — letting the user find and jump to any
conversation from anywhere in the chat surface without first expanding the rail
or leaving the current chat. This replaces the previous **"All chats"** item in
the sidebar menu, which has been removed (the title-bar search is now the single
entry point to browse history). The existing full-page `/chat/history` route is
unchanged and still reachable.

## 2. Goals & Non-Goals

**Goals**
- [x] A magnifying-glass button sits in the title bar, right of the collapse
      toggle, on both desktop and narrow widths.
- [x] Clicking it opens a centered modal showing the "all chats" browse view
      (title-only search + infinite-scroll history list).
- [x] Selecting a conversation navigates to it and dismisses the modal.
- [x] The browse UI (search + list) is shared with the full-page
      `/chat/history` view — one implementation, two hosts.
- [x] The redundant "All chats" sidebar menu item is removed.
- [x] Title-bar geometry (button position) comes from `windowChrome` constants;
      no hard-coded offsets.

**Non-Goals**
- Full-text search over message bodies — search is title-only over loaded pages,
  identical to the existing `/chat/history` behavior.
- Removing or changing the `/chat/history` route/page.
- A keyboard shortcut to open the modal.

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| user | search my chats from the title bar | I can jump to any conversation without expanding the rail |
| user | open search while the sidebar is collapsed | I don't have to expand it just to find a chat |
| user | pick a result and land in that chat | the modal gets out of the way immediately |

## 4. Acceptance Criteria

- [x] Given the chat surface, a "Search chats" button is visible in the title
      bar just right of the collapse toggle.
- [x] Given I click the search button, then a modal opens with a focused search
      box and the conversation list.
- [x] Given I type in the modal search box, then the list filters by title
      (case-insensitive) over what's loaded.
- [x] Given I click a conversation in the modal, then it navigates to that chat
      and the modal closes.
- [x] Given I press Esc or click the backdrop, then the modal closes with no
      navigation.
- [x] Given the sidebar menu, there is no "All chats" item (moved to title bar).

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| No conversations yet | Modal shows the "No conversations yet" empty state. |
| Query matches nothing | Modal shows the `No chats match "<query>"` empty state. |
| History longer than one page | Infinite-scroll sentinel loads more as the list scrolls inside the modal. |
| Conversations still loading | Modal shows the "Loading conversations…" state. |
| Load failure | Modal shows the "Couldn't load conversations." error state. |
| Narrow (< md) width | Search button still shows in the title bar, right of the mobile drawer hamburger. |

## 6. Out of Scope

- Message-body / semantic search.
- Recent-search history or pinned results inside the modal.
- Multi-select or bulk actions on results.

## 7. Open Questions

- [ ] None.

---

_Link to Technical Spec: [technical/chat-titlebar-search.md](../technical/chat-titlebar-search.md)_
