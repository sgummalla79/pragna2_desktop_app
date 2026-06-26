# Technical Spec: Chat Markdown Renderer

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-10
> **Last Updated**: 2026-06-10

---

## 1. Architecture

Streamdown owns the markdown → rehype pipeline (GFM, Shiki, KaTeX, Mermaid). The
desktop **adds two things** and **configures three**, faithfully porting the web
app's `MarkdownMessage`.

```
ChatMessage(streaming) → MarkdownMessage(content, isStreaming)
  normalizeMathDelimiters(content)        // \(…\)/\[…\] → $…$/$$…$$  (code masked)
  → useSmoothStreamingText(…, isStreaming)// steady-cadence reveal prefix
  → <Streamdown
       mode = streaming|static
       shikiTheme = SHIKI_THEMES
       controls   = STREAMDOWN_CONTROLS    // table/code + mermaid pan/zoom/…
       rehypePlugins = [...defaultRehypePlugins, rehypeSketchon]
       components    = { 'sketchon-diagram': SketchonDiagram } >
  + capture-phase wheel throttle (mermaid)
  + .chat-markdown / --animate per-block fade-in
```

## 2. Renderer decision (pragna2-tracker TD-017)

Both apps use **Streamdown `^1.6.11`** — the same renderer (react-markdown is only
Streamdown's transitive dep, never imported directly). "Switch to react-markdown"
was a hypothetical that would *create* drift. The heavy chunks (mermaid ~2.96 MB,
cytoscape ~443 kB, wasm ~622 kB, wardley ~612 kB, Shiki grammars) are **code-split**
— a production `pnpm build` emits each as a separate lazy chunk; the eager `index`
bundle (~398 kB) is unaffected. Accepted as the cost of parity.

## 3. Added pieces

- **`utils/markdownStreaming.ts` → `normalizeMathDelimiters`** — rewrites `\(…\)`→
  `$…$` and `\[…\]`→`$$…$$` so remark-math/KaTeX render math from any provider;
  fenced/inline code is masked first (sentinel `@@n@@`) so literals aren't rewritten.
- **`utils/rehypeSketchon.ts` → `rehypeSketchon`** — a rehype transform that swaps a
  ```` ```sketchon ```` `<pre><code class="language-sketchon">` for a
  `<sketchon-diagram spec="…">` element. Appended **after** `defaultRehypePlugins`
  so it runs **past** rehype-harden (harden can't strip the custom element);
  recovers the spec by concatenating descendant text (robust to Shiki spans).
- **Blocked-link rendering.** When `MarkdownMessage` rebuilds Streamdown's default
  rehype chain (to append `rehypeSketchon`), it also overrides rehype-harden's
  `linkBlockPolicy` to `"text-only"` (`MARKDOWN_BLOCKED_LINK_POLICY` in
  `constants/markdown`). harden allows only `http(s)` links under its wildcard, so a
  non-http link — e.g. a model's phantom `sandbox:/mnt/data/*.pdf` (the real file is
  the attachment/DocumentCard) — is blocked; the default `"indicator"` policy would
  append a literal `" [blocked]"`. `"text-only"` instead degrades it to its plain
  child text (no dead anchor, no marker); legitimate `http(s)` links stay clickable
  (nexus-kit-tracker #227 / CF-048; the phantom-link root cause is backend #228).
- **`components/SketchonDiagram.tsx`** — renders the custom element. Parses the spec
  (lenient: tolerates a trailing comma), `validateSpec`, `renderDiagram` →
  **DOMPurify-sanitized** SVG (SVG profile) injected via `dangerouslySetInnerHTML`.
  Streams safely: `isLikelyComplete` (brace/quote-aware) keeps a loading state until
  the JSON closes, so it never flashes an error mid-stream. Title shown in a card
  header (dropped from the displayed SVG to avoid duplication; kept in the export
  spec). Copy-PNG (2× raster on a mode-appropriate backing) + Download-SVG.
  Light/dark read from the **`.dark` class** on the root (`useThemeMode` observes
  `class` mutations) — the web app reads `data-theme` (the one porting adaptation).

## 4. Configured pieces

- **`constants/markdown.ts`** — `SKETCHON_FENCE_LANG` / `SKETCHON_ELEMENT_TAG`,
  `SHIKI_THEMES` (`[github-light, github-dark]`), `STREAMDOWN_CONTROLS`
  (`table`, `code`, `mermaid: { panZoom, fullscreen, copy, download }`),
  `STREAM_REVEAL_BASE_CPS` (25), `STREAM_REVEAL_MAX_LAG_SECONDS` (3.5).
- **Mermaid wheel throttle** — `MarkdownMessage` intercepts `wheel` in the capture
  phase over `[data-streamdown="mermaid-block"]` and lets only every
  `MERMAID_ZOOM_WHEEL_THROTTLE`-th (6) tick reach Streamdown's fixed-step zoom, so a
  scroll gesture zooms gradually instead of wildly.
- **KaTeX CSS** — `import 'katex/dist/katex.min.css'` in `MarkdownMessage`; `katex`
  is pinned as an explicit dep (Streamdown bundles it, but pnpm's strict layout
  doesn't hoist the CSS path).
- **`@source`** — `index.css` scans `streamdown/dist/*.js` (widened from
  `index.js`) so mermaid/controls utility classes are generated.

## 5. Streaming reveal

- **`hooks/useSmoothStreamingText.ts`** — while `isStreaming`, returns a growing
  prefix of the (normalized) text advanced per animation frame at
  `max(BASE_CPS, backlog / MAX_LAG_SECONDS)` chars/sec; snaps to full when
  streaming ends or for non-streaming turns; guards a shrinking buffer
  (regen/branch). `isStreaming` is threaded from `ChatMessage.streaming`.
- **CSS** (`index.css`) — `.chat-markdown` rescales Streamdown's baked heading/code
  sizes to the message body; `.chat-markdown--animate > div > *` fades each new
  block in once (Streamdown memoises blocks, so completed blocks don't re-fire);
  `prefers-reduced-motion` disables the animation.

## 6. Deviations from the web app

All no-functional-impact (logged in `docs/web-app-parity.md` §3/§4/§5): sketchon
theme signal reads the `.dark` class vs. `data-theme`; `katex` pinned explicitly
(pnpm strict); `@source` glob widened to `dist/*.js`. The renderer config,
`normalizeMathDelimiters`, `rehypeSketchon`, and `SketchonDiagram` are otherwise
ported faithfully.

## 7. Deferred / notes

None for parity. Live verification (math, mermaid zoom, a `sketchon` diagram that
re-themes on dark toggle) needs `pnpm tauri dev` + a backend that emits such blocks.
