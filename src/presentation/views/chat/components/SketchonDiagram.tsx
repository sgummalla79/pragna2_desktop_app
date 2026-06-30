import { memo, useCallback, useEffect, useState } from 'react';
import { Check, Copy, Download, Loader2 } from 'lucide-react';
import DOMPurify from 'dompurify';
import { renderDiagram, validateSpec, type DiagramSpec } from '@sgummalla-works/sketchon';

/** Rasterise an SVG string to a PNG Blob at 2× for crispness, on a solid
 *  backing so the (transparent) diagram is self-contained when pasted — white in
 *  light mode, dark slate in dark mode. */
function svgToPngBlob(svg: string, mode: 'light' | 'dark'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('canvas 2d context unavailable'));
        return;
      }
      ctx.fillStyle = mode === 'dark' ? '#0f172a' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))), 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG image failed to load'));
    };
    img.src = url;
  });
}

interface SketchonDiagramProps {
  /**
   * Raw `DiagramSpec` JSON captured from a ```` ```sketchon ```` fence by
   * `rehypeSketchon` and passed through Streamdown's `components` map. Optional
   * because react-markdown types custom-element props loosely.
   */
  spec?: string;
}

/**
 * DOMPurify config that keeps SVG (including emoji `<image>` data-URIs) while
 * stripping anything scriptable. This is the line of defence that lets a
 * sketchon-rendered `<svg>` reach the DOM — Streamdown's own markdown sanitizer
 * never sees it (we inject the SVG ourselves, post-render).
 */
const SVG_SANITIZE_CONFIG = { USE_PROFILES: { svg: true, svgFilters: true } } as const;

/** The app's current colour mode, read from the `.dark` class on the root
 *  element (the desktop's dark-mode signal — ``@custom-variant dark`` in
 *  `index.css`). Defaults to light. */
function readThemeMode(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/** Track the app's light/dark mode, updating when the user toggles it (the
 *  theme system flips the `.dark` class on the root element), so a rendered
 *  diagram re-themes live instead of staying stuck in the mode it was first
 *  drawn in. */
function useThemeMode(): 'light' | 'dark' {
  const [mode, setMode] = useState<'light' | 'dark'>(readThemeMode);
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setMode(readThemeMode()));
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return mode;
}

/**
 * Is the spec a COMPLETE JSON object (balanced, closed) rather than a mid-stream
 * fragment? While the assistant streams the ```sketchon block, the JSON arrives a
 * character at a time and is briefly incomplete; rendering it then would flash a
 * spurious "Invalid diagram JSON" error before the real diagram appears. We treat
 * an unbalanced/unclosed object as "still streaming" and stay on the loading
 * state. Quote/escape-aware so braces inside string values don't miscount.
 */
function isLikelyComplete(s: string): boolean {
  if (!s.startsWith('{') || !s.endsWith('}')) return false;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

/** Default download filename stem when a diagram has no title. */
const UNTITLED_DIAGRAM_FILENAME = 'diagram';

/** Turn a diagram title into a safe, kebab-cased filename stem for downloads
 *  (e.g. "OAuth Flow" → "oauth-flow"). Falls back to a default when absent. */
function slugifyTitle(title: string | null): string {
  if (!title) return UNTITLED_DIAGRAM_FILENAME;
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || UNTITLED_DIAGRAM_FILENAME;
}

/** Parse a spec, tolerating a single trailing comma before `}`/`]` — a common
 *  model slip that strict `JSON.parse` rejects. Throws if still invalid. */
function parseSpecLenient(raw: string): DiagramSpec {
  try {
    return JSON.parse(raw) as DiagramSpec;
  } catch {
    return JSON.parse(raw.replace(/,(\s*[}\]])/g, '$1')) as DiagramSpec;
  }
}

/**
 * Fallback `spec.id` synthesized when the model omits the top-level id.
 * sketchon's `validateSpec` marks `id` mandatory, yet the render engines route
 * solely on `spec.kind` and never read `id` (it is referenced only inside the
 * library's validator, not its renderers). A missing id therefore needlessly
 * hard-blocks an otherwise-renderable diagram with a "spec.id is required"
 * error. The value itself is irrelevant to the output — any non-empty string
 * satisfies validation — so a single stable constant suffices.
 */
const SYNTHESIZED_SPEC_ID = 'sketchon-diagram';

/**
 * Return the spec with a synthesized `id` when the model left it out — the same
 * spirit of leniency as `parseSpecLenient`'s trailing-comma tolerance: forgive a
 * common, harmless model slip rather than surface it as a render failure. Only
 * `id` is synthesized; `kind` is deliberately NOT defaulted because it selects
 * the render engine, so an absent `kind` is a genuine error that must still be
 * surfaced by `validateSpec`. Pure — returns a new object only when it changes.
 */
function withSynthesizedId(spec: DiagramSpec): DiagramSpec {
  return spec.id?.trim() ? spec : { ...spec, id: SYNTHESIZED_SPEC_ID };
}

/**
 * Render an inline diagram from a coordinate-free sketchon spec — the rich-diagram
 * parallel to a Mermaid block. Parses the spec, validates it, renders to SVG in
 * the browser via `@sgummalla-works/sketchon`, sanitizes the SVG with DOMPurify,
 * and injects it. While the block is still streaming (incomplete JSON) it shows
 * the loading state, and a friendly message only if a COMPLETE spec is invalid.
 */
function SketchonDiagramImpl({ spec: specText }: SketchonDiagramProps) {
  const [svg, setSvg] = useState<string | null>(null);
  // The title is surfaced as the card header instead of being drawn inside the
  // displayed SVG (it would otherwise appear twice). We keep the titled spec so
  // Copy/Download can re-render a self-contained artifact that still carries it.
  const [title, setTitle] = useState<string | null>(null);
  const [exportSpec, setExportSpec] = useState<DiagramSpec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied'>('idle');
  const mode = useThemeMode();

  /** Render the TITLED spec to a sanitized SVG for export, so the saved file
   *  keeps its heading even though the on-screen diagram shows it in the card
   *  header. Returns null if the spec isn't ready yet. */
  const renderTitledSvg = useCallback(async (): Promise<string | null> => {
    if (!exportSpec) return null;
    const { svg: rendered } = await renderDiagram(exportSpec);
    return DOMPurify.sanitize(rendered, SVG_SANITIZE_CONFIG);
  }, [exportSpec]);

  const downloadSvg = useCallback(async () => {
    const out = await renderTitledSvg();
    if (!out) return;
    const url = URL.createObjectURL(new Blob([out], { type: 'image/svg+xml;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugifyTitle(title)}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [renderTitledSvg, title]);

  const copyPng = useCallback(async () => {
    // Rasterising to PNG + the clipboard write are async, so show progress.
    setCopyState('copying');
    try {
      const titled = await renderTitledSvg();
      if (!titled) {
        setCopyState('idle');
        return;
      }
      const blob = await svgToPngBlob(titled, mode);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1800);
    } catch {
      // Clipboard may be unavailable (insecure context / denied permission) —
      // reset quietly rather than crash the message.
      setCopyState('idle');
    }
  }, [renderTitledSvg, mode]);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);
    setTitle(null);
    setExportSpec(null);

    const raw = specText?.trim();
    if (!raw) return;

    // Still streaming — the JSON object isn't closed yet. Stay on loading; do
    // NOT flash an error. The effect re-runs as more text arrives.
    if (!isLikelyComplete(raw)) return;

    let parsed: DiagramSpec;
    try {
      parsed = withSynthesizedId(parseSpecLenient(raw));
    } catch {
      setError('Invalid diagram JSON.');
      return;
    }

    const issues = validateSpec(parsed);
    if (issues.length) {
      setError(issues.map((i) => i.message).join('; '));
      return;
    }

    // Inject the app's current mode so the diagram matches light/dark. The
    // model never sets it; the FE owns the theme.
    const themed: DiagramSpec = { ...parsed, theme: { ...parsed.theme, mode } };
    const diagramTitle = parsed.title?.trim() || null;
    // The displayed diagram drops the title — it's rendered as the card header
    // instead (see JSX) so it isn't shown twice. The titled `themed` spec is kept
    // in state for Copy/Download.
    const displaySpec: DiagramSpec = { ...themed, title: undefined };

    void (async () => {
      try {
        const { svg: rendered } = await renderDiagram(displaySpec);
        if (!cancelled) {
          setSvg(DOMPurify.sanitize(rendered, SVG_SANITIZE_CONFIG));
          setTitle(diagramTitle);
          setExportSpec(themed);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Diagram render failed.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [specText, mode]);

  if (error) {
    return (
      <div className="sketchon-diagram sketchon-diagram--error" role="note">
        Couldn’t render diagram: {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="sketchon-diagram sketchon-diagram--loading" aria-busy="true">
        Rendering diagram…
      </div>
    );
  }

  return (
    <figure className="sketchon-card">
      <figcaption className="sketchon-card__header">
        <span className="sketchon-card__title">{title}</span>
        <div className="sketchon-card__bar">
          <button
            type="button"
            className="sketchon-card__btn"
            onClick={copyPng}
            disabled={copyState === 'copying'}
            title={
              copyState === 'copying'
                ? 'Converting to PNG…'
                : copyState === 'copied'
                  ? 'Copied to clipboard'
                  : 'Copy as PNG'
            }
            aria-label="Copy diagram as PNG"
          >
            {copyState === 'copying' ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span className="sketchon-card__btn-label">Copying…</span>
              </>
            ) : copyState === 'copied' ? (
              <>
                <Check size={14} />
                <span className="sketchon-card__btn-label">Copied!</span>
              </>
            ) : (
              <Copy size={14} />
            )}
          </button>
          <button
            type="button"
            className="sketchon-card__btn"
            onClick={downloadSvg}
            title="Download SVG"
            aria-label="Download diagram as SVG"
          >
            <Download size={14} />
          </button>
        </div>
      </figcaption>
      {/* SVG is sketchon-generated and DOMPurify-sanitized above; safe to inject. */}
      <div className="sketchon-diagram" role="img" dangerouslySetInnerHTML={{ __html: svg }} />
    </figure>
  );
}

export const SketchonDiagram = memo(SketchonDiagramImpl);
