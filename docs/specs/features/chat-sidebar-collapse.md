# Feature Spec: Chat Sidebar Collapse + Title-bar Conversation Title

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-11
> **Last Updated**: 2026-06-11

---

## 1. Overview

The desktop chat view gains a **collapsible conversation sidebar** on desktop
(md and up), mirroring the existing settings sidebar exactly: a toggle next to
the macOS traffic lights hides the conversation rail (widening the transcript)
and, while collapsed, reveals the conversation list as a hover flyout. The
collapse choice is persisted across navigation. Alongside this, the **active
conversation title is rendered in the window title-bar strip** (macOS-style,
left-aligned) instead of as a header row above the messages, so it never
consumes transcript height and never overlaps the window controls.

## 2. Goals & Non-Goals

**Goals**
- [x] Desktop (md+) chat sidebar can be collapsed/expanded via a toggle by the
      traffic lights, identical in behavior to the settings sidebar.
- [x] While collapsed, hovering the toggle reveals the conversation list as a
      floating flyout (scrollable).
- [x] The collapse choice persists across navigation (localStorage).
- [x] The conversation title shows in the window title-bar strip, left-aligned,
      clear of the window controls in both collapsed and expanded states.
- [x] The toggle/title alignment and the rail width come from a single set of
      `windowChrome` constants shared by settings and chat.

**Non-Goals**
- Collapsing the sidebar on narrow (< md) widths — that path keeps the existing
  slide-over drawer.
- Changing the settings sidebar's behavior (only its toggle markup was extracted
  into a shared component; behavior is unchanged).
- Any backend or data change — this is presentation-only.

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| user | collapse the conversation sidebar on desktop | I get more width for the transcript |
| user | still reach my conversations while collapsed | I can switch chats without fully expanding |
| user | have my collapse choice remembered | it persists as I navigate between chats |
| user | see the conversation title in the title bar | the transcript isn't shortened by a header row |

## 4. Acceptance Criteria

- [x] Given the chat view at md+ width, when I click the toggle by the traffic
      lights, then the conversation rail hides and the transcript widens.
- [x] Given the sidebar is collapsed, when I hover the toggle, then the
      conversation list appears as a floating flyout; selecting an item
      navigates and closes the flyout.
- [x] Given I collapse the sidebar and navigate to another chat, then it stays
      collapsed (persisted).
- [x] Given any conversation, the title appears in the title-bar strip,
      left-aligned: after the sidebar box when expanded, after the traffic
      lights + collapse toggle + search button when collapsed — never
      overlapping the controls or the title-bar actions.
- [x] Given a very long title, it truncates before the right window edge.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Narrow (< md) width | Rail + collapse toggle are hidden; the mobile drawer + its hamburger are used instead. |
| localStorage unavailable | Collapse still toggles in-memory; persistence is skipped silently. |
| Long conversation list while collapsed | Flyout is height-bounded (70vh) and scrolls internally. |
| Untitled conversation | Title bar shows the standard "Untitled" fallback. |

## 6. Out of Scope

- A keyboard shortcut for collapse/expand.
- Remembering a per-conversation collapse state (the choice is global).
- Centering the title over the message column (it is left-aligned by design).
