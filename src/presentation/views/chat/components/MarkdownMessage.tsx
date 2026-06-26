import { memo, useEffect, useMemo, useRef, type ComponentProps } from 'react';
import { Streamdown, defaultRehypePlugins } from 'streamdown';
// KaTeX layout styles for Streamdown's rehype-katex math pass. Streamdown
// bundles `katex`, so we import its stylesheet directly (the package exposes
// no `./katex.css` entry of its own).
import 'katex/dist/katex.min.css';
import { normalizeMathDelimiters } from '@/presentation/views/chat/utils/markdownStreaming';
import { rehypeSketchon } from '@/presentation/views/chat/utils/rehypeSketchon';
import { SketchonDiagram } from '@/presentation/views/chat/components/SketchonDiagram';
import { useSmoothStreamingText } from '@/presentation/views/chat/hooks/useSmoothStreamingText';
import {
  SHIKI_THEMES,
  STREAMDOWN_CONTROLS,
  SKETCHON_ELEMENT_TAG,
  MARKDOWN_BLOCKED_LINK_POLICY,
} from '@/constants/markdown';
import { cn } from '@/lib/utils';

// Rebuild Streamdown's default rehype chain with two changes, then re-pass it:
//   1. Append our ```sketchon plugin LAST so it runs past the sanitizer
//      (rehype-harden) — harden can't strip the <sketchon-diagram> element we
//      introduce.
//   2. Soften harden's link-block policy to "text-only" so a blocked (non-http)
//      link — e.g. a model's phantom `sandbox:/mnt/data/*.pdf` — degrades to
//      clean text instead of the default `text [blocked]` marker. See
//      MARKDOWN_BLOCKED_LINK_POLICY. http(s) links stay clickable.
// `defaultRehypePlugins` is an ordered Record keyed by name (`Object.entries`
// preserves that order); each value is either a bare plugin or a `[plugin,
// options]` tuple. Streamdown destructures `rehypePlugins` with a default, so
// passing this REPLACES the default chain — hence the faithful rebuild.
const SKETCHON_REHYPE_PLUGINS = [
  ...Object.entries(defaultRehypePlugins).map(([name, plugin]) =>
    name === 'harden' && Array.isArray(plugin)
      ? [
          plugin[0],
          {
            ...(plugin[1] as Record<string, unknown>),
            linkBlockPolicy: MARKDOWN_BLOCKED_LINK_POLICY,
          },
        ]
      : plugin,
  ),
  rehypeSketchon,
] as ComponentProps<typeof Streamdown>['rehypePlugins'];

// Streamdown merges its internal components first, then spreads user components,
// so this ADDS the <sketchon-diagram> renderer without clobbering its code /
// mermaid / Shiki handling.
const SKETCHON_COMPONENTS = {
  [SKETCHON_ELEMENT_TAG]: SketchonDiagram,
} as ComponentProps<typeof Streamdown>['components'];

// Only every Nth wheel tick over a Mermaid diagram reaches Streamdown's
// zoom handler — the rest are dropped. Streamdown zooms a fixed 0.1 step per
// wheel event with no speed prop, so a single scroll gesture (many ticks)
// zooms wildly; throttling makes it gradual. Higher = slower zoom.
const MERMAID_ZOOM_WHEEL_THROTTLE = 6;

interface MarkdownMessageProps {
  /** Raw assistant markdown to render. */
  content: string;
  /**
   * True only while this turn is the in-flight streaming assistant
   * message. Switches Streamdown to ``streaming`` mode (per-block
   * memoisation + incomplete-markdown repair for unterminated code
   * fences / half-written tables) so the bubble stays stable as tokens
   * arrive; once the turn completes we render the exact final markdown
   * in ``static`` mode.
   */
  isStreaming?: boolean;
  className?: string;
}

/**
 * Render assistant markdown the Claude.ai way: GFM (tables, task lists,
 * footnotes), fenced code with Shiki highlighting + copy buttons, KaTeX
 * math, and inline sketchon diagrams — all provider-agnostic.
 *
 * Every major model emits Markdown, so there is no per-provider branching;
 * the only normalisation is math-delimiter alignment (``\(…\)`` → ``$…$``)
 * via :func:`normalizeMathDelimiters`. Streamdown owns the streaming-safe
 * parsing and is hardened/sanitised by default (rehype-harden strips unsafe
 * link/image URLs), so no explicit allow-list is needed here.
 */
function MarkdownMessageImpl({ content, isStreaming = false, className }: MarkdownMessageProps) {
  const normalized = useMemo(() => normalizeMathDelimiters(content), [content]);
  // Reveal the normalized text at a steady cadence while streaming so the
  // reply "types" smoothly (claude.ai / ChatGPT feel) instead of lurching
  // with each raw SSE burst. No-op (returns the full string) once the turn
  // completes or for non-streaming turns.
  const revealed = useSmoothStreamingText(normalized, isStreaming);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Throttle Mermaid wheel-zoom. Streamdown attaches a non-passive ``wheel``
  // listener that zooms a fixed 0.1 step per event, with no speed prop — so a
  // single scroll gesture (many ticks) zooms far too fast. We intercept
  // ``wheel`` in the CAPTURE phase over a mermaid block and let only every
  // Nth tick through to Streamdown's handler; the rest are stopped (and their
  // default suppressed) so they neither zoom nor scroll the page off the
  // diagram. Net effect: zoom still works, but gradually. Non-mermaid wheel
  // events are untouched.
  const wheelTickRef = useRef(0);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onWheelCapture = (e: WheelEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest('[data-streamdown="mermaid-block"]')) return;
      wheelTickRef.current += 1;
      if (wheelTickRef.current % MERMAID_ZOOM_WHEEL_THROTTLE !== 0) {
        // Drop this tick: stop it reaching Streamdown's zoom handler, and
        // prevent the page from scrolling while the cursor is over the diagram.
        e.preventDefault();
        e.stopPropagation();
      }
      // Otherwise let it bubble to Streamdown's listener → one zoom step.
    };
    el.addEventListener('wheel', onWheelCapture, { capture: true, passive: false });
    return () => el.removeEventListener('wheel', onWheelCapture, { capture: true });
  }, []);

  return (
    <div
      ref={wrapperRef}
      // ``--animate`` (streaming only) fades each newly-revealed block in
      // once on mount — the claude.ai / ChatGPT / Gemini reveal. Streamdown
      // memoises blocks by content, so completed blocks keep their DOM node
      // and never re-fire the animation; only genuinely-new blocks animate.
      className={cn('chat-markdown', isStreaming && 'chat-markdown--animate', className)}
    >
      <Streamdown
        mode={isStreaming ? 'streaming' : 'static'}
        parseIncompleteMarkdown={isStreaming}
        shikiTheme={SHIKI_THEMES}
        controls={STREAMDOWN_CONTROLS}
        rehypePlugins={SKETCHON_REHYPE_PLUGINS}
        components={SKETCHON_COMPONENTS}
        className="break-words"
      >
        {revealed}
      </Streamdown>
    </div>
  );
}

export const MarkdownMessage = memo(MarkdownMessageImpl);
