import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, Download, Loader2 } from 'lucide-react';
import DOMPurify from 'dompurify';
import { renderDiagram, validateSpec, type DiagramSpec } from '@sgummalla-works/sketchon';
import { copyImagePng, copyText } from '@/infrastructure/platform';
import { logger } from '@/infrastructure/logging/logger';

/** MIME type for an SVG payload (download blob + rasteriser source). Spec-defined
 *  literal, kept named rather than inlined per the no-hardcoding rule. */
const SVG_MIME = 'image/svg+xml;charset=utf-8';
/** Raster MIME types `canvas.toBlob` can emit for diagram export. */
const PNG_MIME = 'image/png';
const JPEG_MIME = 'image/jpeg';
/** JPEG is lossy and has no alpha channel; 0.92 is the de-facto "high quality"
 *  encoder setting browsers use, balancing fidelity against file size. */
const JPEG_QUALITY = 0.92;
/** Canvas raster scale — render at 2× so PNG/JPEG exports stay crisp on
 *  high-DPI displays. */
const RASTER_SCALE = 2;
/** Solid backings for the (transparent) diagram so a rasterised export is
 *  self-contained — white in light mode, dark slate in dark mode. JPEG has no
 *  transparency, so a backing is mandatory there, not merely cosmetic. */
const RASTER_BG = { light: '#ffffff', dark: '#0f172a' } as const;
/** How long the Copy button shows its "Copied!" confirmation before resetting. */
const COPIED_FEEDBACK_MS = 1800;

/** Rasterise an SVG string to a PNG/JPEG Blob at {@link RASTER_SCALE}× on a
 *  solid theme-aware backing, so the exported image is crisp and self-contained.
 *  `mime` selects the encoder; JPEG additionally uses {@link JPEG_QUALITY}. */
function svgToRasterBlob(svg: string, mode: 'light' | 'dark', mime: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: SVG_MIME }));
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const canvas = document.createElement('canvas');
      canvas.width = w * RASTER_SCALE;
      canvas.height = h * RASTER_SCALE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('canvas 2d context unavailable'));
        return;
      }
      ctx.fillStyle = RASTER_BG[mode];
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(RASTER_SCALE, RASTER_SCALE);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const quality = mime === JPEG_MIME ? JPEG_QUALITY : undefined;
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
        mime,
        quality,
      );
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

/** A user-selectable download format. `mime === null` means the vector SVG is
 *  saved as-is; any other value is rasterised by {@link svgToRasterBlob}. */
interface DownloadFormat {
  /** Menu label. */
  label: string;
  /** Filename extension (also the menu key). */
  ext: string;
  /** Raster encoder MIME, or `null` to save the SVG vector directly. */
  mime: string | null;
}

/**
 * Download menu, data-driven so adding a format is one list entry rather than a
 * new code branch (open/closed). Unlike copy, JPEG *is* offerable here because a
 * download is a plain file write — only the clipboard rejects `image/jpeg`.
 */
const DOWNLOAD_FORMATS: readonly DownloadFormat[] = [
  { label: 'PNG image', ext: 'png', mime: PNG_MIME },
  { label: 'SVG vector', ext: 'svg', mime: null },
  { label: 'JPG image', ext: 'jpg', mime: JPEG_MIME },
];

/** Shared dropdown + item styling for the Copy/Download menus, mirroring the
 *  message-action menu so the two read as one design. */
const MENU_CLASS =
  'absolute right-0 top-full z-30 mt-1 w-44 list-none overflow-hidden rounded-md border border-border bg-popover p-1 shadow-lg';
const MENU_ITEM_CLASS =
  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-popover-foreground hover:bg-accent hover:text-accent-foreground';

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
  // Which header menu is open (only one at a time), or null. The Copy menu
  // offers PNG (image) + SVG (markup); the Download menu offers PNG/SVG/JPG.
  const [openMenu, setOpenMenu] = useState<'copy' | 'download' | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const mode = useThemeMode();

  // Close the open menu on an outside click or Escape, so it behaves like a
  // normal popover instead of trapping focus on the card.
  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenu]);

  /** Render the TITLED spec to a sanitized SVG for export, so the saved file
   *  keeps its heading even though the on-screen diagram shows it in the card
   *  header. Returns null if the spec isn't ready yet. */
  const renderTitledSvg = useCallback(async (): Promise<string | null> => {
    if (!exportSpec) return null;
    const { svg: rendered } = await renderDiagram(exportSpec);
    return DOMPurify.sanitize(rendered, SVG_SANITIZE_CONFIG);
  }, [exportSpec]);

  /** Save a blob to disk via a transient object-URL anchor. */
  const triggerDownload = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const download = useCallback(
    async (fmt: DownloadFormat) => {
      setOpenMenu(null);
      try {
        const out = await renderTitledSvg();
        if (!out) return;
        const blob = fmt.mime
          ? await svgToRasterBlob(out, mode, fmt.mime)
          : new Blob([out], { type: SVG_MIME });
        triggerDownload(blob, `${slugifyTitle(title)}.${fmt.ext}`);
      } catch (e) {
        logger.fromError('Failed to download sketchon diagram', e, { ext: fmt.ext });
      }
    },
    [renderTitledSvg, mode, title, triggerDownload],
  );

  const copyPng = useCallback(async () => {
    setOpenMenu(null);
    setCopyState('copying');
    try {
      // Hand copyImagePng a PENDING promise so clipboard.write() fires while the
      // click's user-gesture activation is still live — rasterising first and
      // awaiting here would spend the activation and WKWebView would reject the
      // write (the CF-053 bug). See @/infrastructure/platform/clipboard.
      await copyImagePng(
        (async () => {
          const titled = await renderTitledSvg();
          if (!titled) throw new Error('Diagram not ready to copy.');
          return svgToRasterBlob(titled, mode, PNG_MIME);
        })(),
      );
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), COPIED_FEEDBACK_MS);
    } catch (e) {
      logger.fromError('Failed to copy sketchon diagram as PNG', e);
      setCopyState('idle');
    }
  }, [renderTitledSvg, mode]);

  const copySvg = useCallback(async () => {
    setOpenMenu(null);
    setCopyState('copying');
    try {
      // Same gesture-safe pattern as copyPng: pass the pending SVG-markup promise
      // so the text write is issued synchronously within the click.
      await copyText(
        (async () => {
          const titled = await renderTitledSvg();
          if (!titled) throw new Error('Diagram not ready to copy.');
          return titled;
        })(),
      );
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), COPIED_FEEDBACK_MS);
    } catch (e) {
      logger.fromError('Failed to copy sketchon diagram SVG', e);
      setCopyState('idle');
    }
  }, [renderTitledSvg]);

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
        <div className="sketchon-card__bar" ref={barRef}>
          <div className="relative">
            <button
              type="button"
              className="sketchon-card__btn"
              onClick={() => setOpenMenu((m) => (m === 'copy' ? null : 'copy'))}
              disabled={copyState === 'copying'}
              aria-haspopup="menu"
              aria-expanded={openMenu === 'copy'}
              title="Copy diagram"
              aria-label="Copy diagram"
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
                <>
                  <Copy size={14} />
                  <ChevronDown size={12} aria-hidden />
                </>
              )}
            </button>
            {openMenu === 'copy' && (
              <ul role="menu" aria-label="Copy diagram as" className={MENU_CLASS}>
                <li role="none">
                  <button role="menuitem" type="button" className={MENU_ITEM_CLASS} onClick={copyPng}>
                    Copy as PNG
                  </button>
                </li>
                <li role="none">
                  <button role="menuitem" type="button" className={MENU_ITEM_CLASS} onClick={copySvg}>
                    Copy as SVG
                  </button>
                </li>
              </ul>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              className="sketchon-card__btn"
              onClick={() => setOpenMenu((m) => (m === 'download' ? null : 'download'))}
              aria-haspopup="menu"
              aria-expanded={openMenu === 'download'}
              title="Download diagram"
              aria-label="Download diagram"
            >
              <Download size={14} />
              <ChevronDown size={12} aria-hidden />
            </button>
            {openMenu === 'download' && (
              <ul role="menu" aria-label="Download diagram as" className={MENU_CLASS}>
                {DOWNLOAD_FORMATS.map((fmt) => (
                  <li role="none" key={fmt.ext}>
                    <button
                      role="menuitem"
                      type="button"
                      className={MENU_ITEM_CLASS}
                      onClick={() => download(fmt)}
                    >
                      {fmt.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </figcaption>
      {/* SVG is sketchon-generated and DOMPurify-sanitized above; safe to inject. */}
      <div className="sketchon-diagram" role="img" dangerouslySetInnerHTML={{ __html: svg }} />
    </figure>
  );
}

export const SketchonDiagram = memo(SketchonDiagramImpl);
