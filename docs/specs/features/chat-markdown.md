# Feature Spec: Chat Markdown Renderer (KaTeX math + diagrams + smooth streaming)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-10
> **Last Updated**: 2026-06-10

---

## 1. Overview

The assistant-message renderer, brought to full parity with the web app's
`MarkdownMessage`. On top of Phase-1's GFM + Shiki code highlighting it adds
**KaTeX math**, **Mermaid** and inline **`sketchon` diagrams**, and a
**smooth-streaming reveal** (steady typewriter cadence + per-block fade-in). The
renderer is Streamdown (the same package + version the web app uses); this feature
is about configuring it fully and adding the two pieces Streamdown doesn't ship:
math-delimiter normalization and the `sketchon` plugin/component.

Covers pragna2-tracker TD-019 (KaTeX math + sketchon diagrams + smooth streaming) and pragna2-tracker TD-017
(the deliberate, documented decision to **keep Streamdown**).

## 2. Goals & Non-Goals

**Goals**
- [ ] Render LaTeX math from any provider (`\(…\)` / `\[…\]` and `$…$` / `$$…$$`).
- [ ] Render Mermaid diagrams (pan/zoom/fullscreen/copy/download) and inline
      `sketchon` diagrams from a ```` ```sketchon ```` fenced spec.
- [ ] Reveal streamed replies smoothly (typewriter cadence + per-block fade-in).
- [ ] Keep code highlighting (Shiki) with light/dark themes.
- [ ] Record the renderer-footprint decision (keep Streamdown).

**Non-Goals**
- Switching renderers (react-markdown etc.) — the web app uses Streamdown, so
  switching would create drift, not parity.
- Authoring/editing diagrams — render-only.
- Trimming Streamdown's diagram/grammar chunks (they are lazy; see §5).

## 3. User Flow

- An assistant reply renders as rich markdown: headings, lists, tables, task
  lists, fenced code with copy buttons, math, and diagrams.
- **Math:** `$E=mc^2$` (inline) / `$$…$$` (display) render via KaTeX, regardless of
  whether the model emitted dollar or backslash delimiters.
- **Mermaid:** a ```` ```mermaid ```` block renders an interactive diagram; wheel
  zoom is throttled so a single scroll gesture zooms gradually.
- **Sketchon:** a ```` ```sketchon ```` block renders an inline diagram card with a
  title header and Copy-PNG / Download-SVG actions; it re-themes live on
  light/dark toggle and shows a loading state until the streamed JSON is complete.
- **Streaming:** while a reply streams, text reveals at a steady cadence and each
  new block fades in once; on completion the exact final markdown is shown.

## 4. Acceptance Criteria

- [ ] Inline and display math render from both `$`/`$$` and `\(`/`\[` forms;
      math inside code spans is left literal.
- [ ] A `sketchon` block renders a diagram (title in the card header), offers
      Copy-PNG + Download-SVG, and shows a loading (not error) state mid-stream.
- [ ] A complete-but-invalid `sketchon` spec shows a friendly inline error.
- [ ] Mermaid renders and zooms gradually on wheel.
- [ ] Streaming replies reveal smoothly; reduced-motion users see no animation.
- [ ] Code blocks highlight with the light/dark Shiki theme.
- [ ] The renderer remains usable narrow → wide; diagrams scroll horizontally
      rather than overflowing.

## 5. Gating & Edge Cases

- **Footprint (pragna2-tracker TD-017):** Streamdown's diagram/grammar chunks (mermaid,
  cytoscape, wasm, wardley, Shiki grammars) are **code-split** — verified in a
  production build, the eager bundle is unaffected and a chunk loads only when such
  a block renders. Accepted as the cost of web-app parity.
- **Sketchon theme signal:** the diagram reads the desktop's `.dark` class (the web
  app reads `data-theme`) — see `docs/web-app-parity.md`.
- **Partial markdown mid-stream:** unterminated fences/tables are repaired by
  Streamdown's incomplete-markdown mode so a partial reveal renders cleanly.
- **Clipboard unavailable:** Copy-PNG fails quietly without crashing the message.

## 6. UI / Theming

- Theme tokens only; `.chat-markdown` rescales Streamdown's baked heading/code
  sizes to the message body, and the sketchon card uses theme tokens
  (`--primary`, `--card`, `--border`, …). SVG is DOMPurify-sanitized before
  injection.

## 7. Deferred

- None for parity. Any future renderer-weight reduction (pruning grammars /
  diagram engines) would be a deliberate divergence from the web app and tracked
  separately.
