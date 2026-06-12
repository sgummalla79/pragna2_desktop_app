# Technical Spec: Conversation List Item Context Menu

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-12
> **Last Updated**: 2026-06-12

---

## 1. Architecture Overview

The context menu is entirely within `ConversationListItem` — a presentation-layer component.
It delegates mutations to the existing `useConversationMutations` hooks (rename, pin, delete),
which call the application-layer services. No new hooks, services, or API changes.

## 2. Modified Files

| File | Change |
|------|--------|
| `src/presentation/views/chat/components/ConversationListItem.tsx` | Replaced three hover-icon buttons with `DropdownMenu` + `AlertDialog` |

## 3. Component Signature

```tsx
// No change to the public prop signature:
interface ConversationListItemProps {
  conversation: Conversation;
}
export function ConversationListItem({ conversation }: ConversationListItemProps): JSX.Element
```

## 4. State

| State | Type | Purpose |
|-------|------|---------|
| `editing` | `boolean` | Whether the inline rename form is active |
| `draft` | `string` | Current value of the rename input |
| `deleteOpen` | `boolean` | Whether the AlertDialog is open |
| `menuOpen` | `boolean` | Whether the DropdownMenu is open (keeps row highlighted) |

## 5. Menu Structure

```
DropdownMenu.Root (controlled: open=menuOpen)
  DropdownMenu.Trigger → MoreVertical button (opacity-0 → opacity-100 on group-hover)
  DropdownMenu.Portal
    DropdownMenu.Content (side="right", sideOffset=6, z-[600])
      DropdownMenu.Item → Pin / Unpin  (onSelect: togglePin)
      DropdownMenu.Item → Rename       (onSelect: setEditing(true))
      DropdownMenu.Separator
      DropdownMenu.Item → Delete       (onSelect: setDeleteOpen(true), destructive style)

AlertDialog.Root (controlled: open=deleteOpen) — sibling of the row div, outside the dropdown
  AlertDialog.Portal
    AlertDialog.Overlay  (z-[700], backdrop-blur)
    AlertDialog.Content  (z-[700])
      Cancel → setDeleteOpen(false)
      Delete → handleDelete()
```

### Why `AlertDialog` is a sibling (not inside `DropdownMenu`)
Radix `DropdownMenu` unmounts its `Content` when `open` becomes false. If `AlertDialog` were
nested inside the dropdown content, it would be unmounted the moment the dropdown closes — before
the dialog animation completes. Mounting it as a sibling (via a React fragment) lets it persist
independently.

## 6. Key Method Signatures

```ts
/** Submits the rename draft; no-op if empty or unchanged. */
function submitRename(e: FormEvent): void

/** Calls setPinned mutation; toggles pinned state. */
function togglePin(): void

/** Navigates away if active, then deletes the conversation. */
async function handleDelete(): Promise<void>
```

## 7. Styling Constants

```ts
const MENU_ITEM = cn(
  'flex cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-[13px] outline-none',
  'text-foreground data-[highlighted]:bg-sidebar-hover',
);

const MENU_ITEM_DESTRUCTIVE = cn(
  'flex cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-[13px] outline-none',
  'text-destructive data-[highlighted]:bg-destructive/10',
);
```

## 8. Error Handling

All three mutations log errors via `logger.fromError` with stable error codes:
- `CHT_005:rename` — rename mutation failure.
- `CHT_005:pin` — pin mutation failure.
- `CHT_006:delete` — delete mutation failure (caught in `handleDelete` try/catch).

## 9. Testing

`ConversationListItem.test.tsx` covers:
- Menu trigger renders on hover.
- Rename flow: opens form, submits new title.
- Delete flow: opens AlertDialog, confirms, calls delete mutation.

All 460 Vitest tests pass.
