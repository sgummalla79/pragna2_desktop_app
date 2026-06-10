# Technical Spec: Account Menu (chat sidebar avatar + sign-out)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-10
> **Last Updated**: 2026-06-10

Related feature spec: `docs/specs/features/account-menu.md`.

---

## 1. Architecture

A single presentational component, `AvatarMenu`, mounted in the `ChatSidebar`
footer. It depends only on existing abstractions — the `useAuth` hook and the
router — and adds no new service, port, or store. This keeps the change inside
the presentation layer (Single Responsibility: the component renders the menu
and delegates identity/sign-out to `useAuth`).

```
ChatSidebar (footer)
  └─ AvatarMenu
       ├─ useAuth()            → { user, logout }   (presentation/hooks/auth)
       ├─ useNavigate()        → react-router
       └─ radix-ui DropdownMenu (keyboard nav, focus-trap, escape, portal)
```

## 2. Files

| File | Change |
|---|---|
| `src/presentation/views/chat/components/AvatarMenu.tsx` | **New.** The account dropdown. |
| `src/presentation/views/chat/components/ChatSidebar.tsx` | Footer now renders `<AvatarMenu onNavigate={onNavigate} />` instead of a bare Settings link. |
| `src/presentation/views/chat/components/AvatarMenu.test.tsx` | **New.** Unit tests. |
| `src/__tests__/setup.ts` | Added Pointer Capture polyfills (jsdom) so Radix menus open under test. |

## 3. Component contract

```ts
interface AvatarMenuProps {
  /** Called after a navigation action — lets the mobile drawer close itself. */
  onNavigate?: () => void;
}
```

### Key functions

```ts
/** Single-character avatar glyph, preferring name over email, '?' fallback. */
function avatarInitial(name: string | null | undefined, email: string | undefined): string

/** Navigate to settings, then notify the drawer. */
const goSettings = () => { navigate(ROUTES.SETTINGS); onNavigate?.(); }

/** Reset session via useAuth, notify the drawer, redirect to login. */
const handleSignOut = () => { logout(); onNavigate?.(); navigate(ROUTES.LOGIN, { replace: true }); }
```

`displayName = user?.name || user?.email || 'Account'`.

## 4. Dependency choices

- **`radix-ui` DropdownMenu** — imported from the already-present unified
  `radix-ui` package (`^1.5.0`, the same one `Dialog` is used from across the
  settings views). **No new dependency added.** The web app uses the split
  `@radix-ui/react-dropdown-menu`; the unified package exposes the identical
  namespaced API (`DropdownMenu.Root/Trigger/Portal/Content/Item/...`).
- **No hardcoding** — routes come from `ROUTES`; all colors/spacing are theme
  tokens (`bg-popover`, `text-foreground`, `ring`, `bg-accent`, …).

## 5. Sign-out flow

`useAuth().logout()` already encapsulates the teardown: `authService.logout()` →
`tokenStorage.clearAll()` → `authStore.reset()`. The reset flips
`isAuthenticated` to `false`; `ProtectedRoute` observes the store and renders
`<Navigate to="/login">`. The explicit `navigate(ROUTES.LOGIN, { replace: true })`
makes the redirect immediate and matches `HomeView`'s prior behavior. No new
teardown logic is introduced.

## 6. Error handling

The component is pure rendering over store state; it has no async paths of its
own. Identity is read defensively (optional chaining + fallbacks), so an absent
or partially-hydrated user renders safely rather than throwing.

## 7. Testing

`AvatarMenu.test.tsx` (6 tests) mounts under `MemoryRouter` + `ServiceContext`
with the real `useAuthStore` seeded:
- display name prefers `name` over `email`; initial derived correctly;
- email-only fallback (name `null`);
- menu opens and exposes the email label, Settings, and Sign out;
- Settings → `navigate('/settings')`;
- Sign out → `authService.logout` called, store reset
  (`isAuthenticated=false`, `user=null`), `navigate('/login', {replace:true})`;
- no-user defensive `Account` fallback.

`useNavigate` is mocked; `authService.logout` is a `vi.fn()` while the real
`useAuth.logout` runs (so the store-reset path is genuinely exercised). Radix
interaction relies on the Pointer Capture polyfills added to `setup.ts`.

## 8. Deviations from the web app

- **No collapsed/icon-only mode.** The web app's `AvatarMenu` takes a
  `collapsed` prop for its collapsible rail; the desktop chat rail is fixed-width
  (260px) / drawer (280px) and not collapsible, so the prop is omitted. Recorded
  in `docs/web-app-parity.md`.
