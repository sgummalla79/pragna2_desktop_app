# Feature Spec: Citations report — external-open References links

> **Status**: Implemented (Tier 1)
> **Author**: Suman Gummalla
> **Created**: 2026-06-27
> **Last Updated**: 2026-06-27

---

## 1. Overview

The backend's deterministic `citations` flow node emits a normal assistant
markdown message: synthesis prose with inline numbered markers `[1]`, `[2]`…
followed by a `## References` section listing cited sources as markdown links
`[title](url)`. It arrives over the existing assistant stream — no new event or
message shape — so it already renders through the chat markdown renderer.

The one piece that does **not** work automatically is the links: in the Tauri
webview a bare `[title](url)` click navigates the *app's own* webview (replacing
the running UI with the remote page) instead of opening the system browser. A
deep-research report's value is its clickable sources, so this makes the feature
payoff broken. This feature makes assistant-message `http(s)` links open in the
system browser, and confirms inline `[n]` markers render as literal text.

Covers pragna2_desktop_app#99 (Tier 1; moved from nexus-kit-tracker #238).
Cross-repo follow-up to BE #233.

## 2. Goals & Non-Goals

**Goals**
- [x] Clicking an `http`/`https` link in an assistant message opens it in the
      user's default browser, never the app webview.
- [x] Inline citation markers like `[1]` render as literal text, not links, and
      are never swallowed/misparsed.
- [x] Behaviour is identical in the Tauri runtime and the plain-browser fallback
      (dev / e2e), routed through the platform layer.

**Non-Goals**
- Tier 2 — a visual FlowBuilder "Citations" node (tracked separately on its own
  branch under pragna2_desktop_app#99).
- Tier 3 — clickable inline `[n]` footnote backlinks that scroll to the matching
  References entry (now implemented — see
  [citations-inline-backlinks.md](citations-inline-backlinks.md)).
- Changing the blocked-link policy for non-web hrefs — `sandbox:`/`mailto:` etc.
  continue to degrade to plain text (see `chat-markdown` spec / harden policy).

## 3. User Flow

- An assistant returns a citations report: prose with `[1]`, `[2]` markers and a
  `## References` list of `[title](url)` links.
- The reader clicks a reference link → it opens in their default system browser;
  the app window keeps showing the conversation.
- The inline `[1]` markers stay as plain text inline with the prose.

## 4. Acceptance Criteria

- [x] A click (including modifier-click) on an `http(s)` assistant link opens the
      system browser and does **not** navigate the app webview.
- [x] An inline `[1]` renders as the literal text `[1]`, not an anchor.
- [x] A non-web href (e.g. `sandbox:/mnt/data/x.pdf`) still degrades to plain
      text (unchanged behaviour) and is never handed to the opener.
- [x] In the plain-browser fallback the same link opens a new tab
      (`noopener,noreferrer`).
- [x] An opener failure is logged (not silently swallowed) and never crashes the
      message.

## 5. Gating & Edge Cases

- **Runtime, not OS:** the transport is chosen by `isTauriRuntime()`, so a plain
  browser reporting any OS (the e2e Windows-UA device) takes the `window.open`
  path and never calls a Tauri-only API at render. See CLAUDE.md § Platform
  Abstraction / CF-011.
- **Scheme allow-list:** only `http:`/`https:` are handed to the opener; an
  untrusted model-emitted href cannot drive it into `file:`/`javascript:`.
- **Reference-style vs inline:** `[1]` with no matching `[1]: url` definition is
  literal text; the real links live in `## References` as inline `[title](url)`.

## 6. UI / Theming

- No new UI. Links keep their existing anchor styling; only the click target
  (system browser vs. app webview) changes.

## 7. Deferred

- Tier 2 (FlowBuilder Citations node) and Tier 3 (inline `[n]` backlinks) are now
  implemented — see their specs (`flowbuilder-citations-node.md`,
  `citations-inline-backlinks.md`). Tracked under pragna2_desktop_app#99.

---

_Link to Technical Spec: [technical/citations-external-links.md](../technical/citations-external-links.md)_
