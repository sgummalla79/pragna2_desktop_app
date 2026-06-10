# Technical Spec: Conversation History Browser

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-10
> **Last Updated**: 2026-06-10

Related feature spec: `docs/specs/features/conversation-history.md`.

---

## 1. Architecture

A route-mounted view backed by a TanStack `useInfiniteQuery` hook over the
existing `conversationService.list({ limit, offset })`. No new service, port, or
backend contract — only a new hook + view + a pure formatting util.

```
/chat/history (nested under ChatView) → ChatsBrowserView
  ├─ useInfiniteConversations()      → conversationService.list({limit, offset})
  ├─ relativeTime(iso)               → domain/utils (pure, tested)
  └─ IntersectionObserver sentinel   → fetchNextPage on scroll
```

## 2. Files

| File | Change |
|---|---|
| `src/domain/utils/relativeTime.ts` | **New.** Pure "time ago" formatter. |
| `src/presentation/hooks/conversations/useInfiniteConversations.ts` | **New.** Offset-paged infinite query. |
| `src/presentation/views/chat/ChatsBrowserView.tsx` | **New.** The browser view. |
| `src/constants/routes.ts` | Added `CHAT_HISTORY = '/chat/history'`. |
| `src/presentation/router/AppRoutes.tsx` | Nested `history` route (static, ranks above `:id`). |
| `src/presentation/views/chat/components/ChatSidebar.tsx` | Added an **All chats** entry. |
| `src/__tests__/setup.ts` | Added an `IntersectionObserver` stub (jsdom). |
| `*.test.ts(x)` | `relativeTime` (5), `useInfiniteConversations` (3), `ChatsBrowserView` (6). |

## 3. Pagination contract

```ts
useInfiniteQuery<Conversation[]>({
  queryKey: ['conversations', 'infinite'],
  initialPageParam: 0,
  queryFn: ({ pageParam }) =>
    conversationService.list({ limit: DEFAULT_PAGE_SIZE, offset: pageParam * DEFAULT_PAGE_SIZE }),
  getNextPageParam: (lastPage, allPages) =>
    lastPage.length < DEFAULT_PAGE_SIZE ? undefined : allPages.length,
})
```

Offset-based; "fewer than a full page" is the end-of-data signal (no `hasMore`
field needed from the API). `DEFAULT_PAGE_SIZE` comes from `constants/pagination`.

## 4. `relativeTime`

```ts
export function relativeTime(iso: string, now: number = Date.now()): string
```

Injectable `now` for deterministic tests. Boundary values (`MINUTE_MS`,
`HOUR_MS`, `DAY_MS`, `RELATIVE_DAY_CUTOFF = 30`) are time arithmetic constants in
a SCREAMING_SNAKE_CASE block. Sub-minute and future diffs clamp to "1 minute
ago"; past 30 days falls back to `toLocaleDateString`.

## 5. Infinite scroll

An `IntersectionObserver` (rootMargin `200px`) on a sentinel `<div>` below the
list calls `fetchNextPage()` when it scrolls into view, guarded by
`hasNextPage && !isFetchingNextPage`. The observer is only created when
`hasNextPage` is true and is disconnected on cleanup.

## 6. Routing note

`history` is registered as a **static** child of `/chat`, which React Router
ranks above the dynamic `:id`, so `/chat/history` resolves to the browser (not a
conversation with id "history").

## 7. Testing

- **`relativeTime.test.ts`**: minute/hour pluralisation, yesterday, N-days, the
  30-day absolute-date cutoff, and clock-skew clamping — all with a fixed `now`.
- **`useInfiniteConversations.test.tsx`**: first page at offset 0, `hasNextPage`
  on a full page, next page at offset `DEFAULT_PAGE_SIZE`, stop on a short page.
- **`ChatsBrowserView.test.tsx`**: list + relative time, case-insensitive search,
  no-match + empty states, "Untitled chat" fallback, New-chat navigation.

## 8. Deviations from the web app

- **Route vs. browse-mode.** The web app toggles a `browseMode` flag inside its
  `ChatView` and renders the browser in place; the desktop is route-based, so
  the browser is a nested `/chat/history` route and **New chat** navigates rather
  than clearing a flag. Same UI/behaviour. Recorded in `docs/web-app-parity.md`.
- **`relativeTime` extracted** to `domain/utils` (the web app inlines it in the
  view) for unit-testability — no behavioural change.
