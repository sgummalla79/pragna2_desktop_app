# Feature Spec: Account Menu (chat sidebar avatar + sign-out)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-10
> **Last Updated**: 2026-06-12

---

## 1. Overview

Adds an **account menu** to the chat sidebar footer: an avatar pill showing the
signed-in user, which opens a dropdown with the user's email, a **Settings**
shortcut, and **Sign out**. It is a faithful port of the web app's
`AvatarMenu` (chat sidebar footer).

Before this, the desktop app had **no sign-out affordance reachable from the
running app** — the only `logout()` button lived on the orphaned `HomeView`,
which is no longer in the routed flow now that the real chat surface shipped. A
signed-in user could not sign out, see their account, or reach settings from a
single, conventional place.

## 2. Goals & Non-Goals

**Goals**
- [x] Surface the signed-in user (avatar initial + display name) in the sidebar.
- [x] Provide **Sign out** from inside the running app (chat + mobile drawer).
- [x] Provide a **Settings** shortcut consistent with the web app.
- [x] Keyboard-accessible, focus-trapped dropdown (Radix).

**Non-Goals**
- A collapsed/icon-only mode (the desktop chat rail is not collapsible, unlike
  the web app — see `docs/web-app-parity.md`).
- Profile editing, theme switching from this menu (theme lives on the new
  Appearance page; profile remains a stub).
- An avatar image/photo (initial glyph only, matching the web app).

## 3. User Flow

- The chat sidebar footer shows an avatar pill: a circular initial + the user's
  display name (name, falling back to email) + a chevron.
- Clicking (or focusing + Enter) opens a menu above the pill containing:
  the user's email (non-interactive label), **Settings**, and **Sign out**.
- **Settings** navigates to `/settings`; in the mobile drawer it also closes the
  drawer.
- **Sign out** clears the session and returns to `/login`.

## 4. Acceptance Criteria

- [x] The pill shows the display name, preferring `user.name` over `user.email`,
      with a defensive `Account` fallback when no user is present.
- [x] The avatar initial is the uppercased first character of name → email → `?`.
- [x] The menu lists the email label, Settings, and Sign out.
- [x] Selecting Settings calls navigation to `/settings`.
- [x] Selecting Sign out resets the auth store (`isAuthenticated → false`,
      `user → null`) and navigates to `/login`; the `ProtectedRoute` guard also
      enforces the redirect.
- [x] Works in both the desktop rail and the mobile drawer (drawer closes on
      navigation via `onNavigate`).
- [x] Menu is keyboard-navigable and dismissible with Escape.

## 5. Edge Cases

- **No user / not bootstrapped**: renders `Account` and `Signed in`; never throws.
- **Long display name / email**: truncates with ellipsis; no layout overflow at
  the 260px rail or 280px drawer width.
- **Email-only user (`name` null)**: name row + initial both fall back to email.

## 6. Responsive Design

The pill is full-width (`w-full`) with a truncating label, so it adapts to the
260px desktop rail and the ≤85vw mobile drawer without overflow. The dropdown
opens `side="top"` (the footer sits at the bottom of the rail) with a fixed
min-width and is portalled above all chrome.

## 7. Sidebar footer visual consistency (2026-06-12)

The pinned footer rows in both sidebars were brought in line with the nav rows
above them (a visual-consistency fix; behaviour unchanged). Logged as a
backportable web-app fix in `docs/CODE_FIXES.md` **CF-010** (the web app shares
`AvatarMenu` / `SidebarBackItem` with the same mismatch).

- **Avatar user name** (`AvatarMenu`): resting text dimmed from full
  `text-foreground` to **`text-foreground/80`** with **`hover:text-foreground`**,
  matching the chat sidebar's nav rows. The avatar initial badge, chevron, and
  open-state highlight are unchanged.
- **Settings "Back to Chat"** (`SidebarBackItem`): row metrics aligned to
  `SidebarNavItem` (**`gap-3 px-3 h-8`**), resting text set to
  **`text-sidebar-foreground/70`** + `hover:text-sidebar-accent-foreground`, and
  the icon swapped to a **circular back-arrow badge** — `bg-foreground` /
  `text-background` so it inverts per theme (white circle + dark arrow in dark
  mode, the reverse in light mode), wrapped in a 20px box so the icon edge and
  label line up with the nav tiles. The back-arrow **icon style** is a UI-only
  deviation from the web app's `MessagesSquare` (see `docs/web-app-parity.md`);
  the alignment + color sync is the part to backport (CF-010).
