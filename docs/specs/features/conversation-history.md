# Feature Spec: Conversation History Browser

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-10
> **Last Updated**: 2026-06-10

---

## 1. Overview

A full-width **conversation history browser** at `/chat/history`: every past
conversation in one scrollable list with **title search**, **infinite scroll**,
and **relative timestamps** ("3 hours ago", "yesterday", "5 days ago", then an
absolute date). Reached from the chat sidebar's **All chats** entry. Faithful
port of the web app's `ChatsBrowserView`.

Before this, the desktop only showed the recent conversations in the sidebar —
there was no way to browse, search, or page through the full history.

## 2. Goals & Non-Goals

**Goals**
- [x] Browse all conversations newest-first, paged via infinite scroll.
- [x] Client-side title search over loaded conversations.
- [x] Relative timestamps with an absolute-date fallback for old chats.
- [x] Open a conversation; start a new chat.

**Non-Goals**
- Server-side search (the web app also filters client-side over loaded pages).
- Bulk actions (delete/pin from the browser) — those live on the sidebar rows.

## 3. User Flow

- Chat sidebar → **All chats** opens `/chat/history`.
- The page shows a title, a **New chat** button, a search box, and the list.
- Typing filters the loaded list by title (case-insensitive).
- Scrolling to the bottom loads the next page automatically.
- Clicking a row opens `/chat/{id}`; **New chat** returns to the landing.

## 4. Acceptance Criteria

- [x] Conversations render newest-first with a relative timestamp each.
- [x] Search filters by title, case-insensitive; a non-matching query shows a
      "No chats match …" empty state.
- [x] An empty account shows "No conversations yet. Start chatting!".
- [x] A null/blank title renders as "Untitled chat".
- [x] Reaching the bottom fetches the next page; a short page ends pagination.
- [x] New chat navigates to `/chat`.

## 5. Edge Cases

- **Load error**: shows a "Couldn't load conversations." message.
- **Clock skew (future `createdAt`)**: clamps to "1 minute ago".
- **Single short page**: no infinite-scroll sentinel work; pagination ends.

## 6. Responsive Design

The list sits in a `max-w-3xl` centered column with comfortable padding; rows
truncate long titles and keep the timestamp pinned right. Usable from the
narrowest window (the page scrolls within the chat `<main>`) up to wide displays.
