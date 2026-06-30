/**
 * Markdown-rendering configuration for the chat surface.
 *
 * Centralised here rather than inlined in the renderer so the values can
 * change without touching component logic (no hardcoded literals in
 * presentation code).
 */
import type { ControlsConfig } from 'streamdown';

/**
 * Fenced-code language tag the model uses to embed a sketchon diagram spec —
 * ```` ```sketchon\n{ …DiagramSpec }\n``` ````, the parallel to ```` ```mermaid ````.
 * The renderer for it is wired in `MarkdownMessage` (rehype plugin + component).
 */
export const SKETCHON_FENCE_LANG = 'sketchon';

/**
 * Custom element our rehype plugin emits in place of a ```` ```sketchon ```` block,
 * mapped to the `<SketchonDiagram>` renderer via Streamdown's `components`. Must
 * contain a hyphen so it is treated as a custom element, never a real HTML tag.
 */
export const SKETCHON_ELEMENT_TAG = 'sketchon-diagram';

/**
 * Shiki syntax-highlighting themes as a ``[light, dark]`` tuple.
 *
 * Both names are valid Shiki ``BundledTheme`` members — kept as ``as const`` so
 * they satisfy that literal-union type without importing from the transitive
 * ``shiki`` package. Streamdown picks the active entry from the page's colour
 * mode (the desktop signals dark via the ``.dark`` class on the root element).
 */
export const SHIKI_THEME_LIGHT = 'github-light' as const;
export const SHIKI_THEME_DARK = 'github-dark' as const;

/** ``[light, dark]`` tuple shape Streamdown's ``shikiTheme`` prop expects. */
export const SHIKI_THEMES: [typeof SHIKI_THEME_LIGHT, typeof SHIKI_THEME_DARK] = [
  SHIKI_THEME_LIGHT,
  SHIKI_THEME_DARK,
];

/**
 * Streamdown interaction controls.
 *
 * ``mermaid.panZoom: true`` keeps wheel pan/zoom on the diagram. The raw
 * wheel-zoom is far too fast (Streamdown zooms a fixed step per tick with no
 * speed prop), so ``MarkdownMessage`` throttles the wheel events feeding it —
 * see ``MERMAID_ZOOM_WHEEL_THROTTLE`` there. Fullscreen / copy / download and
 * the table + code controls stay on too.
 */
export const STREAMDOWN_CONTROLS: ControlsConfig = {
  table: true,
  code: true,
  mermaid: { panZoom: true, fullscreen: true, copy: true, download: true },
};

/**
 * Smooth-streaming reveal cadence (claude.ai / ChatGPT-style typing flow).
 *
 * The BE delivers assistant text in uneven bursts — often a few large
 * chunks, not a steady token trickle. Rendering each chunk the instant it
 * lands reads as a chunky flash. ``useSmoothStreamingText`` instead "types"
 * the accumulated text at a steady rate while bounding how far it may lag
 * behind the buffer:
 *
 * - ``STREAM_REVEAL_BASE_CPS`` — the steady typing speed (characters per
 *   second) used whenever the backlog is small. This is the speed the eye
 *   reads as "smooth."
 * - ``STREAM_REVEAL_MAX_LAG_SECONDS`` — the longest the reveal is allowed
 *   to trail the buffer. When a big chunk lands, the rate rises just enough
 *   to clear the backlog within this window (``backlog / MAX_LAG``), so a
 *   long reply never feels stuck yet still animates instead of snapping.
 *   Effective rate = ``max(BASE_CPS, backlog / MAX_LAG_SECONDS)``.
 *
 * Raise BASE for faster typing; raise MAX_LAG for a gentler reveal of large
 * replies (more smoothing, more total delay); lower it to hug the stream.
 */
export const STREAM_REVEAL_BASE_CPS = 25;
export const STREAM_REVEAL_MAX_LAG_SECONDS = 3.5;

/**
 * How the markdown sanitizer (Streamdown's bundled ``rehype-harden``) renders a
 * link it blocks — i.e. one whose href is not an ``http(s)`` URL.
 *
 * The default policy is ``"indicator"``, which keeps the (dead) link and
 * appends a literal `` [blocked]`` marker to its text. That marker is what
 * surfaced on a generated-PDF reply: models routinely emit a phantom
 * ``sandbox:/mnt/data/<file>.pdf`` link (an OpenAI-sandbox path that resolves to
 * nothing here — the real file is the attachment/DocumentCard), so the reader
 * saw e.g. ``view and download it here [blocked]``.
 *
 * ``"text-only"`` instead degrades a blocked link to its plain child text (no
 * dead href, no marker), so the sentence reads cleanly and the DocumentCard
 * remains the real download affordance. Legitimate ``http(s)`` links are
 * untouched — they still render as clickable anchors. This is the string value
 * of ``rehype-harden``'s ``BlockPolicy.textOnly``; kept as a literal here (not
 * imported) to avoid coupling to that transitive dependency's module shape.
 */
export const MARKDOWN_BLOCKED_LINK_POLICY = 'text-only' as const;

/**
 * Citation footnote backlinks (pragna2_desktop_app#99 Tier 3).
 *
 * The backend's `citations` node emits prose with literal `[n]` markers plus a
 * `## References` list. `rehypeCitationBacklinks` turns each in-text `[n]` into
 * an in-page anchor to the matching References item, which it tags
 * `id="cite-ref-<n>"`. Clicking scrolls to and briefly flashes that item.
 */

/** Heading text (lower-cased, trimmed) that introduces the references list. */
export const CITATION_REFERENCES_HEADING = 'references';
/** Id prefix on each References `<li>`; the in-text anchor targets `#<prefix><n>`. */
export const CITATION_BACKLINK_ID_PREFIX = 'cite-ref-';
/** Class on the generated in-text backlink anchors (styling + test hook). */
export const CITATION_BACKLINK_CLASS = 'citation-backlink';
/** Class toggled on a References item to flash it after a backlink click. */
export const CITATION_REF_FLASH_CLASS = 'citation-ref-flash';
/**
 * How long the flash highlight stays on (ms) before it is removed. MUST match
 * the `citation-ref-flash` keyframe duration in `index.css` — kept here as the
 * single source of truth the component reads (the CSS literal mirrors it).
 */
export const CITATION_REF_FLASH_MS = 1500;
