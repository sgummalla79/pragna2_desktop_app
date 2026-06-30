# Feature Spec: Citations report — inline [n] footnote backlinks

> **Status**: Implemented (Tier 3)
> **Author**: Suman Gummalla
> **Created**: 2026-06-29
> **Last Updated**: 2026-06-29

---

## 1. Overview

The backend's `citations` flow node emits an assistant markdown message: prose
with literal numbered markers `[1]`, `[2]`… followed by a `## References` list of
`[title](url)` sources. Tiers 1–2 made the References links open externally and
added a FlowBuilder node. This tier makes the **in-text `[n]` markers clickable**:
clicking `[2]` scrolls to and briefly highlights the matching References entry —
standard footnote-backlink behaviour.

Fully FE-side: it relies on the backend's deterministic numbering (marker `n` ↔
the n-th cited source) and needs no new backend field. It is **Tier 3** of
pragna2_desktop_app#99 (moved from nexus-kit-tracker #238).

## 2. Goals & Non-Goals

**Goals**
- [x] Each in-text `[n]` that has a matching References item renders as a clickable
      in-page backlink.
- [x] Clicking it scrolls the matching References entry into view and flashes it.
- [x] It stays in-page — never opens a browser tab, never navigates the webview,
      never changes the URL.
- [x] Graceful degradation: with no References list, or an `[n]` with no matching
      item, the marker stays plain text.

**Non-Goals**
- Forward links (References item → back to each citing location). Out of scope.
- Renumbering / dedup of citations — the backend owns that.
- Changing how References `[title](url)` links behave (still open externally, Tier 1).

## 3. User Flow

- An assistant returns a citations report. The inline `[1]`, `[2]` now look/behave
  like footnote links.
- The reader clicks `[2]` → the page scrolls to References entry 2, which flashes
  briefly so the eye lands on it. The conversation stays put (no tab, no nav).
- Clicking a References `[title](url)` link still opens the source in the browser.

## 4. Acceptance Criteria

- [x] In a report with a References list, each in-text `[n]` (1…count) renders as
      an anchor to `#cite-ref-<n>`; the n-th References item carries that id.
- [x] Clicking a backlink scrolls to + flashes the item; `preventDefault` stops any
      hash navigation; `openExternal` is **not** called.
- [x] An out-of-range marker (e.g. `[9]` with 2 references) stays literal text.
- [x] A report with no References section leaves all `[n]` literal.
- [x] Markers inside code spans/blocks are never linkified.
- [x] Reduced-motion users get no flash animation (the scroll still happens).

## 5. Gating & Edge Cases

- **Scope to the message:** ids repeat across messages (each report has its own
  `cite-ref-1`); the click resolves the target within the *same* `.chat-markdown`
  wrapper so it never jumps to another message's reference.
- **Streaming:** mid-stream the References list may not have arrived yet; the
  marker stays literal until the final render resolves it (no special handling).
- **No false links:** a marker is only linkified when a matching References item
  exists, so stray `[3]` in prose without a 3rd source stays text.

## 6. UI / Theming

- Backlinks render inline with the prose (no underline at rest, underline on
  hover, tabular numerals). The flash is a ~1.5s amber highlight that reads in
  both light and dark themes; suppressed under `prefers-reduced-motion`.

## 7. Deferred

- Nothing outstanding for citations after this tier. Forward-links (reference →
  citing site) could be a future enhancement if requested.

---

_Link to Technical Spec: [technical/citations-inline-backlinks.md](../technical/citations-inline-backlinks.md)_
