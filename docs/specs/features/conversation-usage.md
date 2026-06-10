# Feature Spec: Conversation Usage & Cost (sidebar cost chip)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-10
> **Last Updated**: 2026-06-10

---

## 1. Overview

Surfaces each conversation's **running total cost** as a quiet chip on its
sidebar row, sourced from `GET /api/conversations/{id}/usage`. It is a faithful
port of the web app, whose only usage UI is this per-row cost chip (verified in
web-app commit `541aa2a`) — not a header panel. The endpoint also returns a
per-LLM-call breakdown (`records[]`) and token totals; like the web app, those
are fetched but not displayed.

## 2. Goals & Non-Goals

**Goals**
- [ ] Show a conversation's running total USD cost on its sidebar row.
- [ ] Hide the chip when the cost is `$0` (a fresh conversation stays clean).
- [ ] Keep the chip out of the way of the row's hover actions.
- [ ] Cost formatting that stays readable across sub-cent → dollar magnitudes.

**Non-Goals**
- A per-model or per-call breakdown view (records are fetched, not rendered —
  matches the web app).
- Token-count display (input/output totals are available but not shown).
- A chat-header usage panel (the TD-016 TODO text suggested one; the web app
  does not have it, so it was not built — see `docs/web-app-parity.md`).
- Live per-turn refresh (the chip catches up within the staleness window).

## 3. User Flow

- A conversation that has incurred cost shows a small `$X.XX` chip at the right
  edge of its sidebar row.
- Hovering (or keyboard-focusing) the row fades the chip out so the
  pin / rename / delete actions take the same slot — no layout shift.
- A brand-new / zero-cost conversation shows **no chip**.
- The chip's tooltip reads `Total cost so far: $X.XX`.

## 4. Acceptance Criteria

- [ ] A conversation with usage shows its running total cost, formatted by
      `formatUsd` (sub-cent → 6 dp, sub-dollar → 4 dp, else 2 dp).
- [ ] A `$0` / brand-new conversation shows no chip.
- [ ] Hover/focus reveals the row actions and hides the chip in the same slot.
- [ ] A deleted / not-owned conversation (404) shows no cost rather than an error.
- [ ] The chip is readable and unobtrusive from narrow → wide sidebar widths.

## 5. Gating & Edge Cases

- **404 (deleted mid-flight / multi-tab / not owned):** the data layer returns a
  zero-state aggregate, so the chip simply doesn't render — never an error.
- **Stale after a turn:** usage is not invalidated on run-finalize; the chip
  updates on the next fetch within the 60s staleness window or on remount.
- **Precision:** cost is carried as a string end-to-end and only parsed to a
  number at the `formatUsd` boundary.

## 6. UI / Theming

- Theme tokens only — the chip is `text-muted-foreground`, `text-[11px]`,
  `tabular-nums`, low opacity, fading on `group-hover` / `group-focus-within`.

## 7. Deferred

- A richer usage panel (per-model `records[]`, token splits) is intentionally
  out of scope to stay at web-app parity; the data layer already returns
  everything such a panel would need.
